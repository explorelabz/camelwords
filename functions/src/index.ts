import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { setGlobalOptions } from "firebase-functions/v2";
import { replayWord } from "../../src/domain/merge";
import { studyDay } from "../../src/domain/engine";
import type { Event, WordState } from "../../src/domain/types";
initializeApp();
setGlobalOptions({ maxInstances: 2, minInstances: 0, memory: "256MiB" });
const db = getFirestore();
const region = "asia-northeast1";
// Both event streams participate in replay: old review events must never
// resurrect a later mastered/removed word. Transaction retries handle races.
async function replay(uid: string, key: string) {
  const root = db.doc(`users/${uid}`);
  const target = root.collection("wordStates").doc(key);
  await db.runTransaction(async (tx) => {
    const user = await tx.get(root);
    const tombstone = await tx.get(db.doc(`deletedAccounts/${uid}`));
    if (user.data()?.deleting || tombstone.exists) return;
    const [review, state] = await Promise.all([
      tx.get(root.collection("reviewEvents").where("wordKey", "==", key)),
      tx.get(root.collection("stateEvents").where("wordKey", "==", key)),
    ]);
    const events = [...review.docs, ...state.docs]
      .map((d) => d.data() as Event)
      .sort(
        (a, b) =>
          a.clientReviewedAt.localeCompare(b.clientReviewedAt) ||
          a.id.localeCompare(b.id),
      );
    const value = replayWord(events);
    if (value) tx.set(target, value);
    else tx.delete(target);
  });
}
export const onReviewEventCreated = onDocumentCreated(
  { document: "users/{uid}/reviewEvents/{eventId}", region },
  async (e) => {
    const data = e.data?.data();
    if (data) await replay(e.params.uid, data.wordKey);
  },
);
export const onStateEventCreated = onDocumentCreated(
  { document: "users/{uid}/stateEvents/{eventId}", region },
  async (e) => {
    const data = e.data?.data();
    if (data) await replay(e.params.uid, data.wordKey);
  },
);
// Firebase ID tokens are validated by the callable handler. Cloud Run IAM
// must allow the request to reach it (including after a failed first deploy).
export const deleteAccount = onCall(
  { region, invoker: "public" },
  async (request) => {
    if (!request.auth)
      throw new HttpsError("unauthenticated", "ログインが必要です。");
    const uid = request.auth.uid;
    await db
      .doc(`deletedAccounts/${uid}`)
      .set({ at: FieldValue.serverTimestamp() });
    await db.doc(`users/${uid}`).set({ deleting: true }, { merge: true });
    await getAuth().updateUser(uid, { disabled: true });
    await db.recursiveDelete(db.doc(`users/${uid}`));
    await getAuth().deleteUser(uid);
    return { deleted: true };
  },
);
export const dailyStats = onSchedule(
  { schedule: "0 5 * * *", timeZone: "Asia/Tokyo", region },
  async () => {
    const day = studyDay(new Date());
    let users = 0,
      backlog = 0;
    let cursor: FirebaseFirestore.QueryDocumentSnapshot | undefined;
    while (true) {
      let q = db.collection("users").orderBy("__name__").limit(200);
      if (cursor) q = q.startAfter(cursor);
      const batch = await q.get();
      if (batch.empty) break;
      for (const user of batch.docs) {
        users++;
        const count = await user.ref
          .collection("wordStates")
          .where("status", "in", ["LEARNING", "REVIEW"])
          .where("nextReviewAt", "<", new Date().toISOString())
          .count()
          .get();
        backlog += count.data().count;
      }
      cursor = batch.docs.at(-1);
    }
    await db.doc(`stats/${day}`).set({
      users,
      dueWords: backlog,
      averageBacklog: users ? backlog / users : 0,
      computedAt: FieldValue.serverTimestamp(),
    });
  },
);
