// Snapping to the dot lattice, tested without Obsidian.
import { execFileSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const out = join(mkdtempSync(join(tmpdir(), "jse-snap-")), "snap.mjs");
execFileSync("npx", ["esbuild", "src/snap.ts", "--bundle", "--format=esm", "--platform=node",
  `--outfile=${out}`, "--log-level=error"], { stdio: "inherit" });
const { snapValue, snapElements } = await import(out);

let fails = 0;
const eq = (name, got, want) => {
  if (JSON.stringify(got) !== JSON.stringify(want)) { fails++; console.log("FAIL", name, "got", JSON.stringify(got), "want", JSON.stringify(want)); }
  else console.log("ok  ", name, JSON.stringify(got));
};
const el = (id, x, y, type = "rectangle", nonce = 1) => ({ id, type, x, y, version: 1, versionNonce: nonce });

eq("rounds to nearest", snapValue(37, 20), 40);
eq("rounds down below half", snapValue(28, 20), 20);
eq("zero step is a no-op", snapValue(37, 0), 37);

// one shape, 7px off the lattice
const one = snapElements([el("a", 27, 33)], 20, new Set(["a"]));
eq("one shape snaps to the nearest dot", one.elements.map((e) => [e.x, e.y]), [[20, 40]]);
eq("it bumps the version", [one.changed, one.elements[0].version], [true, 2]);

// already on the lattice: nothing to do
const aligned = snapElements([el("a", 40, 40)], 20, new Set(["a"]));
eq("aligned stays put", [aligned.changed, aligned.elements[0].x], [false, 40]);

// untouched elements are left alone
const other = snapElements([el("a", 27, 33), el("b", 27, 33, "rectangle", 9)], 20, new Set(["a"]));
eq("only the touched element moves", other.elements.map((e) => e.x), [20, 27]);

// a selection moves as one block: both keep their 30px gap
const block = snapElements([el("a", 27, 33), el("b", 57, 33)], 20, new Set(["a", "b"]));
eq("block keeps its internal spacing", block.elements.map((e) => [e.x, e.y]), [[20, 40], [50, 40]]);

// freehand and the like are never snapped
const sketch = snapElements([el("a", 27, 33, "freedraw")], 20, new Set(["a"]));
eq("freedraw is not snapped", [sketch.changed, sketch.elements[0].x], [false, 27]);

// deleted elements are ignored
const gone = snapElements([{ ...el("a", 27, 33), isDeleted: true }], 20, new Set(["a"]));
eq("deleted is ignored", gone.changed, false);

console.log(fails === 0 ? "ALL PASS" : `${fails} FAILURE(S)`);
process.exit(fails === 0 ? 0 : 1);
