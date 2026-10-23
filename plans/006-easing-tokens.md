# 006 — Put the curves in tokens before touching anything else

- **Status**: TODO
- **Commit**: a6e9950
- **Severity**: LOW
- **Category**: Cohesion & tokens
- **Estimated scope**: 1 file (`src/styles.css`), mechanical replacement of ~14 durations/curves

## Problem

Every curve and duration is typed per rule, so drift is already visible: the same curve
`cubic-bezier(0.22, 0.61, 0.36, 1)` appears 9 times, with durations of 140, 150, 180, 200 and
260 ms on it — without any reason for the difference. A second curve
`cubic-bezier(0.32, 0.72, 0, 1)` is used once (the tool disc), a third
`cubic-bezier(0.34, 1.56, 0.64, 1)` twice (bar entrance, icon swell).

```css
/* src/styles.css:1011-1015 — current */
  transition:
    left 180ms cubic-bezier(0.22, 0.61, 0.36, 1),
    top 180ms cubic-bezier(0.22, 0.61, 0.36, 1),
```

```css
/* src/styles.css:409-412 — current */
  transition:
    transform 260ms cubic-bezier(0.32, 0.72, 0, 1),
    opacity 140ms ease;
```

## Target

Three curve tokens and a three-step duration scale at the top of `src/styles.css`, and every
existing motion rule pointing at them. Values are fixed — do not adjust them:

```css
/* src/styles.css — add after the existing .jse-root block, before the first motion rule */
.jse-root {
  /* Emil Kowalski's UI curves: strong ease-out for anything entering or leaving, strong
     ease-in-out for things moving while already visible, the iOS drawer curve for travel. */
  --jse-ease-out: cubic-bezier(0.23, 1, 0.32, 1);
  --jse-ease-in-out: cubic-bezier(0.77, 0, 0.175, 1);
  --jse-ease-glide: cubic-bezier(0.32, 0.72, 0, 1);
  --jse-dur-fast: 140ms;
  --jse-dur-base: 180ms;
  --jse-dur-slow: 240ms;
}
```

Mapping (apply exactly, leave the durations that are already in the fast/base/slow band alone):

| Old | New |
| --- | --- |
| `cubic-bezier(0.22, 0.61, 0.36, 1)` on an entrance or exit (150, 140, 200, 180 ms) | `var(--jse-ease-out)` |
| `cubic-bezier(0.22, 0.61, 0.36, 1)` on in-place travel (`1011-1015`, `1096-1100`, `1110`, `1235`) | `var(--jse-ease-in-out)` for the marks and the panel height; `var(--jse-ease-out)` for the popover corner |
| `cubic-bezier(0.32, 0.72, 0, 1)` (`409`) | `var(--jse-ease-glide)` |
| `cubic-bezier(0.34, 1.56, 0.64, 1)` (`288`, `304`) | leave for now — plan 004 removes it |

## Repo conventions to follow

The stylesheet already declares its own custom properties on `.jse-root` and consumes them with
fallbacks, e.g. `src/styles.css:1008`:

```css
background-color: color-mix(in srgb, var(--jse-accent, var(--color-accent)) 14%, transparent);
```

Follow that: declare the tokens on `.jse-root`, and do not invent a separate tokens file — this
plugin ships one stylesheet.

## Steps

1. Add the token block above to `src/styles.css`, in the `.jse-root` section near the top.
2. Replace every literal `cubic-bezier(0.22, 0.61, 0.36, 1)` with the mapped token from the table.
3. Replace `cubic-bezier(0.32, 0.72, 0, 1)` at line 409 with `var(--jse-ease-glide)`.
4. Do not change any duration in this plan. A curve swap alone must not alter timing — that is
   what makes this plan reviewable on its own.

## Boundaries

- Do NOT touch `src/*.tsx` or `main.ts`.
- Do NOT remove the overshoot curve (`0.34, 1.56, 0.64, 1`) — plan 004 does that.
- Do NOT add new keyframes, and do NOT change any duration.
- If a `cubic-bezier(0.22, 0.61, 0.36, 1)` occurrence has no obvious mapping in the table, STOP
  and report it rather than guessing.

## Verification

- **Mechanical**: `npx tsc --noEmit` (unchanged, this is CSS) then `npm run build`; the built
  `dist/styles.css` must contain `--jse-ease-out` and no literal `0.22, 0.61, 0.36, 1` outside
  the token block:
  `grep -c "0.22, 0.61, 0.36, 1" dist/styles.css` → `1`.
- **Feel check**: open a drawing on the phone, tap a tool, open the shapes strip, open the
  appearance popover. Nothing should feel faster or slower than before, only slightly crisper at
  the start of each movement (the strong ease-out starts harder).
  - DevTools → Animations panel, playback 10%: the strip's entry should cover most of its
    distance in the first third of its 140 ms.
  - Compare against the previous commit side by side if unsure; a curve swap must not change
    *when* things finish, only *how* they get there.
- **Done when**: no literal repeat of the old curve remains, and no duration changed in the diff
  (`git diff --stat` shows only `src/styles.css`, and `git diff -U0 | grep "^[-+].*ms"` is empty).
