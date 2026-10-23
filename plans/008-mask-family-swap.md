# 008 — Mask the family swap instead of double-exposing it

- **Status**: TODO (additive — an opportunity, not a defect)
- **Commit**: a6e9950
- **Severity**: LOW
- **Category**: Missed opportunity
- **Estimated scope**: 1 file (`src/styles.css`), 1 rule

## Problem

Switching family re-renders the same panel with different chips. The panel's height is animated
(200 ms) but the *content* is replaced in one frame, so for the duration of the height transition
the outgoing values and the incoming ones are legible in the same box — a double exposure. When
going from a 2-row family to a 1-row one, the outgoing row is visible under the new row while the
box shrinks over it.

```css
/* src/styles.css:1104-1110 — current */
.jse-appearance__panel {
  position: relative;
  /* Height comes from the measurement, in the style attribute: it is the only way to
     animate from one family's height to another's. */
  height: 0;
  overflow: hidden;
  transition: height 200ms cubic-bezier(0.22, 0.61, 0.36, 1), opacity 140ms ease;
```

## Target

A short, low blur while the height is changing, gone by the time the panel settles — the standard
mask for a crossfade that shows two states at once. Blur must stay under 20 px (it is expensive)
and must be zero at rest:

```css
/* target */
.jse-appearance__panel {
  transition:
    height 200ms cubic-bezier(0.77, 0, 0.175, 1),
    opacity 140ms ease,
    filter 140ms ease;
}

/* Applied by the component for one transition only; see step 2. */
.jse-appearance__panel.is-swapping {
  filter: blur(2px);
}
```

## Repo conventions to follow

The component already keeps a signature ref to know when its content changed —
`heightSignatureRef` in `src/appearance.tsx` — and the panel writes its height inline from a
measured value. Reuse that measurement point to toggle the class, and clear it on a timer that
matches the 140 ms filter transition.

## Steps

1. Add the `filter` line to the panel's transition and the `.is-swapping` rule to `src/styles.css`.
2. In `src/appearance.tsx`, where the panel height is measured (`useEffect` that sets
   `panelHeight`), when the new height differs from the previous one **and** the panel was already
   open, add `is-swapping` to the panel element and remove it after 140 ms:
   ```ts
   panelRef.current?.classList.add("is-swapping");
   window.setTimeout(() => panelRef.current?.classList.remove("is-swapping"), 140);
   ```
   Nothing else in the component changes; do not re-render for this.
3. Guard against the timer firing on an unmounted panel — the `?.` above is enough, do not store a
   ref for it.

## Boundaries

- Do NOT blur during the first opening (the component's `open` transition): only when a family is
  already open and the height changes. A blur on open fights the stagger.
- Do NOT go above 2 px: on Android WebView a backdrop-adjacent blur is expensive.
- Do NOT change the height duration or curve beyond the one line in the target.
- Do NOT animate `filter` on the popover itself, only on the panel content.
- If the measurement effect no longer exists in `appearance.tsx`, STOP and report.

## Verification

- **Mechanical**: `npx tsc --noEmit`, `npm run check`, `npm run build`.
- **Feel check**: open the popover on a rectangle, then switch rapidly: Fill → Stroke → Fill →
  Corners.
  - No frame should show two rows of values readable at once.
  - The blur must be gone as soon as the box stops moving (no lingering softness).
  - DevTools → Animations, playback 10%: the blur peaks around the midpoint of the height change
    and returns to 0 before it ends.
  - Render → Paint flashing: the blur must not run continuously at rest.
- **Done when**: a slow-motion capture of two family switches never shows the old and new values
  crisp at the same time.
