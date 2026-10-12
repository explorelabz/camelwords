import { before, after, test } from "node:test";
import { readFileSync } from "node:fs";
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from "@firebase/rules-unit-testing";
import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
} from "firebase/firestore";
let env, alice, bob, guest;
const profile = {
  activeBook: "toeic-600",
  dailyLimit: 60,
  newCap: 30,
  autoFill: true,
  autoAudio: true,
  accent: "en-US",
  algorithm: "fsrs",
  reminder: null,
  timezone: "Asia/Tokyo",
  planTier: "FREE",
  updatedAt: serverTimestamp(),
};
before(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-camelwords",
    firestore: { rules: readFileSync("firebase/firestore.rules", "utf8") },
  });
  alice = env.authenticatedContext("alice").firestore();
  bob = env.authenticatedContext("bob").firestore();
  guest = env.unauthenticatedContext().firestore();
});
after(async () => {
  await env?.cleanup();
});
test("private profiles and daily plans are isolated by owner", async () => {
  await assertSucceeds(setDoc(doc(alice, "users/alice"), profile));
  await assertFails(getDoc(doc(bob, "users/alice")));
  await assertFails(getDoc(doc(guest, "users/alice")));
  await assertSucceeds(
    setDoc(doc(alice, "users/alice/dailyPlans/2026-10-07"), { items: [] }),
  );
  await assertFails(
    setDoc(doc(bob, "users/alice/dailyPlans/2026-10-07"), { items: [] }),
  );
});
test("client cannot escalate privileges or overwrite server state", async () => {
  await assertFails(updateDoc(doc(alice, "users/alice"), { planTier: "PRO" }));
  await assertFails(updateDoc(doc(alice, "users/alice"), { deleting: false }));
  await assertFails(
    setDoc(doc(alice, "users/alice/wordStates/appointment"), {
      status: "MASTERED",
    }),
  );
});
test("review events are immutable and validate rating and timestamp", async () => {
  const event = {
    id: "evt1",
    kind: "review",
    wordKey: "appointment",
    rating: "GOOD",
    algorithm: "fsrs",
    algorithmVersion: "ts-fsrs-5",
    clientReviewedAt: "2026-10-07T00:00:00.000Z",
    before: null,
    after: null,
    deviceId: "device1",
    serverReceivedAt: serverTimestamp(),
  };
  await assertSucceeds(
    setDoc(doc(alice, "users/alice/reviewEvents/evt1"), event),
  );
  await assertFails(
    updateDoc(doc(alice, "users/alice/reviewEvents/evt1"), { rating: "AGAIN" }),
  );
  await assertFails(deleteDoc(doc(alice, "users/alice/reviewEvents/evt1")));
  await assertFails(
    setDoc(doc(alice, "users/alice/reviewEvents/evt2"), {
      ...event,
      id: "evt2",
      rating: "EASY",
    }),
  );
  await assertFails(
    setDoc(doc(bob, "users/alice/reviewEvents/evt3"), { ...event, id: "evt3" }),
  );
});
test("deleted account tombstone blocks stale tokens from recreating data", async () => {
  await env.withSecurityRulesDisabled(async (c) =>
    setDoc(doc(c.firestore(), "deletedAccounts/deleted"), {
      at: serverTimestamp(),
    }),
  );
  const db = env.authenticatedContext("deleted").firestore();
  await assertFails(setDoc(doc(db, "users/deleted"), profile));
  await assertFails(
    setDoc(doc(db, "users/deleted/deviceBackups/x"), { queue: [] }),
  );
});
test("only published content is public, nobody can write content from client", async () => {
  await env.withSecurityRulesDisabled(async (c) => {
    await setDoc(doc(c.firestore(), "contentPackages/published"), {
      status: "PUBLISHED",
    });
    await setDoc(doc(c.firestore(), "contentPackages/draft"), {
      status: "DRAFT",
    });
  });
  await assertSucceeds(getDoc(doc(guest, "contentPackages/published")));
  await assertFails(getDoc(doc(guest, "contentPackages/draft")));
  await assertFails(
    setDoc(doc(alice, "contentPackages/published"), { status: "PUBLISHED" }),
  );
});
