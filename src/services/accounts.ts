import Constants from "expo-constants";
import { Platform } from "react-native";
import { cloudAvailable } from "./cloud";
import { createData, type Data, type Event } from "../domain/types";
import { mergePlan } from "../domain/merge";
export type Provider = "apple" | "google";
export const googleAvailable =
  cloudAvailable &&
  Constants.expoConfig?.extra?.googleSignInEnabled === true &&
  Boolean(Constants.expoConfig?.extra?.googleWebClientId);
export const appleAvailable =
  cloudAvailable &&
  Platform.OS === "ios" &&
  Constants.expoConfig?.extra?.appleSignInEnabled === true;
export async function connectAccount(provider: Provider, restore = false) {
  if (!cloudAvailable) throw Error("Firebase の設定が必要です。");
  if (!(provider === "apple" ? appleAvailable : googleAvailable))
    throw Error("このログイン方法はまだ利用できません。");
  const auth = await import("@react-native-firebase/auth");
  let credential;
  if (provider === "apple") {
    const apple = await import("expo-apple-authentication");
    const crypto = await import("expo-crypto");
    if (!(await apple.isAvailableAsync()))
      throw Error("この端末では Apple ログインを利用できません。");
    const rawNonce = crypto.randomUUID();
    const nonce = await crypto.digestStringAsync(
      crypto.CryptoDigestAlgorithm.SHA256,
      rawNonce,
    );
    const result = await apple.signInAsync({
      requestedScopes: [apple.AppleAuthenticationScope.EMAIL],
      nonce,
    });
    if (!result.identityToken)
      throw Error("Apple の認証情報を取得できませんでした。");
    credential = new auth.OAuthProvider("apple.com").credential({
      idToken: result.identityToken,
      rawNonce,
    });
  } else {
    const webClientId = Constants.expoConfig?.extra?.googleWebClientId;
    if (!webClientId) throw Error("Google ログインの設定が必要です。");
    const { GoogleSignin, isSuccessResponse } =
      await import("@react-native-google-signin/google-signin");
    GoogleSignin.configure({
      webClientId,
      iosClientId: Constants.expoConfig?.extra?.googleIosClientId,
    });
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const result = await GoogleSignin.signIn();
    if (!isSuccessResponse(result))
      throw Error("ログインをキャンセルしました。");
    credential = auth.GoogleAuthProvider.credential(result.data.idToken);
  }
  const instance = auth.getAuth();
  if (restore) await auth.signInWithCredential(instance, credential);
  else {
    const user =
      instance.currentUser ?? (await auth.signInAnonymously(instance)).user;
    try {
      await auth.linkWithCredential(user, credential);
    } catch (e) {
      if ((e as { code?: string }).code === "auth/credential-already-in-use")
        throw Error(
          "このアカウントには記録があります。「既存の記録を復元」を選んでください。",
        );
      throw e;
    }
  }
  return instance.currentUser?.uid;
}
export async function fetchAccountData(): Promise<Data> {
  const { getAuth } = await import("@react-native-firebase/auth");
  const { getFirestore, collection, getDocs, getDoc, doc } =
    await import("@react-native-firebase/firestore");
  const uid = getAuth().currentUser?.uid;
  if (!uid) throw Error("ログインが必要です。");
  const db = getFirestore(),
    root = `users/${uid}`;
  const result = createData();
  const [profile, review, state, plans, diagnoses, backups] = await Promise.all(
    [
      getDoc(doc(db, root)),
      getDocs(collection(db, `${root}/reviewEvents`)),
      getDocs(collection(db, `${root}/stateEvents`)),
      getDocs(collection(db, `${root}/dailyPlans`)),
      getDocs(collection(db, `${root}/diagnostics`)),
      getDocs(collection(db, `${root}/deviceBackups`)),
    ],
  );
  if (profile.exists())
    for (const key of Object.keys(result.settings))
      if (profile.data()?.[key] !== undefined)
        (result.settings as any)[key] = profile.data()![key];
  result.events = [...review.docs, ...state.docs].map((d) => d.data() as Event);
  for (const record of plans.docs) {
    const p = record.data() as Data["plans"][string];
    result.plans[p.date] = result.plans[p.date]
      ? mergePlan(result.plans[p.date], p)
      : p;
  }
  result.diagnostics = diagnoses.docs.map(
    (d) => d.data() as Data["diagnostics"][number],
  );
  const latest = backups.docs.sort(
    (a, b) =>
      (b.data().updatedAt?.toMillis?.() ?? 0) -
      (a.data().updatedAt?.toMillis?.() ?? 0),
  )[0];
  result.queue = latest?.data().queue ?? [];
  return result;
}
