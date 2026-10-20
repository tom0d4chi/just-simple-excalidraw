// Whether a shape sits under the column, tested without a browser.
import { execFileSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const out = join(mkdtempSync(join(tmpdir(), "jse-overlap-")), "overlap.mjs");
execFileSync("npx", ["esbuild", "src/overlap.ts", "--bundle", "--format=esm", "--platform=node",
  `--outfile=${out}`, "--log-level=error"], { stdio: "inherit" });
const { anyElementUnder, elementScreenRect, rectsOverlap } = await import(out);

let fails = 0;
const eq = (name, got, want) => {
  if (JSON.stringify(got) !== JSON.stringify(want)) { fails++; console.log("FAIL", name, "got", JSON.stringify(got), "want", JSON.stringify(want)); }
  else console.log("ok  ", name, JSON.stringify(got));
};

const view = { scrollX: 0, scrollY: 0, zoom: 1, originX: 0, originY: 0 };
const column = [{ left: 348, top: 0, right: 412, bottom: 915 }];
const near = { x: 250, y: 250, width: 220, height: 500 };
const far = { x: -600, y: 250, width: 120, height: 120 };

eq("screen rect", elementScreenRect({ x: 10, y: 20, width: 30, height: 40 }, view), { left: 10, top: 20, right: 40, bottom: 60 });
eq("overlap true", rectsOverlap({ left: 0, top: 0, right: 10, bottom: 10 }, { left: 5, top: 5, right: 20, bottom: 20 }), true);
eq("touching is not overlapping", rectsOverlap({ left: 0, top: 0, right: 10, bottom: 10 }, { left: 10, top: 0, right: 20, bottom: 10 }), false);
eq("shape under the column", anyElementUnder([near], column, view), true);
eq("shape elsewhere", anyElementUnder([far], column, view), false);
eq("deleted shape does not count", anyElementUnder([{ ...near, isDeleted: true }], column, view), false);
eq("no panel, nothing under", anyElementUnder([near], [], view), false);
// a panned camera moves the shape, and with it the answer
eq("panned away", anyElementUnder([near], column, { ...view, scrollX: -900 }), false);
eq("zoomed in: the same scene point lands elsewhere",
   anyElementUnder([{ x: 176, y: 300, width: 4, height: 60 }], column, { ...view, zoom: 2 }), true);
eq("zoomed out: it no longer reaches the column",
   anyElementUnder([{ x: 176, y: 300, width: 4, height: 60 }], column, { ...view, zoom: 1 }), false);

console.log(fails === 0 ? "ALL PASS" : `${fails} FAILURE(S)`);
process.exit(fails === 0 ? 0 : 1);
