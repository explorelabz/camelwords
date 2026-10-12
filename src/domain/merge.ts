import type { Data, Event, Plan, WordState } from "./types";
import { schedule } from "./scheduler";
import { studyDay } from "./engine";
export function replayWord(input: Event[]): WordState | null {
  const events = [...new Map(input.map((e) => [e.id, e])).values()].sort(
    (a, b) =>
      a.clientReviewedAt.localeCompare(b.clientReviewedAt) ||
      a.id.localeCompare(b.id),
  );
  let value: WordState | null = null,
    first: WordState | null = null,
    day = "",
    seen = false;
  for (const e of events) {
    if (e.kind === "state") {
      if (
        ["MASTER", "PREFILTER", "REMOVE", "UNDO_MASTER"].includes(
          e.action ?? "",
        )
      )
        value = e.after;
      else if (e.action === "RESTORE") {
        const old = value as WordState | null;
        value = old?.reviewCount
          ? { ...old, status: "REVIEW", nextReviewAt: e.clientReviewedAt }
          : null;
      }
      if (!e.action?.startsWith("QUEUE_")) {
        first = value;
        seen = false;
        day = studyDay(new Date(e.clientReviewedAt));
      }
      continue;
    }
    if (value?.status === "MASTERED" || value?.status === "REMOVED") continue;
    const now = new Date(e.clientReviewedAt);
    if (!Number.isFinite(+now) || !e.rating) continue;
    if (studyDay(now) !== day) {
      day = studyDay(now);
      first = value;
      seen = false;
    }
    const count = value?.reviewCount ?? 0,
      lapses = value?.lapseCount ?? 0;
    if (!seen || e.rating === "GOOD")
      value = schedule(first, e.rating, now, e.algorithm);
    if (value)
      value = {
        ...value,
        lastReviewAt: e.clientReviewedAt,
        reviewCount: count + 1,
        lapseCount: lapses + Number(e.rating === "AGAIN"),
      };
    seen = true;
  }
  return value;
}
export function mergePlan(a: Plan, b: Plan): Plan {
  const primary = a.createdAt <= b.createdAt ? a : b,
    secondary = primary === a ? b : a;
  const items = primary.items.map((i) => {
    const other = secondary.items.find((o) => o.key === i.key);
    return other
      ? {
          ...i,
          done: i.done || other.done,
          attempts: Math.max(i.attempts, other.attempts),
          hardRepeated: i.hardRepeated || other.hardRepeated,
        }
      : { ...i };
  });
  for (const item of secondary.items)
    if (!items.some((i) => i.key === item.key)) items.push({ ...item });
  const unfinished = new Set(items.filter((i) => !i.done).map((i) => i.key));
  return {
    ...primary,
    items,
    startedNew: a.startedNew || b.startedNew,
    pending: [...new Set([...a.pending, ...b.pending, ...unfinished])].filter(
      (k) => unfinished.has(k),
    ),
  };
}
export function mergeLearningData(local: Data, remote: Data): Data {
  const merged: Data = JSON.parse(JSON.stringify(local));
  merged.events = [
    ...new Map(
      [...remote.events, ...local.events].map((e) => [e.id, e]),
    ).values(),
  ].sort(
    (a, b) =>
      a.clientReviewedAt.localeCompare(b.clientReviewedAt) ||
      a.id.localeCompare(b.id),
  );
  merged.states = {};
  for (const key of new Set(merged.events.map((e) => e.wordKey))) {
    const value = replayWord(merged.events.filter((e) => e.wordKey === key));
    if (value) merged.states[key] = value;
  }
  merged.queue = [...new Set([...local.queue, ...remote.queue])].filter(
    (k) => !merged.states[k],
  );
  merged.diagnostics = [
    ...new Map(
      [...remote.diagnostics, ...local.diagnostics].map((d) => [d.id, d]),
    ).values(),
  ].sort((a, b) => a.at.localeCompare(b.at));
  for (const [date, plan] of Object.entries(remote.plans))
    merged.plans[date] = merged.plans[date]
      ? mergePlan(merged.plans[date], plan)
      : plan;
  for (const plan of Object.values(merged.plans)) {
    for (const item of plan.items)
      if (["MASTERED", "REMOVED"].includes(merged.states[item.key]?.status))
        item.done = true;
    plan.pending = plan.pending.filter(
      (k) => !plan.items.find((i) => i.key === k)?.done,
    );
  }
  // Re-upload local events after account migration; existing IDs remain idempotent.
  const remoteIds = new Set(remote.events.map((e) => e.id));
  merged.outbox = merged.events
    .filter((e) => !remoteIds.has(e.id))
    .map((e) => e.id);
  return merged;
}
