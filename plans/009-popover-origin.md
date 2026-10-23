# 009 — Give the popover an origin at its trigger

- **Status**: TODO (additive — an opportunity, not a defect)
- **Commit**: a6e9950
- **Severity**: LOW
- **Category**: Missed opportunity
- **Estimated scope**: 1 file (`src/styles.css`), 2 rules

## Problem

The appearance popover grows from its button and is anchored to it (`bottom`, right edge), but it
scales and translates from its own centre. Nothing in the motion says "this came out of that
button": it fades in and slides 6 px regardless of where the button sits in the column. The shape
strip next to it has the same issue but a smaller travel, so the popover is where it reads.

```css
/* src/appearance.tsx:396 — the entrance animation is on the menu element */
{ className: `jse-tools__pill jse-shapes__menu jse-appearance-menu${...}` }
```

```css
/* src/styles.css:1129-1132 — current */
@keyframes jse-appearance-in {
  from { opacity: 0; transform: translateY(6px); }
  to { opacity: 1; transform: translateY(0); }
}
```

## Target

Origin at the trigger side — the popover is anchored bottom-right (it sits right of the column,
its `bottom` aligned with the button), so the growth must come from `right bottom`:

```css
/* target — src/styles.css */
.jse-tools .jse-appearance-menu {
  transform-origin: right bottom;
}

/* The transform-origin must not be inherited by the panel's own children. */
.jse-tools .jse-appearance-menu > * {
  transform-origin: center;
}
```

Do not add a scale: the popover's size is driven by the measured panel height and a scale would
fight it. The origin only matters once a transform exists — the existing `translateY(6px)`
entrance is enough for it to read.

## Repo conventions to follow

The plate behind the column is drawn on a pseudo-element that reaches outside the layout box
(`src/styles.css:1196-1218`), and the popover already declares its own corner after the strip's
generic rules with a comment explaining why the more specific rule wins. Put this rule in the same
block, right after `.jse-tools .jse-appearance-menu { border-radius: … }` (1233-1236), so it
follows the same "state it after the generic rule" pattern.

## Steps

1. Add the two rules to `src/styles.css`, immediately after the popover's `border-radius` rule.
2. Do not change the keyframes at 1129-1132.
3. Verify on a tablet/Fold-unfolded width that the popover still opens upward from the column and
   that the origin does not push it off-screen (the origin changes no layout, only the visual
   direction of the transform — this step is a sanity check, not a code change).

## Boundaries

- Do NOT touch `jse-shape-in` or the strip's entrance; the strip's origin is a separate decision
  and out of scope here.
- Do NOT add `transform: scale()` to the popover.
- Do NOT change the `right`/`bottom` anchoring.
- If `.jse-tools .jse-appearance-menu` no longer exists as a rule, STOP and report.

## Verification

- **Mechanical**: `npm run build`; `grep -n "transform-origin: right bottom" dist/styles.css` → 1
  match.
- **Feel check**: on the phone, tap the palette button with a rectangle selected.
  - The popover must appear to unfold from the button's corner, not to rise from nowhere.
  - With the popover open, switch families: the content must not shift sideways or scale from a
    corner (the child rule prevents that).
  - Rotate to landscape / unfold the Fold: the popover must still be fully on-screen and its
    entrance must still read as coming from the button.
  - DevTools → Animations, playback 10%: the 6 px travel and the growth must both point away from
    the bottom-right corner.
- **Done when**: the popover's first frames are visibly smaller/more offset at the trigger corner
  and the final state is pixel-identical to today.
