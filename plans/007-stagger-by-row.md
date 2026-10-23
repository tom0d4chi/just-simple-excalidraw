# 007 — Stagger the value chips by row, not by cell

- **Status**: TODO
- **Commit**: a6e9950
- **Severity**: LOW
- **Category**: Stagger
- **Estimated scope**: 1 file (`src/styles.css`), 11 rules become 2

## Problem

The chips inside the appearance panel stagger by DOM order, +18 ms each. The panel is a 5-column
grid, so the stagger does not follow what the eye sees: the second row starts 90 ms after the
first, and the last cell of an 11-item family lands at 180 + 140 = 320 ms — past the 300 ms UI
budget. The delay is also linear per cell, so the effect reads as a sweep from top-left rather
than as rows landing.

```css
/* src/styles.css:1153-1167 — current */
.jse-appearance__panel .jse-appearance__chip {
  animation: jse-appearance-in 140ms ease-out backwards;
}

.jse-appearance__panel .jse-appearance__chip:nth-child(1) { animation-delay: 0ms; }
.jse-appearance__panel .jse-appearance__chip:nth-child(2) { animation-delay: 18ms; }
...
.jse-appearance__panel .jse-appearance__chip:nth-child(11) { animation-delay: 180ms; }
```

## Target

Two rules, one delay per row, total entrance ≤ 200 ms:

```css
/* target — src/styles.css, replaces 1153-1167 */
.jse-appearance__panel .jse-appearance__chip {
  animation: jse-appearance-in 140ms cubic-bezier(0.23, 1, 0.32, 1) backwards;
}

/* One delay per row of five: cells in a row land together, the next row follows. Total
   entrance 140 + 24 = 164 ms, inside the 300 ms budget for UI. */
.jse-appearance__panel .jse-appearance__chip:nth-child(n + 6) {
  animation-delay: 24ms;
}
```

## Repo conventions to follow

The row of families already staggers with a fixed per-item delay computed in TS
(`delayFor(index)` in `src/appearance.tsx`, ~18 ms) and the shape strip uses the same
`jse-shape-in` animation (`src/styles.css:888`). This plan only replaces the per-cell linear sweep
inside the panel; leave the families' row stagger and the strip alone.

## Steps

1. Replace lines 1153-1167 with the two target rules (single `animation-delay: 24ms`).
2. Change the animation's curve from the plain `ease-out` to the explicit strong curve, as in the
   target.
3. Leave the existing `@media (prefers-reduced-motion: reduce)` block at 1169-1174 intact — it
   already switches these animations off.

## Boundaries

- Do NOT touch `.jse-appearance__category.is-entering` (1148-1150) or `jse-shape-in`.
- Do NOT change the 140 ms duration of the chip animation.
- Do NOT add delays for a third row beyond 24 ms — the panel's tallest family is two rows.
- If the chip rules have moved, match on the selector, and if there are more than 11 chips in any
  family, STOP and report (the row maths changes).

## Verification

- **Mechanical**: `npm run build`; `grep -c "animation-delay: 1" dist/styles.css` → `0` (no more
  108/126/144/162/180 ms delays).
- **Feel check**: open the appearance popover on a rectangle and switch to Fill (11 cells).
  - The five cells of the top row must appear as one band, then the bottom row follows — the eye
    should read rows, not a diagonal.
  - Re-open the same family twice: the whole panel must be settled before the popover finishes
    growing (200 ms).
  - DevTools → Animations, playback 10%: two distinct groups of five, 24 ms apart, none later than
    164 ms.
  - Toggle `prefers-reduced-motion`: no stagger at all, chips appear instantly.
- **Done when**: an 11-cell family finishes entering within 200 ms and the stagger is visible as
  rows, not as a per-cell sweep.
