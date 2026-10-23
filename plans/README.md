# Animation plans — Canvas Drawings

Written by `improve-animations` (Emil Kowalski's rule catalog) at commit `a6e9950`, version
0.1.93. The audit these come from is [audit-animations.md](audit-animations.md). Each plan is
self-contained: paths, current code, exact target values, boundaries, and a feel check.

Applied in 0.1.94, then reverted in 0.1.95 (the code is back to 0.1.93). The plans themselves
are unchanged and still exact for a6e9950 — line numbers have not moved since.

## Plans

| # | Title | Severity | Needs | Status |
|---|---|---|---|---|
| [006](006-easing-tokens.md) | Put the curves in tokens first | LOW | — | DONE |
| [001](001-marks-travel-on-transform.md) | Marks travel on `transform`, not `left`/`top` | HIGH | 006 (soft) | DONE |
| [002](002-menus-use-transitions.md) | Strip and collapsible rows use transitions | HIGH | 006 (soft) | DONE |
| [003](003-press-feedback.md) | Press feedback 140 ms, `scale(0.96)` | MEDIUM | 006 (soft) | DONE |
| [004](004-drop-the-overshoot-curve.md) | Drop the overshoot curve | MEDIUM | 006 (soft) | DONE |
| [005](005-reduced-motion-coverage.md) | Reduced motion for marks, panel, corner, zoom | MEDIUM | 001, 002 (soft) | DONE |
| [007](007-stagger-by-row.md) | Stagger the value chips by row | LOW | — | DONE |
| [008](008-mask-family-swap.md) | Mask the family swap with a 2 px blur | LOW | — | DONE |
| [009](009-popover-origin.md) | Origin the popover at its trigger | LOW | — | DONE |
| [010](010-multiselect-armed-pulse.md) | A one-shot pulse when multi-select arms | LOW | — | DONE |

"Soft" means the plan is written for the literal values and works on its own; if the dependency
landed first, use the token it introduced instead of the literal.

## Recommended order

1. **006** — tokens. One mechanical commit, no visual change, and every later plan becomes shorter.
2. **001** — the marks. Biggest win on Android: removes layout and paint from the two animations
   that run over a live canvas.
3. **002** — the strip. Removes the flash on rapid toggling, which is the most likely thing to be
   noticed by a user of the plugin.
4. **003** and **004** — small, independent, both only touch the column's own feedback.
5. **005** — reduced motion, after 001 and 002 so it covers the final property names.
6. **007** — the chip stagger, any time.
7. **008**, **009**, **010** — the additive ones. 008 is the most felt (family switching is common
   in the popover); 010 the most optional.

## Dependencies

- 005 reads the mark rules that **001** rewrites (it overrides their `transition` shorthand). If
  001 is skipped, 005 still applies but its selector comment about `transform` should be dropped.
- 002 deletes the four keyframes `jse-menu-in/out` and `jse-tool-in/out`; nothing else in the
  plugin uses them — confirm with `grep -n "jse-tool-in\|jse-menu-in" src/` before deleting.
- 006 must not change any duration, so 001-004 keep their own timing decisions.

## Executing

Any agent can run a plan with no context from this conversation: it needs only the plan file and
the repository. Run `npm run check` after each plan; it exercises the appearance panel and the
toolbar through a headless harness, which is the cheapest way to catch a broken selector.
