# 010 — Say "armed" when multi-select is armed

- **Status**: TODO (additive — an opportunity, not a defect)
- **Commit**: a6e9950
- **Severity**: LOW
- **Category**: Missed opportunity
- **Estimated scope**: 1 file (`src/styles.css`) + 3 lines in `src/toolbar.tsx`

## Problem

Arming multi-select changes one icon to its active style and nothing else. It is the only state in
the plugin whose consequences are invisible until it is too late: the next one-finger drag on empty
paper draws a selection box instead of panning. A user who armed it by accident finds out by
dragging the canvas and getting a marquee. The state deserves a one-shot motion cue, and this is a
state change that happens rarely enough (a few times a session) to afford one.

```tsx
/* src/toolbar.tsx:66 and :634 — current */
  selectionArmed: boolean;
          toolButton(TOOL_DEFINITIONS.selection, () => () => onToggleSelection(), selectionArmed),
```

```tsx
/* src/toolbar.tsx:186 and :624-626 — the pill already has a ref, current */
  const pillRef = useRef<HTMLDivElement | null>(null);
    className: `jse-tools__pill${dark ? " jse-pill--dark" : ""}${entered ? " jse-anim" : ""}${glideReady ? " has-glide" : ""}`,
    ref: pillRef
```

## Target

A single 160 ms pulse on the column's outline when `armed` turns true — no looping animation, no
change to layout, nothing that stays afterwards:

```css
/* target — src/styles.css */
@keyframes jse-armed-pulse {
  0%   { box-shadow: 0 0 0 0 color-mix(in srgb, var(--jse-accent, var(--color-accent)) 45%, transparent); }
  100% { box-shadow: 0 0 0 8px transparent; }
}

.jse-tools__pill.is-armed-pulse {
  animation: jse-armed-pulse 160ms ease-out;
}

@media (prefers-reduced-motion: reduce) {
  .jse-tools__pill.is-armed-pulse {
    animation: none;
  }
}
```

```tsx
/* target — src/toolbar.tsx, next to the effect that starts at :193 */
// A one-shot ring when multi-select arms: the only state whose effect is invisible until the
// first drag. Removed immediately so it can pulse again next time.
useEffect(() => {
  if (!selectionArmed) {
    return;
  }
  const pill = pillRef.current;
  if (!pill) {
    return;
  }
  pill.classList.add("is-armed-pulse");
  const timer = window.setTimeout(() => pill.classList.remove("is-armed-pulse"), 200);
  return () => window.clearTimeout(timer);
}, [selectionArmed]);
```

## Repo conventions to follow

The plugin toggles one-shot classes from effects elsewhere — the shape strip's `jse-anim` and the
appearance rows' `is-entering` are both transient classes added by the component and removed by
CSS or a timer. Follow that: a class, not an inline animation style. The pulse uses the same
accent token as the marks (`--jse-accent`, falling back to `--color-accent`).

## Steps

1. Add the keyframes, the class rule and the reduced-motion block to `src/styles.css`, next to the
   other pill rules (after the plate block, ~1218).
2. In `src/toolbar.tsx`, use the existing `pillRef` (declared at :186, attached to the pill at
   :625) — do not create a second ref to the same node.
3. Add the effect above inside the `Toolbar` component, after the existing effect at :193, keyed
   on the `selectionArmed` prop (`:66`, destructured at `:160`).
4. Do not fire the pulse when the editor mounts with multi-select already armed: the effect runs
   once on mount. `selectionArmed` starts `false` and is not persisted (`main.ts:162`), so the
   case is unreachable today — state that assumption in a comment rather than adding a guard.

## Boundaries

- Do NOT animate anything that stays: no persistent glow, no loop.
- Do NOT touch the marquee itself or its colour.
- Do NOT change when multi-select arms (that logic lives in `main.ts` and is deliberate).
- Do NOT add a pulse for disarming: silence on the way out is correct.
- Do NOT rename `selectionArmed` to `armed`, and do not thread a new prop through the tree.

## Verification

- **Mechanical**: `npx tsc --noEmit`, `npm run check`, `npm run build`.
- **Feel check**: on the phone, with a drawing open:
  - Tap multi-select: a single ring must expand outward from the column and vanish within ~200 ms.
  - Tap it off and on again quickly: the pulse must replay from the start each time, never stack.
  - Drag the canvas while armed: the marquee must still behave exactly as before (no change in the
    gesture path).
  - Rendering → `prefers-reduced-motion: reduce`: no pulse, but the icon still shows the armed
    state.
  - DevTools → Animations: exactly one 160 ms animation per arming, and no `box-shadow` left on
    the pill at rest (inspect the element after the pulse).
- **Done when**: arming shows a single, self-erasing cue and leaves no trace in the computed style.
