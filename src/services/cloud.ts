import Constants from "expo-constants";
import type { Data } from "../domain/types";
export const cloudAvailable = Boolean(
  Constants.expoConfig?.extra?.nativeFirebase,
);
let initialized = false;
const saved = new Map<string, string>();
export async function syncCloud(data: Data): Promise<string[]> {
  if (!cloudAvailable) return [];
  const [
    { getAuth, signInAnonymously },
    { getFirestore, doc, setDoc, runTransaction, serverTimestamp },
  ] = await Promise.all([
    import("@react-native-firebase/auth"),
    import("@react-native-firebase/firestore"),
  ]);
  const auth = getAuth();
  const user = auth.currentUser ?? (await signInAnonymously(auth)).user;
  const db = getFirestore();
  const root = `users/${user.uid}`;
  // Cache only acknowledged writes. A failed write is retried on the next sync.
  async function writeChanged(path: string, value: Record<string, unknown>) {
    const json = JSON.stringify(value);
    if (saved.get(path) === json) return;
    await setDoc(
      doc(db, path),
      { ...value, updatedAt: serverTimestamp() },
      { merge: true },
    );
    saved.set(path, json);
  }
  await writeChanged(root, {
    ...data.settings,
    timezone: "Asia/Tokyo",
    planTier: "FREE",
  });
  const ack: string[] = [];
  for (const e of data.events.filter((e) => data.outbox.includes(e.id))) {
    const ref = doc(
      db,
      `${root}/${e.kind === "review" ? "reviewEvents" : "stateEvents"}/${e.id}`,
    );
    await runTransaction(db, async (tx) => {
      const existing = await tx.get(ref);
      if (!existing.exists())
        tx.set(ref, {
          ...e,
          deviceId: data.deviceId,
          serverReceivedAt: serverTimestamp(),
        });
    });
    ack.push(e.id);
  }
  // Keep device-specific planning data separate; a stale device must never
  // overwrite another device's queue or same-day repetition order.
  await writeChanged(`${root}/deviceBackups/${data.deviceId}`, {
    schemaVersion: 1,
    queue: data.queue,
    settings: data.settings,
    backlogPaused: data.backlogPaused,
  });
  for (const plan of Object.values(data.plans))
    await writeChanged(`${root}/dailyPlans/${plan.date}_${data.deviceId}`, {
      ...plan,
      deviceId: data.deviceId,
    });
  for (const diagnosis of data.diagnostics)
    await writeChanged(`${root}/diagnostics/${diagnosis.id}`, { ...diagnosis });
  // Analytics failure must not block durable learning-data synchronization.
  if (!initialized) {
    try {
      const { getAnalytics, logEvent } =
        await import("@react-native-firebase/analytics");
      await logEvent(getAnalytics(), "app_session_start");
      initialized = true;
    } catch {
      /* retry next session */
    }
  }
  return ack;
}
export async function deleteCloudAccount() {
  if (!cloudAvailable) throw new Error("Firebase の設定が必要です。");
  const { getFunctions, httpsCallable } =
    await import("@react-native-firebase/functions");
  await httpsCallable(
    getFunctions(undefined, "asia-northeast1"),
    "deleteAccount",
  )({});
  const { getAuth, signOut } = await import("@react-native-firebase/auth");
  await signOut(getAuth());
  saved.clear();
  initialized = false;
}
