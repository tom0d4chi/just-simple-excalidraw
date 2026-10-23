// Folder and file name rules for new drawings, tested without Obsidian.
import { execFileSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const out = join(mkdtempSync(join(tmpdir(), "jse-naming-")), "naming.mjs");
execFileSync("npx", ["esbuild", "src/naming.ts", "--bundle", "--format=esm", "--platform=node",
  `--outfile=${out}`, "--log-level=error"], { stdio: "inherit" });
const { drawingFolder, drawingName, formatStamp, safeName } = await import(out);

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
// stamp patterns
eq("tokens are filled", formatStamp(date, "YYYY/MM/DD HH:mm:ss"), "2026/10/20 22:15:03");
// Only the documented tokens are replaced: "MMM" is "MM" followed by a literal M.
eq("longer tokens are not guessed", formatStamp(date, "YYYY MMM"), "2026 10M");
eq("compact pattern", drawingName(date, { folder: "", prefix: "", dateFormat: "YYYYMMDD-HHmm" }), "20261020-2215");
eq("no stamp at all", drawingName(date, { folder: "", prefix: "Sketch", dateFormat: "" }), "Sketch");
eq("suffix joins the name", drawingName(date, { folder: "", prefix: "Drawing", suffix: "Projet", dateFormat: "YYYY-MM-DD" }), "Drawing 2026-10-20 Projet");
eq("forbidden characters are replaced", safeName('a/b:c*d?"e"<f>g|h'), "a-b-c-d-e-f-g-h");
eq("names cannot end with a dot", safeName("Drawing."), "Drawing");
eq("an empty result falls back to the stamp", drawingName(date, { folder: "", prefix: "/", suffix: "/", dateFormat: "" }), "2026-10-20 22.15.03");

console.log(fails === 0 ? "ALL PASS" : `${fails} FAILURE(S)`);
process.exit(fails === 0 ? 0 : 1);
