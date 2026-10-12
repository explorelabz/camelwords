// Creates one disposable anonymous test user, then deletes it through the app's callable.
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import { initializeApp, deleteApp } from "firebase/app";
import { getAuth, signInAnonymously } from "firebase/auth";
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  serverTimestamp,
  terminate,
} from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";
import { createData } from "../src/domain/types";
import { words } from "../src/content/catalog";
import { ensurePlan, rate, changeState } from "../src/domain/engine";
async function main() {
  const c = JSON.parse(readFileSync("google-services.json", "utf8"));
  const app = initializeApp({
    projectId: c.project_info.project_id,
    apiKey: c.client[0].api_key[0].current_key,
    appId: c.client[0].client_info.mobilesdk_app_id,
  });
  const auth = getAuth(app),
    db = getFirestore(app),
    fn = getFunctions(app, "asia-northeast1");
  let root = "";
  try {
    await assert.rejects(httpsCallable(fn, "deleteAccount")({}), {
      code: "functions/unauthenticated",
    });
    const user = (await signInAnonymously(auth)).user;
    root = `users/${user.uid}`;
    console.log(`Disposable test account: ${user.uid}`);
    const d = createData();
    d.deviceId = "disposable-smoke-test";
    await setDoc(doc(db, root), {
      ...d.settings,
      timezone: "Asia/Tokyo",
      planTier: "FREE",
      updatedAt: serverTimestamp(),
    });
    const now = new Date();
    ensurePlan(d, words, now);
    rate(d, words, "GOOD", now);
    const first = d.events[0];
    await setDoc(doc(db, `${root}/reviewEvents/${first.id}`), {
      ...first,
      deviceId: d.deviceId,
      serverReceivedAt: serverTimestamp(),
    });
    let found = false;
    for (let i = 0; i < 30; i++) {
      const state = await getDoc(
        doc(db, `${root}/wordStates/${first.wordKey}`),
      );
      if (state.exists()) {
        assert.equal(state.data().reviewCount, 1);
        found = true;
        break;
      }
      await new Promise((r) => setTimeout(r, 2000));
    }
    assert.ok(found, "review trigger did not produce a state");
    await assert.rejects(
      updateDoc(doc(db, `${root}/reviewEvents/${first.id}`), {
        rating: "AGAIN",
      }),
      { code: "permission-denied" },
    );
    await assert.rejects(getDoc(doc(db, "users/another-account")), {
      code: "permission-denied",
    });
    const master = changeState(d, first.wordKey, "MASTER", new Date());
    await setDoc(doc(db, `${root}/stateEvents/${master.id}`), {
      ...master,
      deviceId: d.deviceId,
      serverReceivedAt: serverTimestamp(),
    });
    found = false;
    for (let i = 0; i < 30; i++) {
      const state = await getDoc(
        doc(db, `${root}/wordStates/${first.wordKey}`),
      );
      if (state.data()?.status === "MASTERED") {
        found = true;
        break;
      }
      await new Promise((r) => setTimeout(r, 2000));
    }
    assert.ok(found, "master trigger did not update state");
    console.log(
      "PASS: anonymous auth, profile write, review replay, event immutability, user isolation, mastered state replay",
    );
  } finally {
    try {
      if (root) {
        await httpsCallable(fn, "deleteAccount")({});
        const leftover = await getDoc(doc(db, root));
        assert.equal(leftover.exists(), false);
        console.log("PASS: deleteAccount removed disposable test data");
      }
    } finally {
      await terminate(db);
      await deleteApp(app);
    }
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
