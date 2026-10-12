import { algorithmVersion, retrievability, schedule } from "./scheduler";
import type {
  Data,
  Event,
  Plan,
  PlanItem,
  Rating,
  Word,
  WordState,
} from "./types";
const DAY = 86400000;
// JST has no daylight-saving transitions; shifting by +5h implements 04:00 JST.
export const studyDay = (now = new Date()) =>
  new Date(+now + 5 * 3600000).toISOString().slice(0, 10);
export const nextBoundary = (now: Date) =>
  new Date(Date.parse(studyDay(now) + "T19:00:00Z"));
export const uid = () =>
  globalThis.crypto?.randomUUID?.() ??
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
export function newCandidates(
  d: Data,
  words: Word[],
  excluded = new Set<string>(),
): string[] {
  const valid = new Set(words.map((w) => w.key));
  const wrong = new Set(d.diagnostics.flatMap((x) => x.wrong));
  const level = Number(d.settings.activeBook.replace("toeic-", ""));
  const remedial = words
    .filter((w) => wrong.has(w.key) && w.level > 0 && w.level <= level)
    .map((w) => w.key);
  const ordered = [
    ...remedial,
    ...words.filter((w) => w.book === d.settings.activeBook).map((w) => w.key),
  ];
  return [
    ...new Set([...d.queue, ...(d.settings.autoFill ? ordered : [])]),
  ].filter((k) => valid.has(k) && !d.states[k] && !excluded.has(k));
}
export function ensurePlan(d: Data, words: Word[], now = new Date()): Plan {
  const date = studyDay(now);
  if (d.plans[date]) return d.plans[date];
  const valid = new Set(words.map((w) => w.key));
  const due = Object.entries(d.states)
    .filter(
      ([k, s]) =>
        valid.has(k) &&
        ["LEARNING", "REVIEW"].includes(s.status) &&
        Date.parse(s.nextReviewAt) < +nextBoundary(now),
    )
    .sort((a, b) => retrievability(a[1], now) - retrievability(b[1], now));
  if (due.length > d.settings.dailyLimit * 3) d.backlogPaused = true;
  else if (due.length <= d.settings.dailyLimit) d.backlogPaused = false;
  const review = due
    .slice(0, d.settings.dailyLimit)
    .map(([key]) => item(key, "REVIEW", "AUTO"));
  const cap = d.backlogPaused
    ? 0
    : Math.min(d.settings.newCap, d.settings.dailyLimit - review.length);
  const news = newCandidates(d, words)
    .slice(0, cap)
    .map((k) => item(k, "NEW", d.queue.includes(k) ? "QUEUE" : "AUTO"));
  const items = [...review, ...news];
  return (d.plans[date] = {
    date,
    items,
    pending: items.map((i) => i.key),
    startedNew: false,
    createdAt: now.toISOString(),
  });
}
const item = (
  key: string,
  type: PlanItem["type"],
  source: PlanItem["source"],
): PlanItem => ({
  key,
  type,
  source,
  done: false,
  attempts: 0,
  hardRepeated: false,
});
export function appendExtra(
  d: Data,
  words: Word[],
  count: number,
  now = new Date(),
) {
  const p = ensurePlan(d, words, now);
  const keys = newCandidates(
    d,
    words,
    new Set(p.items.map((i) => i.key)),
  ).slice(0, count);
  p.items.push(...keys.map((k) => item(k, "NEW", "EXTRA")));
  p.pending.push(...keys);
  return keys.length;
}
function pushEvent(d: Data, e: Omit<Event, "id" | "algorithmVersion">) {
  const event = {
    ...e,
    id: uid(),
    algorithmVersion: algorithmVersion(e.algorithm),
  };
  d.events.push(event);
  d.outbox.push(event.id);
  return event;
}
export function rate(d: Data, words: Word[], rating: Rating, now = new Date()) {
  const p = ensurePlan(d, words, now);
  const key = p.pending.shift();
  if (!key) return;
  const it = p.items.find((i) => i.key === key)!;
  const before = d.states[key] ?? null;
  if (it.type === "NEW") p.startedNew = true;
  // Repeats only advance long-term parameters on the final GOOD; replay from
  // the state before this word's first attempt, avoiding double interval growth.
  const first = d.events.find(
    (e) =>
      e.kind === "review" &&
      e.wordKey === key &&
      studyDay(new Date(e.clientReviewedAt)) === p.date,
  );
  const update = it.attempts === 0 || rating === "GOOD";
  const after = update
    ? schedule(first ? first.before : before, rating, now, d.settings.algorithm)
    : {
        ...before!,
        lastReviewAt: now.toISOString(),
        reviewCount: (before?.reviewCount ?? 0) + 1,
      };
  after.reviewCount = (before?.reviewCount ?? 0) + 1;
  after.lapseCount = (before?.lapseCount ?? 0) + (rating === "AGAIN" ? 1 : 0);
  d.states[key] = after;
  pushEvent(d, {
    kind: "review",
    wordKey: key,
    rating,
    clientReviewedAt: now.toISOString(),
    algorithm: d.settings.algorithm,
    before,
    after,
    reviewType: it.attempts ? "RELEARN_SAME_DAY" : it.type,
  });
  it.attempts++;
  if (rating === "GOOD" || (rating === "HARD" && it.hardRepeated)) {
    it.done = true;
    d.queue = d.queue.filter((k) => k !== key);
  } else {
    const gap = rating === "AGAIN" ? 8 : 20;
    p.pending.splice(Math.min(gap, p.pending.length), 0, key);
    if (rating === "HARD") it.hardRepeated = true;
  }
}
export function changeState(
  d: Data,
  key: string,
  action: "MASTER" | "PREFILTER" | "RESTORE" | "REMOVE",
  now = new Date(),
) {
  const before = d.states[key] ?? null;
  let after: WordState | null = null;
  if (action === "RESTORE") {
    if (before?.reviewCount)
      after = { ...before, status: "REVIEW", nextReviewAt: now.toISOString() };
    else {
      delete d.states[key];
      d.queue = [key, ...d.queue.filter((k) => k !== key)];
    }
  } else
    after = {
      ...(before ?? {
        algorithm: d.settings.algorithm,
        card: {},
        intervalDays: 0,
        nextReviewAt: now.toISOString(),
        lastReviewAt: now.toISOString(),
        reviewCount: 0,
        lapseCount: 0,
      }),
      status: action === "REMOVE" ? "REMOVED" : "MASTERED",
      ...(action === "REMOVE"
        ? {}
        : {
            masteredSource:
              action === "PREFILTER"
                ? ("PRE_FILTER" as const)
                : ("IN_STUDY" as const),
          }),
    };
  if (after) d.states[key] = after;
  if (action !== "RESTORE") {
    d.queue = d.queue.filter((k) => k !== key);
    const p = d.plans[studyDay(now)];
    if (p) {
      p.pending = p.pending.filter((k) => k !== key);
      const i = p.items.find((i) => i.key === key);
      if (i) i.done = true;
    }
  }
  return pushEvent(d, {
    kind: "state",
    wordKey: key,
    action,
    clientReviewedAt: now.toISOString(),
    algorithm: d.settings.algorithm,
    before,
    after,
  });
}
export function addQueue(
  d: Data,
  keys: string[],
  words: Word[],
  now = new Date(),
) {
  const valid = new Set(words.map((w) => w.key));
  for (const key of keys)
    if (valid.has(key) && !d.states[key] && !d.queue.includes(key)) {
      d.queue.push(key);
      pushEvent(d, {
        kind: "state",
        wordKey: key,
        action: "QUEUE_ADD",
        clientReviewedAt: now.toISOString(),
        algorithm: d.settings.algorithm,
        before: null,
        after: null,
      });
    }
  const p = d.plans[studyDay(now)];
  if (p && !p.startedNew) {
    const reviews = p.items.filter((i) => i.type === "REVIEW" || i.done);
    const slots = p.items.filter((i) => i.type === "NEW" && !i.done).length;
    const news = newCandidates(d, words, new Set(reviews.map((i) => i.key)))
      .slice(0, slots)
      .map((k) => item(k, "NEW", d.queue.includes(k) ? "QUEUE" : "AUTO"));
    p.items = [...reviews, ...news];
    p.pending = [
      ...p.pending.filter((k) => reviews.some((i) => i.key === k)),
      ...news.map((i) => i.key),
    ];
  }
}
export interface MasterUndo {
  key: string;
  eventId: string;
  state: WordState | null;
  date: string;
  item: PlanItem | null;
  pendingIndex: number;
  queueIndex: number;
}
export function masterWithUndo(
  d: Data,
  key: string,
  now = new Date(),
): MasterUndo {
  const p = d.plans[studyDay(now)];
  const undo = {
    key,
    eventId: "",
    state: d.states[key] ? JSON.parse(JSON.stringify(d.states[key])) : null,
    date: studyDay(now),
    item: p?.items.find((i) => i.key === key)
      ? { ...p.items.find((i) => i.key === key)! }
      : null,
    pendingIndex: p?.pending.indexOf(key) ?? -1,
    queueIndex: d.queue.indexOf(key),
  };
  undo.eventId = changeState(d, key, "MASTER", now).id;
  return undo;
}
export function undoMaster(d: Data, u: MasterUndo, now = new Date()) {
  // Only reverse this word. Other answers and queue changes stay intact.
  const last = d.events.filter((e) => e.wordKey === u.key).at(-1);
  if (last?.id !== u.eventId) return false;
  const before = d.states[u.key] ?? null;
  if (u.state) d.states[u.key] = u.state;
  else delete d.states[u.key];
  const p = d.plans[u.date];
  const i = p?.items.findIndex((i) => i.key === u.key) ?? -1;
  if (p && u.item && i >= 0) {
    p.items[i] = { ...u.item };
    if (u.pendingIndex >= 0 && !p.pending.includes(u.key))
      p.pending.splice(Math.min(u.pendingIndex, p.pending.length), 0, u.key);
  }
  if (u.queueIndex >= 0 && !d.queue.includes(u.key))
    d.queue.splice(Math.min(u.queueIndex, d.queue.length), 0, u.key);
  pushEvent(d, {
    kind: "state",
    wordKey: u.key,
    action: "UNDO_MASTER",
    clientReviewedAt: now.toISOString(),
    algorithm: d.settings.algorithm,
    before,
    after: u.state,
  });
  return true;
}
export function removeQueue(d: Data, key: string, now = new Date()) {
  if (!d.queue.includes(key)) return;
  d.queue = d.queue.filter((k) => k !== key);
  pushEvent(d, {
    kind: "state",
    wordKey: key,
    action: "QUEUE_REMOVE",
    clientReviewedAt: now.toISOString(),
    algorithm: d.settings.algorithm,
    before: null,
    after: null,
  });
}
export function moveQueue(
  d: Data,
  key: string,
  offset: number,
  now = new Date(),
) {
  const from = d.queue.indexOf(key);
  if (from < 0) return;
  const to = Math.max(0, Math.min(d.queue.length - 1, from + offset));
  if (to === from) return;
  d.queue.splice(from, 1);
  d.queue.splice(to, 0, key);
  pushEvent(d, {
    kind: "state",
    wordKey: key,
    action: "QUEUE_REORDER",
    clientReviewedAt: now.toISOString(),
    algorithm: d.settings.algorithm,
    before: null,
    after: null,
  });
}
export function completedDays(d: Data) {
  return Object.values(d.plans)
    .filter((p) => p.items.length > 0 && p.items.every((i) => i.done))
    .map((p) => p.date);
}
export function streak(d: Data, now = new Date()) {
  const days = new Set(completedDays(d));
  let cursor = new Date(studyDay(now) + "T12:00:00Z");
  if (!days.has(studyDay(cursor))) cursor = new Date(+cursor - DAY);
  let count = 0;
  while (days.has(cursor.toISOString().slice(0, 10))) {
    count++;
    cursor = new Date(+cursor - DAY);
  }
  return count;
}
