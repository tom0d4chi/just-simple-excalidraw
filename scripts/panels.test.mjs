// Following a popover's box, tested without a browser.
//
// The bug this covers: the backing under the column was decided from a rect read once,
// when the menu was toggled. A family panel then animates its height in *after* that read,
// so the area it gains was never counted — the menu looked like it was "not even seen".
// The fix watches the boxes; this pins the watch's contract: every new node is observed
// once, a node that leaves is unobserved, a size change calls back once, a missing
// ResizeObserver is a no-op instead of a crash (the unit-test mocks have none).
import { execFileSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const out = join(mkdtempSync(join(tmpdir(), "jse-panels-")), "panels.mjs");
execFileSync("npx", ["esbuild", "src/panels.ts", "--bundle", "--format=esm", "--platform=node",
  `--outfile=${out}`, "--log-level=error"], { stdio: "inherit" });

let fails = 0;
const eq = (name, got, want) => {
  if (JSON.stringify(got) !== JSON.stringify(want)) { fails++; console.log("FAIL", name, "got", JSON.stringify(got), "want", JSON.stringify(want)); }
  else console.log("ok  ", name, JSON.stringify(got));
};

// A stand-in for the DOM nodes: the watch only compares identities.
const node = (id) => ({ id });

class FakeObserver {
  static instances = [];
  constructor(callback) {
    this.callback = callback;
    this.observed = new Set();
    FakeObserver.instances.push(this);
  }
  observe(node) { this.observed.add(node); }
  unobserve(node) { this.observed.delete(node); }
  disconnect() { this.observed.clear(); }
  fire() { this.callback([], this); }
}

let calls = 0;
let watch;

// 1. no ResizeObserver (the mock environment): observing and disconnecting are harmless
{
  const { watchPanelSizes } = await import(out);
  const inert = watchPanelSizes(() => { calls++; });
  inert.observe([node("a")]);
  inert.disconnect();
  eq("no observer: no crash, no callback", calls, 0);
}

// 2. with one: nodes are watched exactly once, dropped nodes are released
globalThis.ResizeObserver = FakeObserver;
{
  const { watchPanelSizes } = await import(out);
  const column = node("column");
  const menu = node("menu");
  watch = watchPanelSizes(() => { calls++; });
  watch.observe([column, menu]);
  const observer = FakeObserver.instances.at(-1);
  eq("both boxes observed", [...observer.observed].map((n) => n.id), ["column", "menu"]);
  watch.observe([column, menu]);
  eq("re-observing the same nodes adds nothing", observer.observed.size, 2);
  eq("callback not fired by observing", calls, 0);
}

// 3. a size change is what re-measures
{
  const observer = FakeObserver.instances.at(-1);
  observer.fire();
  eq("a grown box asks for a new measure", calls, 1);
}

// 4. a node that is gone from the DOM cannot be watched for ever
{
  const column = node("column");
  const other = node("replacement");
  watch.observe([column, other]);
  const observer = FakeObserver.instances.at(-1);
  eq("stale node released, new one watched", [...observer.observed].map((n) => n.id), ["column", "replacement"]);
}

// 5. unmount leaves nothing behind
{
  watch.disconnect();
  const observer = FakeObserver.instances.at(-1);
  eq("disconnect releases every box", observer.observed.size, 0);
}

console.log(fails === 0 ? "ALL PASS" : `${fails} FAILURE(S)`);
process.exit(fails === 0 ? 0 : 1);
