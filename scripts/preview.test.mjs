// Builds the pure helper out of src/interaction.ts and checks its geometry.
import { execFileSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const out = join(mkdtempSync(join(tmpdir(), "jse-preview-")), "interaction.mjs");
execFileSync("npx", ["esbuild", "src/interaction.ts", "--bundle", "--format=esm", "--platform=node",
  "--external:@excalidraw/*", `--outfile=${out}`, "--log-level=error"], { stdio: "inherit" });
const { selectionPreviewRects } = await import(out);
const els = [
  { id: "a", type: "rectangle", x: 80, y: 220, width: 120, height: 80 },
  { id: "b", type: "rectangle", x: 300, y: 600, width: 60, height: 40 },
  { id: "c", type: "selection", x: 0, y: 0, width: 400, height: 400 }
];
const view = { scrollX: 0, scrollY: 0, zoom: 1, originX: 0, originY: 0 };
let fails = 0;
const eq = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) { fails++; console.log("FAIL", name, "got", JSON.stringify(got), "want", JSON.stringify(want)); }
  else console.log("ok  ", name, JSON.stringify(got));
};

// 1. geometry independent of where the box starts
const boxA = { left: 40, top: 180, right: 200, bottom: 330 };
eq("caught near box A", selectionPreviewRects(els, view, boxA), [{ id: "a", left: 80, top: 220, width: 120, height: 80 }]);
const boxMoved = { left: 300, top: 400, right: 460, bottom: 700 };
eq("same rect when the box starts elsewhere", selectionPreviewRects(els, view, { left: 60, top: 180, right: 320, bottom: 700 }),
   [{ id: "a", left: 80, top: 220, width: 120, height: 80 }, { id: "b", left: 300, top: 600, width: 60, height: 40 }]);
eq("far box catches nothing", selectionPreviewRects(els, view, { left: 900, top: 900, right: 950, bottom: 950 }), []);

// 2. scroll + zoom + canvas origin are applied to the element, not to the box
const zoomed = { scrollX: 100, scrollY: -50, zoom: 1.5, originX: 10, originY: 20 };
eq("zoomed/scrolled rect", selectionPreviewRects(els, zoomed, { left: 0, top: 0, right: 9999, bottom: 9999 }).filter(r => r.id === "a"),
   [{ id: "a", left: 10 + (80 + 100) * 1.5, top: 20 + (220 - 50) * 1.5, width: 180, height: 120 }]);

// 3. the selection-type element is never reported
eq("no selection pseudo-element", selectionPreviewRects(els, view, { left: -9999, top: -9999, right: 9999, bottom: 9999 }).map(r => r.id), ["a", "b"]);
console.log(fails === 0 ? "ALL PASS" : `${fails} FAILURE(S)`);
process.exit(fails === 0 ? 0 : 1);
