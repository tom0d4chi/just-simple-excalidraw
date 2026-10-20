// What the appearance menu may offer, per element type.
import { execFileSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const out = join(mkdtempSync(join(tmpdir(), "jse-caps-")), "caps.mjs");
execFileSync("npx", ["esbuild", "src/capabilities.ts", "--bundle", "--format=esm", "--platform=node",
  `--outfile=${out}`, "--log-level=error"], { stdio: "inherit" });
const { capabilitiesForTypes, capabilitiesForTool, anyCapability } = await import(out);

let fails = 0;
const keys = (caps) => Object.entries(caps).filter(([, on]) => on).map(([name]) => name);
const eq = (name, got, want) => {
  if (JSON.stringify(got) !== JSON.stringify(want)) { fails++; console.log("FAIL", name, "got", JSON.stringify(got), "want", JSON.stringify(want)); }
  else console.log("ok  ", name, JSON.stringify(got));
};

eq("line: no fill, no corners", keys(capabilitiesForTypes(["line"])), ["stroke", "width", "style"]);
eq("arrow: same as a line", keys(capabilitiesForTypes(["arrow"])), ["stroke", "width", "style"]);
eq("freehand: no line style", keys(capabilitiesForTypes(["freedraw"])), ["stroke", "width"]);
eq("text: colour and size only", keys(capabilitiesForTypes(["text"])), ["stroke", "text"]);
eq("ellipse: fill but no corners", keys(capabilitiesForTypes(["ellipse"])), ["stroke", "fill", "width", "style"]);
eq("rectangle: everything but text", keys(capabilitiesForTypes(["rectangle"])), ["stroke", "fill", "width", "style", "corners"]);
eq("image: nothing at all", [keys(capabilitiesForTypes(["image"])), anyCapability(capabilitiesForTypes(["image"]))], [[], false]);
eq("mixed selection keeps the common ground", keys(capabilitiesForTypes(["rectangle", "text"])), ["stroke"]);
eq("nothing selected -> nothing to show", keys(capabilitiesForTypes([])), []);
eq("text tool offers colour and size", keys(capabilitiesForTool("text")), ["stroke", "text"]);
eq("shape tool offers the drawing defaults", keys(capabilitiesForTool("rectangle")), ["stroke", "fill", "width", "style", "corners"]);
eq("line tool offers what a line can take", keys(capabilitiesForTool("line")), ["stroke", "width", "style"]);
eq("pen tool offers colour and thickness", keys(capabilitiesForTool("freedraw")), ["stroke", "width"]);
eq("hand: nothing to style", [keys(capabilitiesForTool("hand")), anyCapability(capabilitiesForTool("hand"))], [[], false]);
eq("cursor: nothing to style", keys(capabilitiesForTool("selection")), []);
eq("eraser: nothing to style", keys(capabilitiesForTool("eraser")), []);

console.log(fails === 0 ? "ALL PASS" : `${fails} FAILURE(S)`);
process.exit(fails === 0 ? 0 : 1);
