import type { Data } from "../domain/types";
// Web is a development preview only. Native builds use SQLite transactions.
export async function load(): Promise<Data | null> {
  const raw = localStorage.getItem("camelwords-v1");
  return raw ? JSON.parse(raw) : null;
}
export async function save(data: Data) {
  localStorage.setItem("camelwords-v1", JSON.stringify(data));
}
