import { create } from "zustand";
import { createData, type Data } from "./domain/types";
import { ensurePlan, uid } from "./domain/engine";
import { words } from "./content/catalog";
import { load, save } from "./services/persistence";
import {
  cloudAvailable,
  syncCloud,
  deleteCloudAccount,
} from "./services/cloud";
import {
  connectAccount,
  fetchAccountData,
  type Provider,
} from "./services/accounts";
import { mergeLearningData } from "./domain/merge";
type Store = {
  data: Data;
  ready: boolean;
  busy: boolean;
  error: string | null;
  syncStatus: string;
  init: () => Promise<void>;
  mutate: (fn: (d: Data) => void) => Promise<void>;
  sync: () => Promise<void>;
  eraseAccount: () => Promise<void>;
  connect: (provider: Provider, restore: boolean) => Promise<void>;
  clearError: () => void;
};
let chain = Promise.resolve();
let syncing = false;
let syncAgain = false;
let deleting = false;
let syncFinished: Promise<void> = Promise.resolve();
let finishSync: (() => void) | undefined;
export const useApp = create<Store>((set, get) => ({
  data: createData(),
  ready: false,
  busy: false,
  error: null,
  syncStatus: cloudAvailable ? "同期待ち" : "この端末に保存",
  init: async () => {
    try {
      const data = (await load()) ?? createData();
      data.deviceId ||= uid();
      ensurePlan(data, words);
      await save(data);
      set({ data, ready: true });
      void get().sync();
    } catch (e) {
      set({ error: `保存データを読み込めませんでした: ${String(e)}` });
    }
  },
  mutate: (fn) => {
    const operation = chain.then(async () => {
      if (deleting) throw new Error("アカウントを削除しています");
      set({ busy: true });
      const data = JSON.parse(JSON.stringify(get().data)) as Data;
      try {
        fn(data);
        await save(data);
        set({ data, error: null });
      } catch (e) {
        set({
          error: `保存できませんでした。もう一度お試しください。 ${String(e)}`,
        });
        throw e;
      } finally {
        set({ busy: false });
      }
    });
    chain = operation.catch(() => {});
    return operation;
  },
  sync: async () => {
    if (deleting || !cloudAvailable) return;
    if (syncing) {
      syncAgain = true;
      return;
    }
    syncFinished = new Promise((resolve) => {
      finishSync = resolve;
    });
    syncing = true;
    set({ syncStatus: "同期中…" });
    try {
      const ack = await syncCloud(get().data);
      await get().mutate((d) => {
        d.outbox = d.outbox.filter((id) => !ack.includes(id));
      });
      set({ syncStatus: "同期済み" });
    } catch {
      set({ syncStatus: "未同期・端末に保存済み" });
    } finally {
      syncing = false;
      finishSync?.();
      if (syncAgain) {
        syncAgain = false;
        void get().sync();
      }
    }
  },
  connect: async (provider, restore) => {
    if (deleting) throw Error("処理中です");
    deleting = true;
    set({ busy: true });
    try {
      await syncFinished;
      await chain;
      const local = JSON.parse(JSON.stringify(get().data)) as Data;
      local.outbox = local.events.map((e) => e.id);
      await save(local);
      set({ data: local });
      await connectAccount(provider, restore);
      const remote = await fetchAccountData();
      const data = mergeLearningData(local, remote);
      if (!local.events.length && !local.queue.length)
        data.settings = remote.settings;
      ensurePlan(data, words);
      await save(data);
      set({ data, error: null, syncStatus: "アカウント連携済み" });
    } finally {
      deleting = false;
      set({ busy: false });
    }
    await get().sync();
  },
  eraseAccount: async () => {
    if (deleting) return;
    deleting = true;
    set({ busy: true });
    try {
      await syncFinished;
      await chain;
      await deleteCloudAccount();
      const data = createData();
      data.deviceId = uid();
      ensurePlan(data, words);
      await save(data);
      set({ data, error: null, syncStatus: "アカウントを削除しました" });
    } finally {
      deleting = false;
      set({ busy: false });
    }
  },
  clearError: () => set({ error: null }),
}));
