// Folder and file name rules for new drawings, tested without Obsidian.
import { execFileSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const out = join(mkdtempSync(join(tmpdir(), "jse-naming-")), "naming.mjs");
execFileSync("npx", ["esbuild", "src/naming.ts", "--bundle", "--format=esm", "--platform=node",
  `--outfile=${out}`, "--log-level=error"], { stdio: "inherit" });
const { drawingFolder, drawingName } = await import(out);

let fails = 0;
const eq = (name, got, want) => {
  if (JSON.stringify(got) !== JSON.stringify(want)) { fails++; console.log("FAIL", name, "got", JSON.stringify(got), "want", JSON.stringify(want)); }
  else console.log("ok  ", name, JSON.stringify(got));
};

eq("note mode follows the note", drawingFolder({ mode: "note", folder: "Ignored", prefix: "" }, "Notes/2026"), "Notes/2026");
eq("vault mode means the root", drawingFolder({ mode: "vault", folder: "Ignored", prefix: "" }, "Notes/2026"), "");
eq("fixed mode wins over the note", drawingFolder({ mode: "fixed", folder: "Excalidraw", prefix: "" }, "Notes/2026"), "Excalidraw");
eq("slashes are trimmed", drawingFolder({ mode: "fixed", folder: "/Drawings/Sketches/", prefix: "" }, ""), "Drawings/Sketches");
eq("fixed but blank falls back to the note", drawingFolder({ mode: "fixed", folder: "   ", prefix: "" }, "Notes/2026"), "Notes/2026");
eq("no mode at all behaves like note mode", drawingFolder({ folder: "Ignored", prefix: "" }, "Notes/2026"), "Notes/2026");
const date = new Date(2026, 9, 20, 22, 15, 3);
eq("prefix and stamp", drawingName(date, { folder: "", prefix: "Drawing" }), "Drawing 2026-10-20 22.15.03");
eq("stamp alone", drawingName(date, { folder: "", prefix: "" }), "2026-10-20 22.15.03");
eq("prefix trimmed", drawingName(date, { folder: "", prefix: " Croquis " }), "Croquis 2026-10-20 22.15.03");
console.log(fails === 0 ? "ALL PASS" : `${fails} FAILURE(S)`);
process.exit(fails === 0 ? 0 : 1);
