# 003 — Press feedback at 140 ms with a real curve

- **Status**: TODO
- **Commit**: a6e9950
- **Severity**: MEDIUM
- **Category**: Easing & duration
- **Estimated scope**: 1 file (`src/styles.css`), 2 rules

## Problem

Every button in the column uses the same press transition: `transform 0.08s ease-in-out` with
`scale(0.92)`. 80 ms is below the 100–160 ms band for press feedback, so the depression reads as
a flicker rather than a press; `ease-in-out` starts slow, which delays the response to the
finger; and `0.92` is deeper than the 0.95–0.98 band, so the button visibly shrinks away from the
column instead of being pressed into it.

This is the most-tapped element in the plugin (a tool change is 100+ times a day), so the
feedback has to be instant and cheap, not subtle-but-slow.

```css
/* src/styles.css:340-346 — current */
  transition: transform 0.08s ease-in-out, background-color 0.12s ease-in-out,
    color 0.12s ease-in-out;
}

.jse-root .jse-tool.clickable-icon:active {
  transform: scale(0.92);
}
```

## Target

```css
/* target — src/styles.css */
  transition:
    transform 140ms cubic-bezier(0.23, 1, 0.32, 1),
    background-color 140ms ease,
    color 140ms ease;
}

.jse-root .jse-tool.clickable-icon:active {
  /* Pressed into the column: shallow enough to stay inside the 44 px touch target. */
  transform: scale(0.96);
}
```

Both values are fixed: 140 ms sits inside the 100–160 ms press band, the strong ease-out makes
the depression land on the first frame after touch-down, and 0.96 is inside 0.95–0.98.

## Repo conventions to follow

Duration and curve for a state change already exist in this file — the disc's opacity uses
`140ms ease` (`src/styles.css:411`), and the strong ease-out curve is introduced by plan 006 as
`--jse-ease-out`. Follow the same shape: transform on the strong curve, colour on the plain one.

## Steps

1. Replace the `transition` at 340-341 with the target block. Keep the two colour lines exactly
   as they are in structure, only change their duration.
2. Change `scale(0.92)` to `scale(0.96)` at line 345.
3. If plan 006 landed first, use `var(--jse-ease-out)` instead of the literal curve.
4. Check the sibling rules that also press: `grep -n "scale(0.9" src/styles.css`. Any other tool
   button that presses deeper than 0.95 gets the same 0.96 and the same transition — but only if
   it is a *press* (an `:active` rule), never a hover or an entrance.

## Boundaries

- Do NOT change `background-color` / `color` values, only their timing.
- Do NOT add `:active` rules to elements that have none — this plan fixes the ones that exist.
- Do NOT touch the active-tool icon swell (`304`) — that is plan 004.
- Do NOT add a `will-change: transform` here: press feedback is one frame of state, and the hint
  would keep 15 buttons on their own layers for nothing.
- If the rule at 340 no longer reads as quoted, STOP and report.

## Verification

- **Mechanical**: `npm run build`; `grep -n "0.08s\|scale(0.92)" dist/styles.css` → no matches.
- **Feel check**: on the phone, tap every tool in the column, then hold one down and slide off it.
  - The button must depress immediately on touch-down (not after a beat) and return with a
    settle, not a snap.
  - The depression must stay inside the button's own bounds: no visible gap opening between the
    button and the column edge.
  - DevTools → Animations, playback 10%: the scale must reach 0.96 within the first third of the
    140 ms and ease back.
  - Compare against a native Obsidian toolbar button press: the native one is the reference for
    depth and speed, and this should now be indistinguishable.
- **Done when**: tapping a tool shows a press that is visible in a single frame at 10% playback,
  and no button changes size by more than 4 %.
