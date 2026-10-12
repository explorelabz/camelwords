import { test } from "node:test";
import assert from "node:assert/strict";
import { createData } from "../src/domain/types";
import { rate, ensurePlan, changeState } from "../src/domain/engine";
import { mergeLearningData, replayWord } from "../src/domain/merge";
import { words } from "../src/content/catalog";
const now = new Date("2026-10-07T03:00:00Z");
test("server replay matches local first/repeat/final scheduling and deduplicates", () => {
  const d = createData();
  d.settings.algorithm = "sm2";
  const p = ensurePlan(d, words, now);
  const key = p.pending[0];
  rate(d, words, "AGAIN", now);
  p.pending = [key];
  rate(d, words, "GOOD", new Date(+now + 1000));
  assert.deepEqual(replayWord([...d.events, ...d.events]), d.states[key]);
});
test("late delivery of an older review cannot resurrect a mastered word", () => {
  const d = createData();
  ensurePlan(d, words, now);
  rate(d, words, "GOOD", now);
  changeState(d, "appointment", "MASTER", new Date(+now + 2000));
  assert.equal(replayWord([...d.events].reverse())?.status, "MASTERED");
});
test("account merge retains both devices completed cards and avoids duplicate events", () => {
  const a = createData(),
    b = createData();
  const pa = ensurePlan(a, words, now);
  const pb = ensurePlan(b, words, now);
  rate(a, words, "GOOD", now);
  const key = pb.pending[1];
  pb.pending = [key];
  rate(b, words, "GOOD", new Date(+now + 1000));
  const merged = mergeLearningData(a, b);
  assert.equal(merged.events.length, 2);
  assert.equal(merged.plans[pa.date].items.filter((i) => i.done).length, 2);
  assert.ok(!merged.plans[pa.date].pending.includes(key));
  assert.equal(mergeLearningData(merged, b).events.length, 2);
  assert.deepEqual(
    merged.outbox,
    a.events.map((e) => e.id),
  );
});
