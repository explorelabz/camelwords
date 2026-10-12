import React, { useEffect, useState } from "react";
import {
  View,
  ScrollView,
  Pressable,
  TextInput,
  Switch,
  Platform,
  ActivityIndicator,
  AppState,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Speech from "expo-speech";
import * as Haptics from "expo-haptics";
import { useApp } from "../src/store";
import { words, wordMap, books } from "../src/content/catalog";
import {
  addQueue,
  appendExtra,
  changeState,
  completedDays,
  ensurePlan,
  rate,
  streak,
  studyDay,
  uid,
  masterWithUndo,
  undoMaster as applyMasterUndo,
  removeQueue,
  moveQueue,
  type MasterUndo,
} from "../src/domain/engine";
import { C, T, s, Icon, Button, Card, Chip, Ring, Brand } from "../src/ui";
import type { Data, Rating, Word } from "../src/domain/types";
import { setReminder } from "../src/services/reminders";
import { cloudAvailable } from "../src/services/cloud";

import { appleAvailable, googleAvailable } from "../src/services/accounts";
type Screen =
  | "home"
  | "books"
  | "book"
  | "queue"
  | "study"
  | "done"
  | "diagnostic"
  | "result"
  | "prefilter"
  | "word"
  | "records"
  | "settings";
const statusLabel = (status?: string) =>
  ({ MASTERED: "熟識", LEARNING: "学習中", REVIEW: "復習中", REMOVED: "除外" })[
    status ?? ""
  ] ?? "未学習";
export default function App() {
  const {
    data: d,
    ready,
    busy,
    error,
    syncStatus,
    init,
    mutate,
    sync,
    clearError,
  } = useApp();
  const [screen, setScreen] = useState<Screen>("home");
  const [bookKey, setBookKey] = useState("toeic-600");
  const [selected, setSelected] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("すべて");
  const [wordKey, setWordKey] = useState(words[0].key);
  const [revealed, setRevealed] = useState(false);
  const [toast, setToast] = useState("");
  const [undo, setUndo] = useState<MasterUndo | null>(null);
  const [diagnosis, setDiagnosis] = useState<{
    seen: string[];
    wrong: string[];
    correct: number;
    level: number;
    current: string;
  }>({ seen: [], wrong: [], correct: 0, level: 600, current: words[0].key });
  const [prefilter, setPrefilter] = useState<string[]>([]);
  const [unknown, setUnknown] = useState<string[]>([]);
  const [reminder, setReminderInput] = useState("20:00");
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const plan = d.plans[studyDay()];
  const completed = plan?.items.filter((i) => i.done).length ?? 0;
  const current = wordMap[plan?.pending[0] ?? ""];
  const activeBook = books.find((b) => b.key === d.settings.activeBook)!;
  const viewedBook = books.find((b) => b.key === bookKey)!;
  const studied = Object.values(d.states).filter(
    (x) => x.status !== "REMOVED",
  ).length;
  useEffect(() => {
    void init();
  }, []);
  useEffect(() => {
    const listener = AppState.addEventListener("change", (state) => {
      if (state === "active" && useApp.getState().ready) {
        void mutate((x) => {
          ensurePlan(x, words);
        }).then(sync);
      }
    });
    return () => listener.remove();
  }, []);
  useEffect(() => {
    const timer = setInterval(() => {
      const state = useApp.getState();
      if (state.ready && !state.data.plans[studyDay()]) {
        setRevealed(false);
        setUndo(null);
        void mutate((x) => {
          ensurePlan(x, words);
        }).then(sync);
      }
    }, 15000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => {
      setToast("");
      setUndo(null);
    }, 5500);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    if (screen === "study" && current && d.settings.autoAudio)
      speak(current.lemma);
    return () => {
      void Speech.stop();
    };
  }, [screen, current?.key]);
  const speak = (text: string, accent = d.settings.accent) => {
    void Speech.stop().then(() =>
      Speech.speak(text, { language: accent, rate: 0.85 }),
    );
  };
  function go(next: Screen) {
    setScreen(next);
    setSearch("");
    setFilter("すべて");
    setSelected([]);
    setDeleteConfirm(false);
  }
  async function commit(fn: (data: Data) => void) {
    try {
      await mutate(fn);
      void sync();
      return true;
    } catch {
      return false;
    }
  }
  function notify(text: string) {
    setToast(text);
  }
  async function start() {
    if (
      await commit((x) => {
        ensurePlan(x, words);
      })
    ) {
      setRevealed(false);
      go(
        useApp.getState().data.plans[studyDay()].pending.length
          ? "study"
          : "done",
      );
    }
  }
  async function answer(rating: Rating) {
    if (busy) return;
    if (!revealed) {
      setRevealed(true);
      return;
    }
    if (await commit((x) => rate(x, words, rating))) {
      if (Platform.OS !== "web") void Haptics.selectionAsync();
      setRevealed(false);
      if (!useApp.getState().data.plans[studyDay()].pending.length) go("done");
    }
  }
  async function master(key: string) {
    let before: MasterUndo | null = null;
    if (
      await commit((x) => {
        before = masterWithUndo(x, key);
      })
    ) {
      setUndo(before);
      notify("熟識にしました");
      setRevealed(false);
      if (
        screen === "study" &&
        !useApp.getState().data.plans[studyDay()].pending.length
      )
        go("done");
    }
  }
  async function undoMaster() {
    if (!undo) return;
    let restored = false;
    if (
      await commit((x) => {
        restored = applyMasterUndo(x, undo);
      })
    ) {
      setUndo(null);
      setRevealed(false);
      notify(restored ? "元に戻しました" : "この単語はその後変更されています");
    }
  }
  function openBook(key: string) {
    setBookKey(key);
    go("book");
  }
  function openWord(key: string) {
    setWordKey(key);
    go("word");
  }
  function beginDiagnostic() {
    setDiagnosis({
      seen: [],
      wrong: [],
      correct: 0,
      level: 600,
      current: words[0].key,
    });
    go("diagnostic");
  }
  async function diagnosticAnswer(correct: boolean) {
    const seen = [...diagnosis.seen, diagnosis.current];
    const wrong = correct
      ? diagnosis.wrong
      : [...diagnosis.wrong, diagnosis.current];
    const levels = [600, 730, 860, 990];
    const level =
      levels[
        Math.max(
          0,
          Math.min(3, levels.indexOf(diagnosis.level) + (correct ? 1 : -1)),
        )
      ];
    const score = diagnosis.correct + Number(correct);
    if (seen.length >= 40) {
      if (
        await commit((x) => {
          x.diagnostics.push({
            id: uid(),
            at: new Date().toISOString(),
            correct: score,
            total: seen.length,
            recommendedBook: `toeic-${score >= 34 ? 990 : score >= 26 ? 860 : score >= 17 ? 730 : 600}`,
            wrong,
          });
        })
      ) {
        go("result");
      }
      return;
    }
    const next =
      words.find((w) => w.level === level && !seen.includes(w.key)) ??
      words.find((w) => w.level > 0 && !seen.includes(w.key))!;
    setDiagnosis({
      seen,
      wrong,
      correct: score,
      level: next.level,
      current: next.key,
    });
  }
  function beginPrefilter() {
    setPrefilter(
      words
        .filter((w) => w.book === bookKey && !d.states[w.key])
        .map((w) => w.key),
    );
    setUnknown([]);
    go("prefilter");
  }
  async function preAnswer(known: boolean) {
    const key = prefilter[0];
    if (
      known &&
      !(await commit((x) => {
        changeState(x, key, "PREFILTER");
      }))
    )
      return;
    if (!known) setUnknown([...unknown, key]);
    setPrefilter(prefilter.slice(1));
  }
  const back = () =>
    go(
      screen === "word" || screen === "prefilter"
        ? "book"
        : screen === "book"
          ? "books"
          : "home",
    );
  const titles: Partial<Record<Screen, string>> = {
    book: viewedBook.name,
    queue: "学習予定",
    study: "今日の学習",
    done: "今日の学習",
    diagnostic: "語彙診断",
    result: "診断結果",
    prefilter: "知っている単語をチェック",
    word: "単語の詳細",
    settings: "設定",
  };
  const isTab = ["home", "books", "records"].includes(screen);
  if (!ready)
    return (
      <SafeAreaView
        style={{
          flex: 1,
          backgroundColor: C.paper,
          alignItems: "center",
          justifyContent: "center",
          gap: 20,
        }}
      >
        <Brand />
        {error ? (
          <>
            <T>{error}</T>
            <Button onPress={() => void init()}>再試行</Button>
          </>
        ) : (
          <ActivityIndicator color={C.green} />
        )}
      </SafeAreaView>
    );
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.paper }}>
      <View
        style={{ flex: 1, width: "100%", maxWidth: 600, alignSelf: "center" }}
      >
        <View
          style={[
            s.between,
            { paddingHorizontal: 24, paddingTop: 14, paddingBottom: 15 },
          ]}
        >
          {isTab ? (
            <Brand />
          ) : (
            <View style={s.row}>
              <Pressable
                accessibilityLabel="戻る"
                accessibilityRole="button"
                onPress={back}
                style={s.iconButton}
              >
                <Icon name="arrow-left" />
              </Pressable>
              <T style={{ fontWeight: "600", fontSize: 15 }}>
                {titles[screen]}
              </T>
            </View>
          )}
          {isTab ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="設定"
              style={s.iconButton}
              onPress={() => go("settings")}
            >
              <Icon name="settings" size={19} />
            </Pressable>
          ) : screen === "study" && current ? (
            <Pressable onPress={() => void master(current.key)} style={s.chip}>
              <T style={s.link}>✓ 熟識</T>
            </Pressable>
          ) : (
            <T style={s.label}>CAMELWORDS</T>
          )}
        </View>
        <ScrollView
          key={screen}
          contentContainerStyle={{
            padding: 24,
            paddingTop: 12,
            gap: 22,
            paddingBottom: 40,
          }}
          showsVerticalScrollIndicator={false}
        >
          {screen === "home" && (
            <>
              <View style={{ gap: 8 }}>
                <T style={s.label}>
                  {new Intl.DateTimeFormat("en-US", {
                    month: "long",
                    day: "numeric",
                    timeZone: "Asia/Tokyo",
                  })
                    .format(new Date())
                    .toUpperCase()}
                  　/　YOUR DAILY STEP
                </T>
                <T style={s.heading}>少しずつ、{"\n"}あなたの言葉に。</T>
                <T style={s.sub}>今日の一歩が、明日の自信になる。</T>
              </View>
              <Card
                style={{
                  backgroundColor: "#eef2e6",
                  borderColor: "#e1e8d8",
                  padding: 25,
                }}
              >
                <View style={s.between}>
                  <View style={{ gap: 6 }}>
                    <T style={s.label}>TODAY’S LEARNING</T>
                    <T style={{ fontSize: 20, fontWeight: "600" }}>
                      今日の学習
                    </T>
                    <T style={s.sub}>あなたに合ったペースで。</T>
                  </View>
                  <View
                    style={{
                      backgroundColor: "#e2e8d6",
                      borderRadius: 20,
                      padding: 9,
                    }}
                  >
                    <Icon name="sun" color={C.green} size={22} />
                  </View>
                </View>
                <View
                  style={[
                    s.row,
                    { justifyContent: "space-around", paddingVertical: 12 },
                  ]}
                >
                  <Ring value={completed} total={plan?.items.length ?? 0} />
                  <View style={{ gap: 17 }}>
                    <View style={s.row}>
                      <View
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: 3,
                          backgroundColor: C.green,
                        }}
                      />
                      <T style={s.sub}>復習</T>
                      <T style={{ fontWeight: "600", fontSize: 19 }}>
                        {plan?.items.filter((i) => i.type === "REVIEW")
                          .length ?? 0}
                        <T style={s.sub}> 語</T>
                      </T>
                    </View>
                    <View style={s.row}>
                      <View
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: 3,
                          backgroundColor: C.orange,
                        }}
                      />
                      <T style={s.sub}>新しい単語</T>
                      <T style={{ fontWeight: "600", fontSize: 19 }}>
                        {plan?.items.filter((i) => i.type === "NEW").length ??
                          0}
                        <T style={s.sub}> 語</T>
                      </T>
                    </View>
                    <T style={{ fontSize: 11, color: C.muted }}>
                      ◷ 約
                      {Math.max(1, Math.ceil((plan?.pending.length ?? 0) / 6))}
                      分で完了
                    </T>
                  </View>
                </View>
                <Button onPress={() => void start()}>
                  {completed && plan?.pending.length
                    ? "学習をつづける"
                    : plan?.pending.length
                      ? "今日の学習を始める"
                      : "学習のまとめを見る"}
                  　→
                </Button>
                <T
                  style={{ fontSize: 11, color: C.muted, textAlign: "center" }}
                >
                  覚える単語は、アプリにおまかせ。
                </T>
              </Card>
              {d.backlogPaused && (
                <Card style={{ backgroundColor: "#fbf2df" }}>
                  <T>
                    復習がたまっています。新しい単語をお休みして、少しずつ取り戻しましょう。
                  </T>
                </Card>
              )}
              <View style={[s.row, { gap: 12 }]}>
                <Card style={{ flex: 1, padding: 17 }}>
                  <View style={s.row}>
                    <Icon name="zap" color={C.orange} size={17} />
                    <T style={s.sub}>連続学習</T>
                  </View>
                  <T style={{ fontSize: 29, fontWeight: "500" }}>
                    {streak(d)} <T style={s.sub}>日</T>
                  </T>
                </Card>
                <Card style={{ flex: 1, padding: 17 }}>
                  <View style={s.row}>
                    <Icon name="layers" color={C.green} size={17} />
                    <T style={s.sub}>総語彙</T>
                  </View>
                  <T style={{ fontSize: 29, fontWeight: "500" }}>
                    {studied} <T style={s.sub}>語</T>
                  </T>
                </Card>
              </View>
              <Pressable onPress={() => go("queue")} accessibilityRole="button">
                <Card style={{ padding: 19 }}>
                  <View style={s.between}>
                    <View style={s.row}>
                      <Icon name="list" />
                      <View>
                        <T style={{ fontWeight: "600" }}>
                          学習予定{" "}
                          <T style={{ color: C.green }}> {d.queue.length}語</T>
                        </T>
                        <T style={{ fontSize: 11, color: C.muted }}>
                          自分で選んだ単語から、優先的に。
                        </T>
                      </View>
                    </View>
                    <Icon name="chevron-right" size={18} />
                  </View>
                </Card>
              </Pressable>
              <View style={[s.between, { marginBottom: -8 }]}>
                <T style={s.section}>いま、育てている語彙</T>
                <Pressable onPress={() => go("books")}>
                  <T style={s.link}>単語帳を見る →</T>
                </Pressable>
              </View>
              <Card>
                <View style={s.row}>
                  <BookCover book={activeBook} small />
                  <View style={{ flex: 1, gap: 4 }}>
                    <T style={{ fontWeight: "600" }}>
                      {activeBook.name} {activeBook.level}点
                    </T>
                    <T style={s.sub}>{activeBook.caption}</T>
                    <Progress bookKey={activeBook.key} data={d} />
                  </View>
                </View>
              </Card>
              <Pressable onPress={beginDiagnostic}>
                <Card
                  style={{ backgroundColor: "#f2eee5", borderColor: "#e9e2d6" }}
                >
                  <View style={s.between}>
                    <View style={{ gap: 6 }}>
                      <T
                        style={{
                          color: "#8d7455",
                          fontSize: 10,
                          letterSpacing: 2,
                        }}
                      >
                        FIND YOUR STARTING POINT
                      </T>
                      <T style={{ fontSize: 18, fontWeight: "600" }}>
                        今の自分を、知ってみよう。
                      </T>
                      <T style={s.sub}>
                        約3分の語彙診断で、ぴったりの単語帳へ。
                      </T>
                    </View>
                    <Icon name="compass" size={30} color="#9a8867" />
                  </View>
                  <T
                    style={{
                      color: "#8d7455",
                      fontSize: 13,
                      fontWeight: "600",
                    }}
                  >
                    語彙診断をはじめる　→
                  </T>
                </Card>
              </Pressable>
              <T style={{ fontSize: 10, color: C.muted, textAlign: "center" }}>
                開発プレビュー · サンプル{words.length}語（未審校）
              </T>
            </>
          )}
          {screen === "books" && (
            <>
              <View style={{ gap: 7 }}>
                <T style={s.label}>YOUR WORD COLLECTION</T>
                <T style={s.heading}>次の一歩を、選ぼう。</T>
                <T style={s.sub}>
                  目標に合わせて。知っている単語は、引き継がれます。
                </T>
              </View>
              {books.map((book) => (
                <Pressable key={book.key} onPress={() => openBook(book.key)}>
                  <Card>
                    <View style={[s.row, { gap: 20 }]}>
                      <BookCover book={book} />
                      <View style={{ flex: 1, gap: 8 }}>
                        {d.settings.activeBook === book.key && (
                          <T style={s.label}>● 学習中</T>
                        )}
                        <T style={{ fontSize: 19, fontWeight: "600" }}>
                          {book.name}
                        </T>
                        <T style={s.sub}>{book.caption}</T>
                        <T style={{ fontSize: 11, color: C.muted }}>
                          サンプル{" "}
                          {words.filter((w) => w.book === book.key).length}語 ·
                          オフライン対応
                        </T>
                        <Progress bookKey={book.key} data={d} />
                      </View>
                      <Icon name="chevron-right" size={16} />
                    </View>
                  </Card>
                </Pressable>
              ))}
              <T style={s.sub}>現在すべての機能を無料でご利用いただけます。</T>
            </>
          )}
          {screen === "book" && (
            <>
              <View style={[s.row, { gap: 20 }]}>
                <BookCover book={viewedBook} />
                <View style={{ flex: 1, gap: 8 }}>
                  <T style={s.label}>YOUR NEXT CHAPTER</T>
                  <T style={{ fontSize: 22, fontWeight: "600" }}>
                    {viewedBook.title}
                  </T>
                  <T style={s.sub}>
                    収録 {words.filter((w) => w.book === bookKey).length}語 ·
                    開発用サンプル
                  </T>
                </View>
              </View>
              <Button
                secondary={d.settings.activeBook === bookKey}
                onPress={() =>
                  void commit((x) => {
                    x.settings.activeBook = bookKey;
                  }).then((ok) => {
                    if (ok)
                      notify(
                        "学習する単語帳を変更しました。今日の計画はそのままです。",
                      );
                  })
                }
              >
                {d.settings.activeBook === bookKey
                  ? "この単語帳を学習中"
                  : "この単語帳で学習する"}
              </Button>
              <View style={s.between}>
                <Pressable onPress={beginPrefilter}>
                  <T style={s.link}>知っている単語を先にチェック →</T>
                </Pressable>
              </View>
              <TextInput
                accessibilityLabel="単語を検索"
                placeholder="単語・意味で検索"
                value={search}
                onChangeText={setSearch}
                style={s.input}
              />
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 8 }}
              >
                {[
                  "すべて",
                  "未学習",
                  ...new Set(
                    words.filter((w) => w.book === bookKey).map((w) => w.unit),
                  ),
                ].map((f) => (
                  <Chip
                    key={f}
                    active={filter === f}
                    onPress={() => setFilter(f)}
                  >
                    {f}
                  </Chip>
                ))}
              </ScrollView>
              <View style={s.between}>
                <T style={s.sub}>
                  選択 {selected.length} / 新語上限 {d.settings.newCap}
                </T>
                <Pressable
                  onPress={() =>
                    setSelected(
                      words
                        .filter(
                          (w) =>
                            w.book === bookKey &&
                            !d.states[w.key] &&
                            (filter === "すべて" ||
                              filter === "未学習" ||
                              filter === w.unit) &&
                            `${w.lemma}${w.meaning}`.includes(search),
                        )
                        .map((w) => w.key),
                    )
                  }
                >
                  <T style={s.link}>表示中をまとめて選択</T>
                </Pressable>
              </View>
              <View style={{ gap: 2 }}>
                {words
                  .filter(
                    (w) =>
                      w.book === bookKey &&
                      (filter === "すべて" ||
                        (filter === "未学習" && !d.states[w.key]) ||
                        w.unit === filter) &&
                      `${w.lemma.toLowerCase()}${w.meaning}`.includes(
                        search.toLowerCase(),
                      ),
                  )
                  .map((w) => (
                    <WordRow
                      key={w.key}
                      word={w}
                      state={statusLabel(d.states[w.key]?.status)}
                      selected={
                        selected.includes(w.key) || d.queue.includes(w.key)
                      }
                      onOpen={() => openWord(w.key)}
                      onSelect={
                        d.states[w.key]
                          ? undefined
                          : () =>
                              setSelected(
                                selected.includes(w.key)
                                  ? selected.filter((k) => k !== w.key)
                                  : [...selected, w.key],
                              )
                      }
                    />
                  ))}
              </View>
              <Button
                disabled={!selected.length || busy}
                onPress={() =>
                  void commit((x) => addQueue(x, selected, words)).then(
                    (ok) => {
                      if (ok) {
                        notify(`${selected.length}語を学習予定に追加しました`);
                        setSelected([]);
                      }
                    },
                  )
                }
              >
                学習予定に追加（{selected.length}語）
              </Button>
            </>
          )}
          {screen === "queue" && (
            <>
              <T style={s.heading}>自分で選ぶ、今日の一歩。</T>
              <T style={s.sub}>
                先頭から優先して学習します。今日の上限を超えた単語は、明日以降へ。
              </T>
              {d.queue.length === 0 ? (
                <Card>
                  <T>まだ単語が選ばれていません。</T>
                  <Button onPress={() => go("books")}>単語帳から選ぶ</Button>
                </Card>
              ) : (
                d.queue.map((key, i) => (
                  <Card key={key} style={{ padding: 16 }}>
                    <View style={s.between}>
                      <Pressable
                        onPress={() => openWord(key)}
                        style={{ flex: 1 }}
                      >
                        <T style={{ fontSize: 18, fontWeight: "600" }}>
                          {i + 1}. {wordMap[key]?.lemma ?? key}
                        </T>
                        <T style={s.sub}>{wordMap[key]?.meaning}</T>
                      </Pressable>
                      <Pressable
                        accessibilityLabel="上へ移動"
                        disabled={i === 0}
                        onPress={() =>
                          void commit((x) => {
                            moveQueue(x, key, -1);
                          })
                        }
                        style={{ padding: 10, opacity: i ? 1 : 0.25 }}
                      >
                        <Icon name="arrow-up" size={18} />
                      </Pressable>
                      <Pressable
                        accessibilityLabel="予定から削除"
                        onPress={() =>
                          void commit((x) => {
                            removeQueue(x, key);
                          })
                        }
                        style={{ padding: 10 }}
                      >
                        <Icon name="x" size={18} />
                      </Pressable>
                    </View>
                  </Card>
                ))
              )}
              <Button secondary onPress={() => go("books")}>
                単語を追加する
              </Button>
              {d.queue.length > 0 && (
                <Button
                  onPress={() =>
                    void commit((x) => {
                      appendExtra(x, words, 10);
                    }).then((ok) => {
                      if (ok) void start();
                    })
                  }
                >
                  今日の計画に追加する（最大10語）
                </Button>
              )}
            </>
          )}
          {screen === "study" && current && (
            <>
              <View style={s.between}>
                <T style={s.sub}>
                  {completed} / {plan?.items.length} 語
                </T>
                <T style={s.sub}>{activeBook.name}</T>
              </View>
              <View
                style={{ height: 4, borderRadius: 2, backgroundColor: C.line }}
              >
                <View
                  style={{
                    height: 4,
                    borderRadius: 2,
                    width: `${(100 * completed) / Math.max(plan?.items.length ?? 1, 1)}%`,
                    backgroundColor: C.green,
                  }}
                />
              </View>
              <Card style={{ minHeight: 350, padding: 30 }}>
                <View style={s.between}>
                  <T style={s.label}>
                    {plan?.items.find((i) => i.key === current.key)?.type ===
                    "NEW"
                      ? "NEW WORD"
                      : "REVIEW"}
                  </T>
                  <Pressable
                    accessibilityLabel="発音を聞く"
                    onPress={() => speak(current.lemma)}
                    style={s.iconButton}
                  >
                    <Icon name="volume-2" color={C.green} />
                  </Pressable>
                </View>
                <View
                  style={{ paddingVertical: 30, gap: 14, alignItems: "center" }}
                >
                  <T
                    style={{
                      fontSize: current.lemma.length > 20 ? 28 : 36,
                      lineHeight: 44,
                      fontWeight: "600",
                      letterSpacing: -0.8,
                      textAlign: "center",
                    }}
                  >
                    {current.lemma}
                  </T>
                  <T style={{ color: C.muted }}>{current.ipa}</T>
                </View>
                {revealed ? (
                  <>
                    <View style={s.divider} />
                    <T style={{ fontSize: 21, lineHeight: 32 }}>
                      <T style={{ fontSize: 12, color: C.muted }}>
                        {current.pos}　
                      </T>
                      {current.meaning}
                    </T>
                    <View
                      style={{
                        backgroundColor: C.paper,
                        borderRadius: 14,
                        padding: 16,
                        gap: 8,
                      }}
                    >
                      <T style={{ fontSize: 16, lineHeight: 26 }}>
                        {current.en}
                      </T>
                      <T style={s.sub}>{current.ja}</T>
                      <Pressable onPress={() => speak(current.en)}>
                        <T style={s.link}>▷ 例文を聞く</T>
                      </Pressable>
                    </View>
                  </>
                ) : (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => setRevealed(true)}
                    style={{
                      paddingVertical: 30,
                      alignItems: "center",
                      gap: 10,
                    }}
                  >
                    <Icon name="eye" color={C.muted} />
                    <T style={s.sub}>意味を思い出してから、タップ</T>
                  </Pressable>
                )}
              </Card>
              {!revealed ? (
                <Button onPress={() => setRevealed(true)}>答えを見る</Button>
              ) : (
                <View style={[s.row, { gap: 8 }]}>
                  {(["AGAIN", "HARD", "GOOD"] as Rating[]).map((r, i) => (
                    <Pressable
                      key={r}
                      disabled={busy}
                      onPress={() => void answer(r)}
                      style={{
                        flex: 1,
                        alignItems: "center",
                        paddingVertical: 20,
                        borderRadius: 17,
                        backgroundColor: ["#f2e7e2", "#f3eddc", C.green][i],
                        gap: 6,
                      }}
                    >
                      <Icon
                        name={["rotate-ccw", "minus", "check"][i]}
                        color={i === 2 ? "white" : ["#ac6b58", "#9c8143"][i]}
                      />
                      <T
                        style={{
                          fontWeight: "600",
                          fontSize: 14,
                          color: i === 2 ? "white" : C.ink,
                        }}
                      >
                        {["忘れた", "あいまい", "覚えた"][i]}
                      </T>
                    </Pressable>
                  ))}
                </View>
              )}
              <T style={{ textAlign: "center", fontSize: 11, color: C.muted }}>
                途中で閉じても、ここから再開できます。
              </T>
            </>
          )}
          {screen === "done" && (
            <>
              <View
                style={{ alignItems: "center", gap: 15, paddingVertical: 20 }}
              >
                <View
                  style={{
                    width: 80,
                    height: 80,
                    borderRadius: 40,
                    backgroundColor: C.pale,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Icon name="check" size={36} color={C.green} />
                </View>
                <T style={s.label}>ONE STEP FORWARD</T>
                <T style={s.heading}>
                  {completed
                    ? "今日も、ひとつ前へ。"
                    : "今日の予定はありません。"}
                </T>
                <T style={s.sub}>
                  {completed
                    ? "おつかれさまでした。言葉が、あなたの力に。"
                    : "単語帳で新しい単語を選んでみましょう。"}
                </T>
              </View>
              <Card>
                <View style={s.between}>
                  <T>今日学んだ単語</T>
                  <T style={{ fontSize: 27 }}>
                    {completed} <T style={s.sub}>語</T>
                  </T>
                </View>
                <View style={s.between}>
                  <T>連続学習</T>
                  <T>{streak(d)} 日</T>
                </View>
                <View style={s.between}>
                  <T>学習予定に残っている単語</T>
                  <T>{d.queue.length} 語</T>
                </View>
              </Card>
              <Button onPress={() => go("home")}>ホームに戻る</Button>
              <View style={s.row}>
                {[10, 20].map((count) => (
                  <Button
                    key={count}
                    secondary
                    style={{ flex: 1 }}
                    onPress={() =>
                      void commit((x) => {
                        const n = appendExtra(x, words, count);
                        if (!n)
                          notify(
                            "追加できる新しい単語がありません。単語帳を切り替えてください。",
                          );
                      }).then((ok) => {
                        if (
                          ok &&
                          useApp.getState().data.plans[studyDay()].pending
                            .length
                        )
                          void start();
                      })
                    }
                  >
                    あと {count} 語
                  </Button>
                ))}
              </View>
              {!d.settings.reminder && (
                <Card>
                  <T style={s.section}>明日も、この時間に。</T>
                  <T style={s.sub}>
                    学習を続けるためのリマインダーを設定できます。
                  </T>
                  <Button secondary onPress={() => go("settings")}>
                    リマインダーを設定
                  </Button>
                </Card>
              )}
            </>
          )}
          {screen === "word" &&
            (() => {
              const w = wordMap[wordKey];
              const state = d.states[wordKey];
              return (
                <>
                  <Card>
                    <View style={s.between}>
                      <Chip>{statusLabel(state?.status)}</Chip>
                      <Pressable
                        accessibilityLabel="発音を聞く"
                        onPress={() => speak(w.lemma)}
                      >
                        <Icon name="volume-2" color={C.green} />
                      </Pressable>
                    </View>
                    <T
                      style={{
                        fontSize: 34,
                        lineHeight: 45,
                        fontWeight: "600",
                      }}
                    >
                      {w.lemma}
                    </T>
                    <T style={s.sub}>
                      {w.ipa}　{w.pos}
                    </T>
                    <T style={{ fontSize: 22 }}>{w.meaning}</T>
                    <View style={s.divider} />
                    <T style={{ fontSize: 17 }}>{w.en}</T>
                    <T style={s.sub}>{w.ja}</T>
                    <View style={s.row}>
                      <Chip onPress={() => speak(w.lemma, "en-US")}>▷ US</Chip>
                      <Chip onPress={() => speak(w.lemma, "en-GB")}>▷ UK</Chip>
                    </View>
                  </Card>
                  <Card>
                    <T style={s.section}>あなたの記憶</T>
                    <T>学習回数　{state?.reviewCount ?? 0} 回</T>
                    <T>
                      次回の復習　
                      {state && ["LEARNING", "REVIEW"].includes(state.status)
                        ? new Date(state.nextReviewAt).toLocaleDateString(
                            "ja-JP",
                            { timeZone: "Asia/Tokyo" },
                          )
                        : "—"}
                    </T>
                    {d.events
                      .filter(
                        (e) => e.kind === "review" && e.wordKey === wordKey,
                      )
                      .slice(-5)
                      .reverse()
                      .map((e) => (
                        <View key={e.id} style={s.between}>
                          <T style={s.sub}>
                            {new Date(e.clientReviewedAt).toLocaleString(
                              "ja-JP",
                              { timeZone: "Asia/Tokyo" },
                            )}
                          </T>
                          <T>
                            {e.rating === "GOOD"
                              ? "覚えた"
                              : e.rating === "HARD"
                                ? "あいまい"
                                : "忘れた"}
                          </T>
                        </View>
                      ))}
                  </Card>
                  {state?.status === "MASTERED" ||
                  state?.status === "REMOVED" ? (
                    <Button
                      onPress={() =>
                        void commit((x) => {
                          changeState(x, wordKey, "RESTORE");
                        }).then((ok) => ok && notify("復習対象に戻しました"))
                      }
                    >
                      復習対象に戻す
                    </Button>
                  ) : (
                    <Button secondary onPress={() => void master(wordKey)}>
                      この単語は熟識している
                    </Button>
                  )}
                  <Button
                    secondary
                    onPress={() =>
                      void commit((x) => {
                        changeState(x, wordKey, "REMOVE");
                      }).then((ok) => ok && notify("学習対象から除外しました"))
                    }
                  >
                    学習対象から除外する
                  </Button>
                </>
              );
            })()}
          {screen === "diagnostic" &&
            (() => {
              const w = wordMap[diagnosis.current];
              const other = words
                .filter((x) => x.key !== w.key)
                .filter((x, i) => i % 7 === 0)
                .slice(0, 3);
              const choices = [...other, w].sort((a, b) =>
                a.meaning.localeCompare(b.meaning),
              );
              return (
                <>
                  <T style={s.label}>
                    VOCABULARY CHECK　{diagnosis.seen.length + 1} / 40
                  </T>
                  <T style={s.sub}>いちばん近い意味を選んでください。</T>
                  <Card style={{ alignItems: "center", paddingVertical: 40 }}>
                    <T
                      style={{
                        fontSize: 32,
                        lineHeight: 42,
                        fontWeight: "600",
                      }}
                    >
                      {w.lemma}
                    </T>
                  </Card>
                  {choices.map((c) => (
                    <Button
                      key={c.key}
                      secondary
                      disabled={busy}
                      onPress={() => void diagnosticAnswer(c.key === w.key)}
                    >
                      {c.meaning}
                    </Button>
                  ))}
                  <Pressable
                    disabled={busy}
                    onPress={() => void diagnosticAnswer(false)}
                    style={{ padding: 15 }}
                  >
                    <T style={{ textAlign: "center", color: C.muted }}>
                      わからない
                    </T>
                  </Pressable>
                  <T style={s.sub}>
                    診断で正解した単語も、熟識には変更されません。
                  </T>
                </>
              );
            })()}
          {screen === "result" &&
            (() => {
              const result = d.diagnostics.at(-1)!;
              const b = books.find((b) => b.key === result.recommendedBook)!;
              return (
                <>
                  <T style={s.label}>YOUR STARTING POINT</T>
                  <T style={s.heading}>ここから、はじめよう。</T>
                  <Card style={{ alignItems: "center", paddingVertical: 35 }}>
                    <BookCover book={b} />
                    <T style={{ fontSize: 24, fontWeight: "600" }}>
                      おすすめ：{b.name}
                    </T>
                    <T style={s.sub}>
                      {result.total}問中 {result.correct}問正解
                    </T>
                    <T style={s.sub}>
                      サンプル語彙による目安です。スコアを予測するものではありません。
                    </T>
                  </Card>
                  <Button
                    onPress={() =>
                      void commit((x) => {
                        x.settings.activeBook = b.key;
                      }).then((ok) => ok && go("home"))
                    }
                  >
                    この単語帳ではじめる
                  </Button>
                  <Button secondary onPress={() => go("books")}>
                    ほかの単語帳も見る
                  </Button>
                </>
              );
            })()}
          {screen === "prefilter" && (
            <>
              <T style={s.sub}>
                意味を見なくてもわかる単語を、復習対象から外します。
              </T>
              {prefilter.length ? (
                <>
                  <Card
                    style={{
                      minHeight: 240,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <T style={s.label}>残り {prefilter.length} 語</T>
                    <T
                      style={{
                        fontSize: 31,
                        lineHeight: 42,
                        fontWeight: "600",
                      }}
                    >
                      {wordMap[prefilter[0]].lemma}
                    </T>
                  </Card>
                  <View style={s.row}>
                    <Button
                      secondary
                      disabled={busy}
                      style={{ flex: 1 }}
                      onPress={() => void preAnswer(false)}
                    >
                      知らない
                    </Button>
                    <Button
                      disabled={busy}
                      style={{ flex: 1 }}
                      onPress={() => void preAnswer(true)}
                    >
                      知ってる
                    </Button>
                  </View>
                  <Button secondary onPress={() => setPrefilter([])}>
                    ここで終了する
                  </Button>
                </>
              ) : (
                <Card>
                  <T style={s.section}>チェックが終わりました。</T>
                  <T>「知らない」単語：{unknown.length}語</T>
                  <Button
                    disabled={!unknown.length}
                    onPress={() =>
                      void commit((x) => addQueue(x, unknown, words)).then(
                        (ok) => {
                          if (ok) {
                            notify("学習予定に追加しました");
                            go("queue");
                          }
                        },
                      )
                    }
                  >
                    まとめて学習予定に追加
                  </Button>
                  <Button secondary onPress={() => go("book")}>
                    単語帳に戻る
                  </Button>
                </Card>
              )}
            </>
          )}
          {screen === "records" && (
            <>
              <T style={s.label}>LITTLE BY LITTLE</T>
              <T style={s.heading}>積み重ねが、見えてくる。</T>
              <View style={s.row}>
                <Card style={{ flex: 1 }}>
                  <T style={s.sub}>総語彙</T>
                  <T style={{ fontSize: 32 }}>
                    {studied}
                    <T style={s.sub}> 語</T>
                  </T>
                </Card>
                <Card style={{ flex: 1 }}>
                  <T style={s.sub}>連続学習</T>
                  <T style={{ fontSize: 32 }}>
                    {streak(d)}
                    <T style={s.sub}> 日</T>
                  </T>
                </Card>
              </View>
              <Card>
                <T style={s.section}>この7日間</T>
                <View style={[s.between, { paddingVertical: 12 }]}>
                  {Array.from({ length: 7 }, (_, i) => {
                    const date = new Date(
                      Date.parse(studyDay() + "T12:00:00Z") -
                        (6 - i) * 86400000,
                    );
                    const key = date.toISOString().slice(0, 10);
                    const done = completedDays(d).includes(key);
                    return (
                      <View key={key} style={{ gap: 8, alignItems: "center" }}>
                        <T style={{ fontSize: 11, color: C.muted }}>
                          {
                            ["日", "月", "火", "水", "木", "金", "土"][
                              date.getUTCDay()
                            ]
                          }
                        </T>
                        <View
                          style={{
                            height: 34,
                            width: 34,
                            borderRadius: 17,
                            backgroundColor: done ? C.green : C.pale,
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          {done ? (
                            <Icon name="check" size={15} color="white" />
                          ) : (
                            <T style={{ fontSize: 12 }}>{date.getUTCDate()}</T>
                          )}
                        </View>
                      </View>
                    );
                  })}
                </View>
                <T style={s.sub}>
                  その日の計画を完了すると、チェックがつきます。
                </T>
              </Card>
              <T style={s.section}>単語帳ごとの進捗</T>
              {books.map((b) => (
                <Card key={b.key}>
                  <T style={{ fontWeight: "600" }}>{b.name}</T>
                  <Progress bookKey={b.key} data={d} />
                </Card>
              ))}
              <T style={s.section}>熟識した単語</T>
              {Object.keys(d.states).filter(
                (k) => d.states[k].status === "MASTERED",
              ).length ? (
                Object.keys(d.states)
                  .filter(
                    (k) => d.states[k].status === "MASTERED" && wordMap[k],
                  )
                  .map((k) => (
                    <WordRow
                      key={k}
                      word={wordMap[k]}
                      state="熟識"
                      onOpen={() => openWord(k)}
                    />
                  ))
              ) : (
                <T style={s.sub}>熟識した単語がここに表示されます。</T>
              )}
            </>
          )}
          {screen === "settings" && (
            <>
              <T style={s.heading}>あなたのペースで。</T>
              <Card>
                <T style={s.section}>毎日の学習</T>
                <T style={s.sub}>1日に取り組む単語数</T>
                <View style={[s.row, { flexWrap: "wrap" }]}>
                  {[30, 60, 100, 150].map((n) => (
                    <Chip
                      key={n}
                      active={d.settings.dailyLimit === n}
                      onPress={() =>
                        void commit((x) => {
                          x.settings.dailyLimit = n;
                          x.settings.newCap = Math.min(x.settings.newCap, n);
                        })
                      }
                    >
                      {n}語
                    </Chip>
                  ))}
                </View>
                <T style={s.sub}>新しい単語の上限</T>
                <View style={[s.row, { flexWrap: "wrap" }]}>
                  {[10, 20, 30, 50, 75]
                    .filter((n) => n <= d.settings.dailyLimit)
                    .map((n) => (
                      <Chip
                        key={n}
                        active={d.settings.newCap === n}
                        onPress={() =>
                          void commit((x) => {
                            x.settings.newCap = n;
                          })
                        }
                      >
                        {n}語
                      </Chip>
                    ))}
                </View>
                <View style={s.between}>
                  <T>新しい単語を自動で補充</T>
                  <Switch
                    value={d.settings.autoFill}
                    onValueChange={(v) =>
                      void commit((x) => {
                        x.settings.autoFill = v;
                      })
                    }
                    trackColor={{ true: C.green }}
                  />
                </View>
                <T style={{ fontSize: 11, color: C.muted }}>
                  変更は次の日の計画から反映されます。1日の区切りは日本時間の午前4時です。
                </T>
              </Card>
              <Card>
                <T style={s.section}>音声</T>
                <View style={s.row}>
                  {(["en-US", "en-GB"] as const).map((a) => (
                    <Chip
                      key={a}
                      active={d.settings.accent === a}
                      onPress={() =>
                        void commit((x) => {
                          x.settings.accent = a;
                        })
                      }
                    >
                      {a === "en-US" ? "アメリカ英語" : "イギリス英語"}
                    </Chip>
                  ))}
                </View>
                <View style={s.between}>
                  <T>単語を自動で読み上げる</T>
                  <Switch
                    value={d.settings.autoAudio}
                    onValueChange={(v) =>
                      void commit((x) => {
                        x.settings.autoAudio = v;
                      })
                    }
                    trackColor={{ true: C.green }}
                  />
                </View>
                <T style={{ fontSize: 11, color: C.muted }}>
                  開発版では端末の読み上げ音声を使用します。
                </T>
              </Card>
              <Card>
                <T style={s.section}>学習リマインダー</T>
                <T style={s.sub}>
                  {d.settings.reminder
                    ? `設定時刻 ${d.settings.reminder}`
                    : "まだ設定されていません"}
                </T>
                <TextInput
                  accessibilityLabel="通知時刻"
                  placeholder="20:00"
                  value={reminder}
                  onChangeText={setReminderInput}
                  style={s.input}
                />
                <Button
                  secondary
                  onPress={() => {
                    const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(reminder);
                    if (!m) {
                      notify("時刻を HH:MM 形式で入力してください");
                      return;
                    }
                    void setReminder(+m[1], +m[2])
                      .then(() =>
                        commit((x) => {
                          x.settings.reminder = reminder;
                        }),
                      )
                      .then((ok) => ok && notify("リマインダーを設定しました"))
                      .catch((e) => notify(e.message));
                  }}
                >
                  通知を設定する
                </Button>
              </Card>
              <Card>
                <T style={s.section}>データとアカウント</T>
                <View style={s.row}>
                  <Icon
                    name={cloudAvailable ? "cloud" : "smartphone"}
                    size={18}
                  />
                  <T>{syncStatus}</T>
                </View>
                <T style={s.sub}>
                  {cloudAvailable
                    ? "匿名アカウントで保存します。"
                    : "この開発版の学習記録は、この端末に保存されています。"}
                </T>
                {cloudAvailable && (
                  <Button secondary onPress={() => void sync()}>
                    今すぐ同期
                  </Button>
                )}
                {(appleAvailable || googleAvailable) && (
                  <>
                    <T style={s.sub}>
                      アカウントを連携すると、別の端末でも学習記録を引き継げます。
                    </T>
                    {(
                      [
                        ...(appleAvailable ? ["apple"] : []),
                        ...(googleAvailable ? ["google"] : []),
                      ] as ("apple" | "google")[]
                    ).map((provider) => (
                      <View key={provider} style={{ gap: 10 }}>
                        <Button
                          secondary
                          disabled={busy}
                          onPress={() =>
                            void useApp
                              .getState()
                              .connect(provider, false)
                              .then(() => notify("アカウントを連携しました"))
                              .catch((e) => notify(e.message))
                          }
                        >
                          {provider === "apple" ? "Apple" : "Google"} と連携
                        </Button>
                        <Button
                          secondary
                          disabled={busy}
                          onPress={() =>
                            void useApp
                              .getState()
                              .connect(provider, true)
                              .then(() =>
                                notify("クラウドの記録を復元しました"),
                              )
                              .catch((e) => notify(e.message))
                          }
                        >
                          {provider === "apple" ? "Apple" : "Google"}{" "}
                          の既存の記録を復元
                        </Button>
                      </View>
                    ))}
                    <T style={{ fontSize: 11, color: C.muted }}>
                      復元時は、この端末の学習記録とクラウドの記録を統合します。
                    </T>
                  </>
                )}
                {!appleAvailable && !googleAvailable && (
                  <T style={{ fontSize: 11, color: C.muted }}>
                    アカウント連携は準備中です。別の端末への引き継ぎはまだ利用できません。
                  </T>
                )}
                {cloudAvailable &&
                  (deleteConfirm ? (
                    <>
                      <T>
                        アカウントと学習データを削除します。この操作は取り消せません。
                      </T>
                      <Button
                        onPress={() =>
                          void useApp
                            .getState()
                            .eraseAccount()
                            .then(() => {
                              go("home");
                              notify("アカウントを削除しました");
                            })
                            .catch((e) => notify(String(e)))
                        }
                      >
                        削除を確定する
                      </Button>
                      <Button secondary onPress={() => setDeleteConfirm(false)}>
                        キャンセル
                      </Button>
                    </>
                  ) : (
                    <Pressable onPress={() => setDeleteConfirm(true)}>
                      <T style={{ color: "#ad6656" }}>アカウントを削除</T>
                    </Pressable>
                  ))}
              </Card>
              <Card>
                <T style={s.section}>CamelWords について</T>
                <T style={s.sub}>Version 0.1.0 · 開発プレビュー</T>
                <T style={s.sub}>
                  現在すべての機能を無料でご利用いただけます。
                </T>
                <T style={{ fontSize: 11, color: C.muted }}>
                  TOEIC is a registered trademark of ETS. This product is not
                  endorsed or approved by ETS.
                </T>
                <T style={{ fontSize: 11, color: C.muted }}>
                  TOEIC は ETS の登録商標です。本製品は ETS
                  の承認・推奨を受けたものではありません。
                </T>
              </Card>
            </>
          )}
        </ScrollView>
        {isTab && (
          <View
            style={{
              flexDirection: "row",
              backgroundColor: C.white,
              borderTopWidth: 1,
              borderColor: C.line,
              paddingTop: 13,
              paddingBottom: 15,
            }}
          >
            {(["home", "books", "records"] as Screen[]).map((tab, i) => (
              <Pressable
                key={tab}
                accessibilityRole="tab"
                accessibilityState={{ selected: screen === tab }}
                onPress={() => go(tab)}
                style={{ flex: 1, alignItems: "center", gap: 5 }}
              >
                <Icon
                  name={["home", "book-open", "bar-chart-2"][i]}
                  color={screen === tab ? C.green : "#9ba69d"}
                  size={21}
                />
                <T
                  style={{
                    fontSize: 10,
                    color: screen === tab ? C.green : "#9ba69d",
                    fontWeight: screen === tab ? "700" : "400",
                  }}
                >
                  {["ホーム", "単語帳", "記録"][i]}
                </T>
              </Pressable>
            ))}
          </View>
        )}
        {(toast || error) && (
          <View
            accessibilityLiveRegion="polite"
            style={{
              position: "absolute",
              bottom: isTab ? 83 : 20,
              left: 20,
              right: 20,
              padding: 17,
              borderRadius: 15,
              backgroundColor: C.ink,
              flexDirection: "row",
              alignItems: "center",
              gap: 10,
            }}
          >
            <T style={{ color: "white", flex: 1, fontSize: 12 }}>
              {error ?? toast}
            </T>
            {undo && (
              <Pressable onPress={() => void undoMaster()}>
                <T style={{ color: "#c7dfae", fontWeight: "600" }}>元に戻す</T>
              </Pressable>
            )}
            {error && (
              <Pressable onPress={clearError}>
                <T style={{ color: "white" }}>閉じる</T>
              </Pressable>
            )}
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}
function BookCover({
  book,
  small = false,
}: {
  book: (typeof books)[number];
  small?: boolean;
}) {
  return (
    <View
      style={{
        width: small ? 72 : 88,
        height: small ? 82 : 117,
        flexShrink: 0,
        borderRadius: 5,
        backgroundColor: book.color,
        padding: small ? 8 : 9,
        justifyContent: "space-between",
        borderLeftWidth: 4,
        borderLeftColor: "#ffffff22",
        transform: [{ rotate: "-3deg" }],
      }}
    >
      <T
        numberOfLines={1}
        style={{
          color: "#ffffffaa",
          fontSize: small ? 6 : 7,
          lineHeight: 10,
          letterSpacing: 0.3,
        }}
      >
        CAMELWORDS
      </T>
      <T
        numberOfLines={1}
        style={{
          color: "white",
          fontSize: small ? 23 : 31,
          fontWeight: "600",
          lineHeight: 38,
          letterSpacing: -1,
        }}
      >
        {book.level || "句"}
      </T>
      <T
        style={{
          color: "#ffffffbb",
          fontSize: 6,
          lineHeight: 8,
          letterSpacing: 0.4,
        }}
      >
        {"TOEIC\nVOCABULARY"}
      </T>
    </View>
  );
}
function Progress({ bookKey, data }: { bookKey: string; data: Data }) {
  const entries = words.filter((w) => w.book === bookKey);
  const mastered = entries.filter(
    (w) =>
      data.states[w.key]?.status === "MASTERED" ||
      (data.states[w.key]?.status === "REVIEW" &&
        data.states[w.key].intervalDays >= 21),
  ).length;
  const percent = Math.round((mastered / entries.length) * 100);
  return (
    <View style={{ gap: 7 }}>
      <View style={s.between}>
        <T style={{ fontSize: 11, color: C.muted }}>
          定着 {mastered} / {entries.length}語
        </T>
        <T style={{ fontSize: 11, color: C.green }}>{percent}%</T>
      </View>
      <View style={{ height: 5, borderRadius: 3, backgroundColor: C.pale }}>
        <View
          style={{
            height: 5,
            width: `${percent}%`,
            backgroundColor: C.green,
            borderRadius: 3,
          }}
        />
      </View>
    </View>
  );
}
function WordRow({
  word,
  state,
  selected,
  onSelect,
  onOpen,
}: {
  word: Word;
  state: string;
  selected?: boolean;
  onSelect?: () => void;
  onOpen: () => void;
}) {
  return (
    <View
      style={[
        s.row,
        {
          backgroundColor: "white",
          padding: 16,
          borderRadius: 14,
          marginBottom: 5,
        },
      ]}
    >
      {onSelect && (
        <Pressable
          accessibilityRole="checkbox"
          accessibilityLabel={`${word.lemma} を選択`}
          accessibilityState={{ checked: selected }}
          onPress={onSelect}
          style={{
            width: 40,
            height: 44,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <View
            style={{
              width: 22,
              height: 22,
              borderWidth: 1,
              borderColor: selected ? C.green : "#c9d3c9",
              borderRadius: 6,
              backgroundColor: selected ? C.green : "white",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {selected && <Icon name="check" size={14} color="white" />}
          </View>
        </Pressable>
      )}
      <Pressable
        onPress={onOpen}
        accessibilityRole="button"
        style={{ flex: 1, gap: 3 }}
      >
        <T style={{ fontSize: 19, fontWeight: "500" }}>{word.lemma}</T>
        <T style={{ fontSize: 12, color: C.muted }}>{word.meaning}</T>
      </Pressable>
      <T style={{ fontSize: 10, color: C.green }}>{state}</T>
      <Pressable accessibilityLabel={`${word.lemma} の詳細`} onPress={onOpen}>
        <Icon name="chevron-right" size={16} color={C.muted} />
      </Pressable>
    </View>
  );
}
