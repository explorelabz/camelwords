import { test } from "node:test";
import assert from "node:assert/strict";
import { createData } from "../src/domain/types";
import {
  addQueue,
  appendExtra,
  changeState,
  ensurePlan,
  nextBoundary,
  rate,
  studyDay,
  masterWithUndo,
  undoMaster,
  removeQueue,
  moveQueue,
} from "../src/domain/engine";
import { schedule } from "../src/domain/scheduler";
import { words } from "../src/content/catalog";
const now = new Date("2026-10-07T03:00:00Z");
test("JST day boundary is exactly 04:00", () => {
  assert.equal(studyDay(new Date("2026-10-06T18:59:59Z")), "2026-10-06");
  assert.equal(studyDay(new Date("2026-10-06T19:00:00Z")), "2026-10-07");
  assert.equal(nextBoundary(now).toISOString(), "2026-10-07T19:00:00.000Z");
});
test("first day respects new cap, preserves a fixed plan", () => {
  const d = createData();
  const p = ensurePlan(d, words, now);
  assert.equal(p.items.length, 30);
  d.settings.dailyLimit = 150;
  assert.equal(ensurePlan(d, words, now), p);
});
test("cross-book manual selections take precedence, deduplicate, and create no memory state", () => {
  const d = createData();
  addQueue(d, ["negotiate", "negotiate"], words, now);
  const p = ensurePlan(d, words, now);
  assert.equal(p.items[0].key, "negotiate");
  assert.equal(d.queue.length, 1);
  assert.equal(d.states.negotiate, undefined);
});
test("due LEARNING and REVIEW both enter plan, MASTERED is excluded", () => {
  const d = createData();
  d.states.appointment = schedule(
    null,
    "AGAIN",
    new Date(+now - 86400000),
    "fsrs",
  );
  d.states.confirm = schedule(
    null,
    "GOOD",
    new Date(+now - 86400000 * 60),
    "sm2",
  );
  changeState(d, "available", "MASTER", now);
  const p = ensurePlan(d, words, now);
  assert.equal(p.items.filter((i) => i.type === "REVIEW").length, 2);
  assert.ok(!p.pending.includes("available"));
});
test("mastering completes original plan item without backfilling", () => {
  const d = createData();
  const p = ensurePlan(d, words, now);
  const n = p.items.length;
  changeState(d, p.pending[0], "MASTER", now);
  assert.equal(p.items.length, n);
  assert.equal(p.items.filter((i) => i.done).length, 1);
  assert.equal(d.events[0].kind, "state");
});
test("AGAIN repeats +8; repeated answers do not grow SM2 interval twice", () => {
  const d = createData();
  d.settings.algorithm = "sm2";
  const p = ensurePlan(d, words, now);
  const key = p.pending[0];
  rate(d, words, "AGAIN", now);
  assert.equal(p.pending[8], key);
  p.pending = [key];
  rate(d, words, "GOOD", new Date(+now + 10000));
  assert.equal(d.states[key].card.repetitions, 1);
  assert.equal(d.states[key].reviewCount, 2);
  assert.equal(d.events[1].reviewType, "RELEARN_SAME_DAY");
});
test("HARD repeats once, then can finish, GOOD does not imply MASTERED", () => {
  const d = createData();
  const p = ensurePlan(d, words, now);
  const key = p.pending[0];
  rate(d, words, "HARD", now);
  assert.equal(p.pending[20], key);
  p.pending = [key];
  rate(d, words, "HARD", new Date(+now + 10000));
  assert.equal(p.pending.length, 0);
  assert.equal(p.items[0].done, true);
  assert.notEqual(d.states[key].status, "MASTERED");
});
test("prefilter restore goes back to new pool and queue front", () => {
  const d = createData();
  changeState(d, "invoice", "PREFILTER", now);
  changeState(d, "invoice", "RESTORE", now);
  assert.equal(d.states.invoice, undefined);
  assert.equal(d.queue[0], "invoice");
});
test("manual selections replace auto items only before new learning starts", () => {
  const d = createData();
  const p = ensurePlan(d, words, now);
  addQueue(d, ["negotiate"], words, now);
  assert.equal(p.items[0].key, "negotiate");
  rate(d, words, "GOOD", now);
  const original = p.pending.slice();
  addQueue(d, ["mitigate"], words, now);
  assert.deepEqual(p.pending, original);
  assert.ok(d.queue.includes("mitigate"));
});
test("auto fill off only uses queued words; explicit extra never duplicates", () => {
  const d = createData();
  d.settings.autoFill = false;
  addQueue(d, ["invoice"], words, now);
  const p = ensurePlan(d, words, now);
  assert.equal(p.items.length, 1);
  assert.equal(appendExtra(d, words, 10, now), 0);
});
test("backlog threshold persists until <= daily limit", () => {
  const d = createData();
  d.settings.dailyLimit = 10;
  for (const w of words.slice(0, 32))
    d.states[w.key] = schedule(
      null,
      "GOOD",
      new Date(+now - 100 * 86400000),
      "sm2",
    );
  let p = ensurePlan(d, words, now);
  assert.equal(d.backlogPaused, true);
  assert.ok(p.items.every((i) => i.type === "REVIEW"));
  for (const w of words.slice(0, 12)) delete d.states[w.key];
  p = ensurePlan(d, words, new Date(+now + 86400000));
  assert.equal(d.backlogPaused, true);
  for (const w of words.slice(12, 25)) delete d.states[w.key];
  ensurePlan(d, words, new Date(+now + 2 * 86400000));
  assert.equal(d.backlogPaused, false);
});
test("FSRS output survives JSON serialization", () => {
  const first = schedule(null, "GOOD", now, "fsrs");
  const next = schedule(
    JSON.parse(JSON.stringify(first)),
    "GOOD",
    new Date(+now + 86400000 * 7),
    "fsrs",
  );
  assert.ok(Number.isFinite(Date.parse(next.nextReviewAt)));
  assert.ok(next.card.stability > 0);
});

test("undo mastered preserves answers and queue edits made afterward", () => {
  const d = createData();
  addQueue(d, ["appointment", "negotiate"], words, now);
  const p = ensurePlan(d, words, now);
  const u = masterWithUndo(d, "appointment", now);
  const next = p.pending[0];
  rate(d, words, "GOOD", new Date(+now + 1000));
  addQueue(d, ["mitigate"], words, now);
  assert.ok(undoMaster(d, u, new Date(+now + 2000)));
  assert.equal(d.states.appointment, undefined);
  assert.ok(p.items.find((i) => i.key === next)?.done);
  assert.ok(d.queue.includes("mitigate"));
  assert.equal(d.events.at(-1)?.action, "UNDO_MASTER");
});
test("undo refuses to overwrite a newer change to the same word", () => {
  const d = createData();
  ensurePlan(d, words, now);
  const u = masterWithUndo(d, "appointment", now);
  changeState(d, "appointment", "REMOVE", new Date(+now + 1));
  assert.equal(undoMaster(d, u, now), false);
  assert.equal(d.states.appointment.status, "REMOVED");
});
test("queue edits produce immutable state events without changing memory state", () => {
  const d = createData();
  addQueue(d, ["appointment", "negotiate"], words, now);
  moveQueue(d, "negotiate", -1, now);
  assert.equal(d.queue[0], "negotiate");
  removeQueue(d, "negotiate", now);
  assert.deepEqual(d.queue, ["appointment"]);
  assert.equal(d.events.at(-1)?.action, "QUEUE_REMOVE");
  assert.deepEqual(d.states, {});
});

test("diagnostic mistakes from lower levels lead the selected book", () => {
  const d = createData();
  d.settings.activeBook = "toeic-730";
  d.diagnostics.push({
    id: "d1",
    at: now.toISOString(),
    correct: 20,
    total: 40,
    recommendedBook: "toeic-730",
    wrong: ["appointment"],
  });
  const p = ensurePlan(d, words, now);
  assert.equal(p.pending[0], "appointment");
});
