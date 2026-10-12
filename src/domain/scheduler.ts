import { createEmptyCard, fsrs, Rating as FRating, State } from "ts-fsrs";
import type { Algorithm, Rating, WordState } from "./types";
const day = 86400000;
const f = fsrs({
  request_retention: 0.9,
  enable_fuzz: false,
  enable_short_term: true,
});
export const algorithmVersion = (id: Algorithm) =>
  id === "fsrs" ? "ts-fsrs-5" : "sm2-1";
export function schedule(
  previous: WordState | null,
  rating: Rating,
  now: Date,
  algorithm: Algorithm,
): WordState {
  let card: Record<string, any>, intervalDays: number, due: Date;
  if (algorithm === "fsrs") {
    const raw = previous?.algorithm === "fsrs" ? previous.card : null;
    const base = raw
      ? {
          ...raw,
          due: new Date(raw.due),
          last_review: raw.last_review ? new Date(raw.last_review) : undefined,
        }
      : createEmptyCard(now);
    const mapping = {
      AGAIN: FRating.Again,
      HARD: FRating.Hard,
      GOOD: FRating.Good,
    } as const;
    const next = f.next(base as any, now, mapping[rating]);
    card = {
      ...next.card,
      due: next.card.due.toISOString(),
      last_review: next.card.last_review?.toISOString(),
    };
    intervalDays = next.card.scheduled_days;
    due = next.card.due;
  } else {
    const old = previous?.algorithm === "sm2" ? previous.card : {};
    const q = { AGAIN: 1, HARD: 3, GOOD: 4 }[rating];
    const ease = Math.max(
      1.3,
      (old.easeFactor ?? 2.5) + 0.1 - (5 - q) * (0.08 + (5 - q) * 0.02),
    );
    const reps = q < 3 ? 0 : (old.repetitions ?? 0) + 1;
    intervalDays =
      q < 3
        ? 1
        : reps === 1
          ? 1
          : reps === 2
            ? 6
            : Math.round((previous?.intervalDays ?? 1) * ease);
    due = new Date(+now + intervalDays * day);
    card = { easeFactor: ease, repetitions: reps };
  }
  return {
    status: rating === "AGAIN" || intervalDays < 1 ? "LEARNING" : "REVIEW",
    algorithm,
    card,
    intervalDays,
    nextReviewAt: due.toISOString(),
    lastReviewAt: now.toISOString(),
    reviewCount: (previous?.reviewCount ?? 0) + 1,
    lapseCount: (previous?.lapseCount ?? 0) + (rating === "AGAIN" ? 1 : 0),
  };
}
export function retrievability(s: WordState, now: Date): number {
  if (s.algorithm === "fsrs" && s.card.state !== State.New) {
    return f.get_retrievability(
      {
        ...s.card,
        due: new Date(s.card.due),
        last_review: new Date(s.card.last_review),
      } as any,
      now,
      false,
    ) as number;
  }
  return Math.exp(
    -Math.max(0, +now - Date.parse(s.lastReviewAt)) /
      (Math.max(1, s.intervalDays) * day),
  );
}
