import {
  readFile,
  writeFile,
  mkdir,
  stat,
  realpath,
  mkdtemp,
  rm,
} from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { parse } from "csv-parse/sync";
import { parseFile } from "music-metadata";
import ffmpeg from "ffmpeg-static";
const exec = promisify(execFile);
const required = {
  words: ["word_key", "lemma", "entry_type", "toeic_level", "review_status"],
  units: ["unit_key", "title_ja", "position"],
  book_entries: ["unit_key", "position", "word_key"],
  pronunciations: [
    "word_key",
    "locale",
    "ipa",
    "audio_file",
    "is_primary",
    "source",
  ],
  senses: [
    "sense_key",
    "word_key",
    "sense_no",
    "part_of_speech",
    "meaning_ja",
    "is_toeic_core",
  ],
  examples: [
    "example_key",
    "sense_key",
    "sentence_en",
    "sentence_ja",
    "position",
  ],
  forms: ["word_key", "form_type", "form", "is_irregular"],
  relations: [
    "source_word_key",
    "target_word_key",
    "relation_type",
    "position",
  ],
  mnemonics: ["mnemonic_key", "word_key", "type", "content_ja", "position"],
};
const optional = new Set(["forms", "relations", "mnemonics"]);
export const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
export async function validatePackage(directory) {
  const root = await realpath(directory);
  const errors = [],
    warnings = [],
    media = new Map(),
    tables = {};
  let manifest;
  try {
    manifest = JSON.parse(
      await readFile(path.join(root, "manifest.json"), "utf8"),
    );
  } catch (e) {
    return { errors: [`manifest.json: ${e.message}`], warnings };
  }
  const fail = (x) => errors.push(x);
  const warn = (x) => warnings.push(x);
  const validKey = (x) => typeof x === "string" && /^[a-z0-9_-]+$/.test(x);
  if (manifest.schema_version !== "1.0") fail("Unsupported schema_version");
  if (!/^[a-z0-9-]+$/.test(manifest.package_id ?? ""))
    fail("Invalid package_id");
  if (!/^\d+\.\d+\.\d+$/.test(manifest.version ?? "")) fail("Invalid version");
  if (manifest.mode !== "upsert")
    fail("Only non-destructive upsert mode is supported");
  if (
    !manifest.book?.book_key ||
    !manifest.book?.title_ja ||
    !manifest.license?.owner ||
    !manifest.license?.type
  )
    fail("Book identity and content license are required");
  for (const [name, fields] of Object.entries(required)) {
    try {
      const rows = parse(
        await readFile(path.join(root, `${name}.csv`), "utf8"),
        {
          columns: (headers) => {
            for (const f of fields)
              if (!headers.includes(f)) fail(`${name}: missing column ${f}`);
            return headers;
          },
          bom: true,
          skip_empty_lines: true,
        },
      );
      tables[name] = rows;
      for (const [i, row] of rows.entries())
        for (const [k, v] of Object.entries(row)) {
          if (v !== v.trim()) fail(`${name}:${i + 2}: whitespace in ${k}`);
          if (fields.includes(k) && !v) fail(`${name}:${i + 2}: empty ${k}`);
        }
    } catch (e) {
      tables[name] = [];
      if (!(optional.has(name) && e.code === "ENOENT"))
        fail(`${name}: ${e.message}`);
    }
  }
  const unique = (name, key) => {
    const seen = new Set();
    for (const row of tables[name]) {
      if (!row[key] || seen.has(row[key]))
        fail(`${name}: duplicate/missing ${key} ${row[key]}`);
      seen.add(row[key]);
    }
    return seen;
  };
  const wordKeys = unique("words", "word_key"),
    senseKeys = unique("senses", "sense_key"),
    unitKeys = unique("units", "unit_key");
  unique("examples", "example_key");
  unique("book_entries", "position");
  unique("mnemonics", "mnemonic_key");
  unique("units", "position");
  const enumCheck = (row, key, values, context) => {
    if (!values.includes(row[key]))
      fail(`${context}: invalid ${key} ${row[key]}`);
  };
  const positive = (value, label) => {
    if (!/^[1-9]\d*$/.test(value)) fail(`${label}: expected positive integer`);
  };
  async function checkMedia(file, maxSeconds) {
    if (!file) return;
    if (media.has(file)) {
      if (media.get(file).duration > maxSeconds)
        fail(`${file}: audio too long`);
      return;
    }
    try {
      if (path.isAbsolute(file)) throw Error("absolute path");
      const target = await realpath(path.resolve(root, file));
      if (!target.startsWith(root + path.sep) || !(await stat(target)).isFile())
        throw Error("path outside package or not a file");
      const bytes = await readFile(target);
      const record = { file, hash: sha(bytes), bytes: bytes.length };
      if (maxSeconds) {
        if (path.extname(file).toLowerCase() !== ".mp3")
          throw Error("audio must be MP3");
        const meta = await parseFile(target, { duration: true });
        if (
          !Number.isFinite(meta.format.duration) ||
          meta.format.duration <= 0 ||
          meta.format.duration > maxSeconds
        )
          throw Error(`duration must be 0–${maxSeconds} seconds`);
        if (meta.format.numberOfChannels !== 1)
          throw Error("audio must be mono");
        record.duration = meta.format.duration;
        await exec(
          ffmpeg,
          ["-v", "error", "-xerror", "-i", target, "-f", "null", "-"],
          { timeout: 30000 },
        );
        if (Math.abs((meta.format.bitrate ?? 0) - 64000) > 3000)
          warn(`${file}: expected 64 kbps`);
      }
      media.set(file, record);
    } catch (e) {
      fail(`Media ${file}: ${e.message}`);
    }
  }
  for (const w of tables.words) {
    if (!validKey(w.word_key)) fail(`Invalid word key ${w.word_key}`);
    enumCheck(w, "entry_type", ["WORD", "PHRASE"], w.word_key);
    enumCheck(w, "toeic_level", ["600", "730", "860", "990"], w.word_key);
    enumCheck(w, "review_status", ["DRAFT", "REVIEWED"], w.word_key);
    const senses = tables.senses.filter((s) => s.word_key === w.word_key);
    if (!senses.length) fail(`No sense: ${w.word_key}`);
    if (
      !tables.examples.some((e) =>
        senses.some((s) => s.sense_key === e.sense_key),
      )
    )
      fail(`No example: ${w.word_key}`);
    if (
      tables.pronunciations.filter(
        (p) => p.word_key === w.word_key && p.is_primary === "true",
      ).length !== 1
    )
      fail(`Expected one primary pronunciation: ${w.word_key}`);
    if (
      !tables.pronunciations.some(
        (p) => p.word_key === w.word_key && p.locale === "en-GB",
      )
    )
      warn(`Missing UK audio: ${w.word_key}`);
  }
  const pronunciationKeys = new Set();
  for (const p of tables.pronunciations) {
    if (!wordKeys.has(p.word_key))
      fail(`Unknown pronunciation word ${p.word_key}`);
    const key = p.word_key + ":" + p.locale;
    if (pronunciationKeys.has(key)) fail(`Duplicate pronunciation ${key}`);
    pronunciationKeys.add(key);
    enumCheck(p, "locale", ["en-US", "en-GB"], key);
    enumCheck(p, "source", ["TTS", "RECORDED"], key);
    enumCheck(p, "is_primary", ["true", "false"], key);
    if (!/^\/.+\/$/.test(p.ipa)) fail(`Invalid IPA ${key}`);
    await checkMedia(p.audio_file, 4);
  }
  for (const s of tables.senses) {
    if (!wordKeys.has(s.word_key) || !s.sense_key.startsWith(s.word_key + "-s"))
      fail(`Invalid sense reference ${s.sense_key}`);
    positive(s.sense_no, s.sense_key);
    enumCheck(
      s,
      "part_of_speech",
      ["noun", "verb", "adj", "adv", "prep", "conj", "phrase"],
      s.sense_key,
    );
    enumCheck(s, "is_toeic_core", ["true", "false"], s.sense_key);
    if (s.meaning_ja.length > 30) warn(`Long meaning: ${s.sense_key}`);
  }
  for (const e of tables.examples) {
    if (
      !senseKeys.has(e.sense_key) ||
      !e.example_key.startsWith(e.sense_key + "-e")
    )
      fail(`Invalid example reference ${e.example_key}`);
    positive(e.position, e.example_key);
    if (
      (e.sentence_en.match(/\[\[[^\[\]]+\]\]/g) ?? []).length !== 1 ||
      e.sentence_en.replace(/\[\[[^\[\]]+\]\]/g, "").includes("[[") ||
      e.sentence_en.replace(/\[\[[^\[\]]+\]\]/g, "").includes("]]")
    )
      fail(`Expected one target marker: ${e.example_key}`);
    if (e.sentence_en.split(/\s+/).length > 25)
      warn(`Long example: ${e.example_key}`);
    if (e.scene)
      enumCheck(
        e,
        "scene",
        [
          "meeting",
          "office",
          "hiring",
          "travel",
          "finance",
          "shopping",
          "other",
        ],
        e.example_key,
      );
    await checkMedia(e.audio_file, 12);
  }
  for (const u of tables.units) {
    if (!u.unit_key.startsWith(manifest.book?.book_key + "-u"))
      fail(`Invalid unit key ${u.unit_key}`);
    positive(u.position, u.unit_key);
  }
  for (const e of tables.book_entries) {
    positive(e.position, `entry ${e.word_key}`);
    if (
      !wordKeys.has(e.word_key) ||
      !unitKeys.has(e.unit_key) ||
      (e.display_sense_key &&
        !tables.senses.some(
          (s) =>
            s.sense_key === e.display_sense_key && s.word_key === e.word_key,
        ))
    )
      fail(`Invalid book entry ${e.word_key}`);
    if (e.importance) enumCheck(e, "importance", ["A", "B", "C"], e.word_key);
  }
  for (const f of tables.forms) {
    if (!wordKeys.has(f.word_key)) fail(`Unknown form word ${f.word_key}`);
    enumCheck(
      f,
      "form_type",
      [
        "PLURAL",
        "PAST",
        "PAST_PARTICIPLE",
        "ING",
        "THIRD_PERSON",
        "COMPARATIVE",
        "SUPERLATIVE",
      ],
      f.word_key,
    );
    enumCheck(f, "is_irregular", ["true", "false"], f.word_key);
  }
  for (const r of tables.relations) {
    if (!wordKeys.has(r.source_word_key) || !wordKeys.has(r.target_word_key))
      fail(
        `Relation must resolve within this package: ${r.source_word_key} -> ${r.target_word_key}`,
      );
    enumCheck(
      r,
      "relation_type",
      [
        "SYNONYM",
        "ANTONYM",
        "DERIVATIVE",
        "CONFUSABLE",
        "RELATED",
        "GENDER_PAIR",
      ],
      r.source_word_key,
    );
    positive(r.position, r.source_word_key);
  }
  for (const m of tables.mnemonics) {
    if (
      !wordKeys.has(m.word_key) ||
      (m.sense_key &&
        !tables.senses.some(
          (s) => s.sense_key === m.sense_key && s.word_key === m.word_key,
        ))
    )
      fail(`Invalid mnemonic reference ${m.mnemonic_key}`);
    enumCheck(
      m,
      "type",
      ["ETYMOLOGY", "ROOT", "ASSOCIATION", "TIP", "CONTRAST"],
      m.mnemonic_key,
    );
    positive(m.position, m.mnemonic_key);
    if (m.content_ja.length > 120) warn(`Long mnemonic ${m.mnemonic_key}`);
  }
  if (manifest.book?.cover_file) await checkMedia(manifest.book.cover_file, 0);
  return {
    root,
    manifest,
    tables,
    media: [...media.values()],
    errors,
    warnings,
  };
}
export function compilePackage(result) {
  const { manifest, tables, media } = result;
  const reviewed = new Set(
    tables.words
      .filter((w) => w.review_status === "REVIEWED")
      .map((w) => w.word_key),
  );
  const words = tables.words
    .filter((w) => reviewed.has(w.word_key))
    .map(({ note_internal, ...w }) => ({
      ...w,
      senses: tables.senses
        .filter((s) => s.word_key === w.word_key)
        .map((s) => ({
          ...s,
          examples: tables.examples.filter((e) => e.sense_key === s.sense_key),
        })),
      pronunciations: tables.pronunciations.filter(
        (p) => p.word_key === w.word_key,
      ),
      forms: tables.forms.filter((f) => f.word_key === w.word_key),
      relations: tables.relations.filter(
        (r) =>
          r.source_word_key === w.word_key && reviewed.has(r.target_word_key),
      ),
      mnemonics: tables.mnemonics.filter((m) => m.word_key === w.word_key),
    }));
  const used = new Set(
    [
      manifest.book.cover_file,
      ...words.flatMap((w) => [
        ...w.pronunciations.map((p) => p.audio_file),
        ...w.senses.flatMap((s) => s.examples.map((e) => e.audio_file)),
      ]),
    ].filter(Boolean),
  );
  return {
    manifest,
    words,
    units: tables.units,
    entries: tables.book_entries.filter((e) => reviewed.has(e.word_key)),
    media: media.filter((m) => used.has(m.file)),
  };
}
export async function writeCompiled(result) {
  const compiled = compilePackage(result);
  const json = JSON.stringify(compiled);
  await mkdir(path.join(result.root, "dist"), { recursive: true });
  await writeFile(path.join(result.root, "dist", "content.json"), json);
  return { compiled, json, hash: sha(json) };
}
