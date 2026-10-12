#!/usr/bin/env node
import { readFile, writeFile, mkdir, realpath } from "node:fs/promises";
import path from "node:path";
import AdmZip from "adm-zip";
import { validatePackage, writeCompiled, sha } from "./content.mjs";
const [command, input, ...args] = process.argv.slice(2);
const flag = (name) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
};
if (
  !["validate", "compile", "pack", "dry-run", "publish", "rollback"].includes(
    command,
  ) ||
  !input
)
  throw Error(
    "Usage: content-cli validate|compile|pack|dry-run|publish <directory>; rollback <package-id> --to <version> --project <id>",
  );
const project = flag("--project");
const bucketName = flag("--bucket");
async function admin() {
  if (!project) throw Error("--project is required for cloud operations");
  const { initializeApp, applicationDefault } =
    await import("firebase-admin/app");
  const { getFirestore, FieldValue } = await import("firebase-admin/firestore");
  const { getStorage } = await import("firebase-admin/storage");
  initializeApp({
    credential: applicationDefault(),
    projectId: project,
    storageBucket: bucketName,
  });
  return { db: getFirestore(), storage: getStorage(), FieldValue };
}
if (command === "rollback") {
  const version = flag("--to");
  if (!/^[a-z0-9-]+$/.test(input) || !/^\d+\.\d+\.\d+$/.test(version ?? ""))
    throw Error("Invalid package/version");
  const { db, FieldValue } = await admin();
  const root = db.doc(`contentPackages/${input}`);
  await db.runTransaction(async (tx) => {
    const previous = await tx.get(root.collection("versions").doc(version));
    if (!previous.exists || previous.data().status !== "PUBLISHED")
      throw Error("Published version does not exist");
    tx.set(root, {
      ...previous.data(),
      updatedAt: FieldValue.serverTimestamp(),
      rolledBack: true,
    });
  });
  console.log(`Rolled back ${input} to ${version}`);
  process.exit(0);
}
const result = await validatePackage(input);
console.log(
  JSON.stringify(
    {
      errors: result.errors,
      warnings: result.warnings,
      words: result.tables?.words.length,
      mediaFiles: result.media?.length,
    },
    null,
    2,
  ),
);
if (result.errors.length) process.exit(1);
if (command === "validate") process.exit(0);
const { compiled, json, hash } = await writeCompiled(result);
if (command === "compile") {
  console.log(
    `Compiled ${compiled.words.length} reviewed words, SHA256 ${hash}`,
  );
  process.exit(0);
}
if (command === "pack") {
  const zip = new AdmZip();
  const candidates = [
    "manifest.json",
    ...Object.keys(result.tables).map((t) => `${t}.csv`),
    ...result.media.map((m) => m.file),
  ];
  for (const file of candidates) {
    try {
      zip.addFile(file, await readFile(path.join(result.root, file)));
    } catch (e) {
      if (e.code !== "ENOENT") throw e;
    }
  }
  const out = path.join(
    result.root,
    "dist",
    `${result.manifest.package_id}-${result.manifest.version}.zip`,
  );
  zip.writeZip(out);
  console.log(out);
  process.exit(0);
}
const { db, storage, FieldValue } = await admin();
const root = db.doc(`contentPackages/${compiled.manifest.package_id}`);
const previous = await root.get();
const previousWords =
  previous.exists && previous.data().latestVersion
    ? ((
        await root
          .collection("versions")
          .doc(previous.data().latestVersion)
          .get()
      ).data()?.wordHashes ?? {})
    : {};
const wordHashes = Object.fromEntries(
  compiled.words.map((w) => [w.word_key, sha(JSON.stringify(w))]),
);
const diff = { added: [], modified: [], unchanged: [], removed: [] };
for (const [key, value] of Object.entries(wordHashes))
  diff[
    !(key in previousWords)
      ? "added"
      : previousWords[key] === value
        ? "unchanged"
        : "modified"
  ].push(key);
diff.removed = Object.keys(previousWords).filter((k) => !(k in wordHashes));
const approval = {
  project,
  package: compiled.manifest.package_id,
  version: compiled.manifest.version,
  hash,
  baseVersion: previous.data()?.latestVersion ?? null,
  diff,
};
if (command === "dry-run") {
  await writeFile(
    path.join(result.root, "dist", "dry-run.json"),
    JSON.stringify(approval, null, 2),
  );
  console.log(JSON.stringify(approval, null, 2));
  process.exit(0);
}
if (!bucketName || !flag("--reviewed-by"))
  throw Error("publish requires explicit --bucket and --reviewed-by");
const report = JSON.parse(
  await readFile(path.join(result.root, "dist", "dry-run.json"), "utf8"),
);
if (
  report.hash !== hash ||
  report.project !== project ||
  report.baseVersion !== approval.baseVersion
)
  throw Error(
    "Content or online version changed: rerun dry-run before publishing",
  );
if (!compiled.words.length)
  throw Error("Refusing to publish an empty reviewed package");
const bucket = storage.bucket(bucketName);
const prefix = `content/${compiled.manifest.package_id}/${compiled.manifest.version}`;
// Upload immutable objects first. A failed upload leaves the published pointer unchanged.
for (const media of compiled.media) {
  const file = bucket.file(
    `content/media/${media.hash}${path.extname(media.file)}`,
  );
  const [exists] = await file.exists();
  if (!exists)
    await bucket.upload(path.join(result.root, media.file), {
      destination: file.name,
      preconditionOpts: { ifGenerationMatch: 0 },
      metadata: { cacheControl: "public,max-age=31536000,immutable" },
    });
}
const storagePath = `${prefix}/content.json`;
const file = bucket.file(storagePath);
const [exists] = await file.exists();
if (exists) {
  const [bytes] = await file.download();
  if (sha(bytes) !== hash)
    throw Error(
      "This version already exists with different content; increment version",
    );
} else
  await file.save(json, {
    resumable: false,
    preconditionOpts: { ifGenerationMatch: 0 },
    contentType: "application/json",
    metadata: { cacheControl: "public,max-age=31536000,immutable" },
  });
const published = {
  bookKey: compiled.manifest.book.book_key,
  titleJa: compiled.manifest.book.title_ja,
  latestVersion: compiled.manifest.version,
  schemaVersion: "1.0",
  storagePath,
  bucket: bucketName,
  sha256: hash,
  status: "PUBLISHED",
  wordHashes,
  publishedBy: flag("--reviewed-by"),
  publishedAt: FieldValue.serverTimestamp(),
};
await db.runTransaction(async (tx) => {
  const current = await tx.get(root);
  const versionRef = root.collection("versions").doc(compiled.manifest.version);
  const version = await tx.get(versionRef);
  if ((current.data()?.latestVersion ?? null) !== approval.baseVersion)
    throw Error("Concurrent publication: rerun dry-run");
  if (version.exists && version.data().sha256 !== hash)
    throw Error("Published versions are immutable");
  tx.set(versionRef, published);
  tx.set(root, published);
});
console.log(
  `Published ${compiled.manifest.package_id}@${compiled.manifest.version}`,
);
