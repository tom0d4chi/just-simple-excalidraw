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

eq("empty folder keeps the note folder", drawingFolder({ folder: "", prefix: "" }, "Notes/2026"), "Notes/2026");
eq("folder wins over the note", drawingFolder({ folder: "Excalidraw", prefix: "" }, "Notes/2026"), "Excalidraw");
eq("slashes are trimmed", drawingFolder({ folder: "/Drawings/Sketches/", prefix: "" }, ""), "Drawings/Sketches");
eq("blank folder keeps the note folder", drawingFolder({ folder: "   ", prefix: "" }, ""), "");
const date = new Date(2026, 9, 20, 22, 15, 3);
eq("prefix and stamp", drawingName(date, { folder: "", prefix: "Drawing" }), "Drawing 2026-10-20 22.15.03");
eq("stamp alone", drawingName(date, { folder: "", prefix: "" }), "2026-10-20 22.15.03");
eq("prefix trimmed", drawingName(date, { folder: "", prefix: " Croquis " }), "Croquis 2026-10-20 22.15.03");
console.log(fails === 0 ? "ALL PASS" : `${fails} FAILURE(S)`);
process.exit(fails === 0 ? 0 : 1);
