#!/usr/bin/env node
/*
 * Publishes the built files to the `build` branch, which is what the plugin's updater reads.
 *
 * The stamp on the first line of main.js is not decoration: raw.githubusercontent caches each
 * path for five minutes, so it can serve a fresh manifest next to a main.js from the previous
 * build. The plugin compares that stamp with the manifest version and refuses a mismatch, which
 * only works if every published build carries one.
 *
 * Usage: node scripts/publish-build.mjs
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync, copyFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const dist = join(root, "dist");
const manifest = JSON.parse(readFileSync(join(dist, "manifest.json"), "utf8"));
const version = manifest.version;

const work = mkdtempSync(join(tmpdir(), "jse-build-"));
const git = (...args) => execFileSync("git", args, { cwd: work, stdio: "pipe" });

try {
  git("init", "-q");
  git("remote", "add", "origin", "https://github.com/tom0d4chi/just-simple-excalidraw.git");
  // A fresh repository has no commit yet: an orphan checkout is how a root branch gets born.
  git("checkout", "-q", "--orphan", "build");

  const main = readFileSync(join(dist, "main.js"), "utf8");
  writeFileSync(join(work, "main.js"), `/* jse-build ${version} */\n${main}`);
  copyFileSync(join(dist, "styles.css"), join(work, "styles.css"));
  copyFileSync(join(dist, "manifest.json"), join(work, "manifest.json"));

  git("add", "-A");
  git("-c", "user.name=tom0d4chi", "-c", "user.email=tomod4chi@pm.me", "commit", "-q", "-m", `Build ${version}`);
  git("push", "-q", "origin", "build", "--force");
  console.log(`build branch: ${version} (stamped)`);
} finally {
  rmSync(work, { recursive: true, force: true });
}
