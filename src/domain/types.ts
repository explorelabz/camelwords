export type Rating = "AGAIN" | "HARD" | "GOOD";
export type Status = "LEARNING" | "REVIEW" | "MASTERED" | "REMOVED";
export type Algorithm = "fsrs" | "sm2";
export interface Word {
  key: string;
  lemma: string;
  meaning: string;
  ipa: string;
  pos: string;
  en: string;
  ja: string;
  level: number;
  book: string;
  unit: string;
  forms?: string;
  note?: string;
}
export interface WordState {
  status: Status;
  algorithm: Algorithm;
  card: Record<string, any>;
  intervalDays: number;
  nextReviewAt: string;
  lastReviewAt: string;
  reviewCount: number;
  lapseCount: number;
  masteredSource?: "IN_STUDY" | "PRE_FILTER";
}
export interface Settings {
  activeBook: string;
  dailyLimit: number;
  newCap: number;
  autoFill: boolean;
  accent: "en-US" | "en-GB";
  autoAudio: boolean;
  algorithm: Algorithm;
  reminder: string | null;
}
export interface PlanItem {
  key: string;
  type: "NEW" | "REVIEW";
  source: "QUEUE" | "AUTO" | "EXTRA";
  done: boolean;
  attempts: number;
  hardRepeated: boolean;
}
export interface Plan {
  date: string;
  items: PlanItem[];
  pending: string[];
  startedNew: boolean;
  createdAt: string;
}
export interface Event {
  id: string;
  kind: "review" | "state";
  wordKey: string;
  action?: string;
  rating?: Rating;
  clientReviewedAt: string;
  algorithm: Algorithm;
  algorithmVersion: string;
  before: WordState | null;
  after: WordState | null;
  reviewType?: string;
}
export interface Diagnostic {
  id: string;
  at: string;
  correct: number;
  total: number;
  recommendedBook: string;
  wrong: string[];
}
export interface Data {
  settings: Settings;
  states: Record<string, WordState>;
  queue: string[];
  plans: Record<string, Plan>;
  events: Event[];
  outbox: string[];
  diagnostics: Diagnostic[];
  backlogPaused: boolean;
  deviceId: string;
}
export const defaults: Settings = {
  activeBook: "toeic-600",
  dailyLimit: 60,
  newCap: 30,
  autoFill: true,
  accent: "en-US",
  autoAudio: true,
  algorithm: "fsrs",
  reminder: null,
};
export const createData = (): Data => ({
  settings: { ...defaults },
  states: {},
  queue: [],
  plans: {},
  events: [],
  outbox: [],
  diagnostics: [],
  backlogPaused: false,
  deviceId: "",
});
