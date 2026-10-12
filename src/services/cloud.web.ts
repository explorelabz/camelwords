import type { Data } from "../domain/types";
export const cloudAvailable = false;
export async function syncCloud(_data: Data): Promise<string[]> {
  return [];
}
export async function deleteCloudAccount() {
  throw new Error("アカウントの操作はネイティブアプリで行ってください。");
}
