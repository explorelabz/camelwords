import type { ExpoConfig } from "expo/config";
import { existsSync, readFileSync } from "node:fs";
const nativeFirebase =
  existsSync("./google-services.json") &&
  existsSync("./GoogleService-Info.plist");
const androidConfig = existsSync("./google-services.json")
  ? JSON.parse(readFileSync("./google-services.json", "utf8"))
  : null;
const iosConfig = existsSync("./GoogleService-Info.plist")
  ? readFileSync("./GoogleService-Info.plist", "utf8")
  : "";
const iosField = (key: string) =>
  new RegExp("<key>" + key + "</key>\\s*<string>([^<]+)</string>").exec(
    iosConfig,
  )?.[1];
const googleWebClientId = androidConfig?.client
  ?.flatMap((c: any) => c.oauth_client ?? [])
  .find((c: any) => c.client_type === 3)?.client_id;
const googleIosClientId = iosField("CLIENT_ID");
const googleScheme = iosField("REVERSED_CLIENT_ID");
const appleSignInEnabled = false;
const config: ExpoConfig = {
  name: "CamelWords",
  slug: "camelwords",
  scheme: "camelwords",
  version: "0.1.0",
  icon: "./assets/icon.png",
  orientation: "portrait",
  userInterfaceStyle: "light",
  ios: {
    bundleIdentifier: "jp.camelwords.app",
    supportsTablet: true,
    usesAppleSignIn: appleSignInEnabled,
    ...(nativeFirebase
      ? { googleServicesFile: "./GoogleService-Info.plist" }
      : {}),
  },
  android: {
    package: "jp.camelwords.app",
    ...(nativeFirebase ? { googleServicesFile: "./google-services.json" } : {}),
  },
  web: { bundler: "metro", name: "CamelWords 開発プレビュー" },
  plugins: [
    // Entitlement mods run in reverse registration order; prune last.
    "./plugins/withLocalOnlyCapabilities",
    "expo-router",
    ...(appleSignInEnabled ? ["expo-apple-authentication"] : []),
    ...(googleScheme
      ? [
          [
            "@react-native-google-signin/google-signin",
            { iosUrlScheme: googleScheme },
          ] as any,
        ]
      : []),
    "expo-sqlite",
    "expo-notifications",
    ["expo-build-properties", { ios: { useFrameworks: "static" } }],
    ...(nativeFirebase
      ? ([
          ["@react-native-firebase/app", { ios: { disableSPM: true } }],
          "@react-native-firebase/crashlytics",
          [
            "@react-native-firebase/analytics",
            { ios: { withoutAdIdSupport: true } },
          ],
        ] as any[])
      : []),
  ],
  extra: {
    firebaseProjectId: "camelwords-881f8",
    nativeFirebase,
    googleSignInEnabled: false,
    appleSignInEnabled,
    googleWebClientId,
    googleIosClientId,
  },
};
export default config;
