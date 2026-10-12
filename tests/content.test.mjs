import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, mkdir, rm } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import ffmpeg from "ffmpeg-static";
import { validatePackage, compilePackage } from "../tools/content.mjs";
const exec = promisify(execFile);
async function fixture() {
  const dir = await mkdtemp(path.join(os.tmpdir(), "camel-content-"));
  await mkdir(path.join(dir, "media"));
  const data = {
    "manifest.json": JSON.stringify({
      schema_version: "1.0",
      package_id: "toeic-600",
      version: "1.0.0",
      mode: "upsert",
      book: { book_key: "toeic-600", title_ja: "テスト" },
      license: { type: "TEST", owner: "Test fixture" },
    }),
    "words.csv":
      "word_key,lemma,entry_type,toeic_level,review_status,note_internal\nappointment,appointment,WORD,600,REVIEWED,PRIVATE_EDITOR_NOTE\n",
    "units.csv": "unit_key,title_ja,position\ntoeic-600-u01,予定,1\n",
    "book_entries.csv":
      "unit_key,position,word_key\ntoeic-600-u01,1,appointment\n",
    "pronunciations.csv":
      "word_key,locale,ipa,audio_file,is_primary,source\nappointment,en-US,/əˈpɔɪntmənt/,media/appointment.mp3,true,TTS\n",
    "senses.csv":
      "sense_key,word_key,sense_no,part_of_speech,meaning_ja,is_toeic_core\nappointment-s1,appointment,1,noun,予約,true\n",
    "examples.csv":
      "example_key,sense_key,sentence_en,sentence_ja,position\nappointment-s1-e1,appointment-s1,I have an [[appointment]].,予約があります。,1\n",
  };
  await Promise.all(
    Object.entries(data).map(([name, text]) =>
      writeFile(path.join(dir, name), text),
    ),
  );
  await exec(ffmpeg, [
    "-v",
    "error",
    "-f",
    "lavfi",
    "-i",
    "sine=frequency=440:duration=0.3",
    "-ac",
    "1",
    "-b:a",
    "64k",
    path.join(dir, "media/appointment.mp3"),
  ]);
  return { dir, data };
}
test("reviewed content compiles without internal editorial notes", async () => {
  const { dir } = await fixture();
  try {
    const result = await validatePackage(dir);
    assert.deepEqual(result.errors, []);
    const compiled = compilePackage(result);
    assert.equal(compiled.words.length, 1);
    assert.ok(!JSON.stringify(compiled).includes("PRIVATE_EDITOR_NOTE"));
    assert.ok(result.warnings.some((x) => x.includes("UK")));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
test("invalid references and duplicate target markers block import", async () => {
  const { dir } = await fixture();
  try {
    await writeFile(
      path.join(dir, "examples.csv"),
      "example_key,sense_key,sentence_en,sentence_ja,position\nbad-e1,missing,[[one]] [[two]],テスト,1\n",
    );
    const result = await validatePackage(dir);
    assert.ok(result.errors.some((x) => x.includes("reference")));
    assert.ok(result.errors.some((x) => x.includes("target marker")));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
test("corrupt audio blocks publication even if file exists", async () => {
  const { dir } = await fixture();
  try {
    await writeFile(
      path.join(dir, "media/appointment.mp3"),
      "not an audio file",
    );
    const result = await validatePackage(dir);
    assert.ok(result.errors.some((x) => x.startsWith("Media")));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
test("draft words and their media do not enter the compiled package", async () => {
  const { dir, data } = await fixture();
  try {
    await writeFile(
      path.join(dir, "words.csv"),
      data["words.csv"].replace("REVIEWED", "DRAFT"),
    );
    const result = await validatePackage(dir);
    assert.deepEqual(result.errors, []);
    const compiled = compilePackage(result);
    assert.equal(compiled.words.length, 0);
    assert.equal(compiled.entries.length, 0);
    assert.equal(compiled.media.length, 0);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
