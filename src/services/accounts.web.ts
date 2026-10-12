import type { Data } from "../domain/types";
export type Provider = "apple" | "google";
export const googleAvailable = false;
export const appleAvailable = false;
export async function connectAccount(_provider: Provider, _restore = false) {
  throw Error("アカウント連携はネイティブアプリで利用できます。");
}
export async function fetchAccountData(): Promise<Data> {
  throw Error("アカウント連携はネイティブアプリで利用できます。");
}
