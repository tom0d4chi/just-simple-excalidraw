# 001 — Move the two travelling marks with `transform`, not `left`/`top`

- **Status**: TODO
- **Commit**: a6e9950
- **Severity**: HIGH
- **Category**: Performance
- **Estimated scope**: 2 files (`src/styles.css`, `src/appearance.tsx`), ~20 lines

## Problem

Both selection marks — the disc in the row of families and the ring in the panel — are positioned
with `left`/`top` and sized with `width`/`height`, and those four properties are what the
transition animates. Each of them is a layout property: every frame of the 180 ms travel forces
style recalc, layout, paint and composite, on top of a live Excalidraw canvas, inside an Android
WebView. On a phone this is the animation most likely to drop frames, and it runs on the two
controls the user touches most often in the popover.

```css
/* src/styles.css:1004-1016 — current */
.jse-appearance__family-marker {
  position: absolute;
  z-index: 0;
  border-radius: 50%;
  background-color: color-mix(in srgb, var(--jse-accent, var(--color-accent)) 14%, transparent);
  box-shadow: inset 0 0 0 1.5px var(--jse-accent, var(--color-accent));
  pointer-events: none;
  transition:
    left 180ms cubic-bezier(0.22, 0.61, 0.36, 1),
    top 180ms cubic-bezier(0.22, 0.61, 0.36, 1),
    width 180ms cubic-bezier(0.22, 0.61, 0.36, 1),
    height 180ms cubic-bezier(0.22, 0.61, 0.36, 1);
}
```

```css
/* src/styles.css:1090-1102 — current */
.jse-appearance__marker {
  position: absolute;
  z-index: 0;
  pointer-events: none;
  background-color: color-mix(in srgb, var(--jse-accent, var(--color-accent)) 14%, transparent);
  box-shadow: inset 0 0 0 1.5px var(--jse-accent, var(--color-accent));
  transition:
    left 180ms cubic-bezier(0.22, 0.61, 0.36, 1),
    top 180ms cubic-bezier(0.22, 0.61, 0.36, 1),
    width 180ms cubic-bezier(0.22, 0.61, 0.36, 1),
    height 180ms cubic-bezier(0.22, 0.61, 0.36, 1),
    border-radius 140ms ease;
}
```

```tsx
/* src/appearance.tsx:407-417 — current */
        ? createElement("div", {
            // One marker per family: switching family starts a fresh one where the value is,
            // instead of dragging the previous family's circle across and morphing it.
            key: `marker-${shownCategory}`,
            className: "jse-appearance__marker",
            style: {
              left: `${marker.left}px`,
              top: `${marker.top}px`,
              width: "36px",
              height: "36px",
              borderRadius: marker.round ? "50%" : "var(--radius-s, 8px)"
            }
          })
```

```tsx
/* src/appearance.tsx:421-430 — current */
      familyMarker
        ? createElement("div", {
            className: "jse-appearance__family-marker",
            style: {
              left: `${familyMarker.left}px`,
              top: `${familyMarker.top}px`,
              width: `${familyMarker.size}px`,
              height: `${familyMarker.size}px`
            }
          })
```

## Target

Fixed 36 px box, positioned only by `transform`, and only `transform` + `border-radius`
transitioned. The marks keep their exact current positions: the panel cells are a 5-column grid
of 36 px with a 4 px gap and 2 px of padding (so pitch is 40 px), and family icons in the row are
36 px squares spaced `var(--size-4-1, 4px)` apart.

```css
/* target — src/styles.css */
.jse-appearance__family-marker {
  position: absolute;
  left: 0;
  top: 0;
  width: 36px;
  height: 36px;
  z-index: 0;
  border-radius: 50%;
  background-color: color-mix(in srgb, var(--jse-accent, var(--color-accent)) 14%, transparent);
  box-shadow: inset 0 0 0 1.5px var(--jse-accent, var(--color-accent));
  pointer-events: none;
  /* Only the compositor runs during the travel: no layout, no paint of the canvas behind. */
  transition: transform 180ms cubic-bezier(0.77, 0, 0.175, 1), opacity 140ms ease;
  will-change: transform;
}

.jse-appearance__marker {
  position: absolute;
  left: 0;
  top: 0;
  width: 36px;
  height: 36px;
  z-index: 0;
  pointer-events: none;
  background-color: color-mix(in srgb, var(--jse-accent, var(--color-accent)) 14%, transparent);
  box-shadow: inset 0 0 0 1.5px var(--jse-accent, var(--color-accent));
  transition:
    transform 180ms cubic-bezier(0.77, 0, 0.175, 1),
    border-radius 140ms ease;
  will-change: transform;
}
```

```tsx
/* target — src/appearance.tsx */
            style: {
              transform: `translate(${marker.left}px, ${marker.top}px)`,
              borderRadius: marker.round ? "50%" : "var(--radius-s, 8px)"
            }
```

```tsx
/* target — src/appearance.tsx */
            style: {
              transform: `translate(${familyMarker.left}px, ${familyMarker.top}px)`
            }
```

The family icons are always 36 px, so `familyMarker.size` is no longer needed for the box. Leave
the state shape alone; simply stop reading `size` here (the CSS box is 36 px). Do not delete the
`size` field from the measurement, other code may read it later.

## Repo conventions to follow

The tool disc already travels this way and is the exemplar to imitate — `src/styles.css:406-412`:

```css
.jse-tools__pill.has-glide .jse-tools__glide {
  transition:
    transform 260ms cubic-bezier(0.32, 0.72, 0, 1),
    opacity 140ms ease;
}
```

Note it sets no `left`/`top` at all: the disc is placed once and moved with `transform`.

## Steps

1. In `src/styles.css`, replace the bodies of `.jse-appearance__family-marker` (1004-1016) and
   `.jse-appearance__marker` (1090-1102) with the target CSS above. Keep the existing comments
   above each rule; they explain the intent and stay true.
2. In `src/appearance.tsx`, change the marker's `style` (407-417) to pass `transform` instead of
   `left`, `top`, `width`, `height`. Keep `key: \`marker-${shownCategory}\`` untouched — the fresh
   mark per family is deliberate and must survive.
3. In `src/appearance.tsx`, change the family marker's `style` (421-430) to pass only the
   `transform`.
4. If plan 006 landed first, prefer `var(--jse-ease-in-out)` over the literal curve in both rules.
   If not, use the literal `cubic-bezier(0.77, 0, 0.175, 1)`.

## Boundaries

- Do NOT change the measurement code in `appearance.tsx` (`familySignatureRef`, `activeIndex`,
  `markerInset`): the 2 px inset for the thickness family is required and already correct.
- Do NOT touch the tool disc (`.jse-tools__glide`) — it is already right.
- Do NOT add `animation`, and do NOT change the 180 ms duration.
- Do NOT remove `will-change` "because it's noise" — it is what keeps the mark on its own layer
  while the canvas repaints underneath.
- If line numbers have drifted, match on the rule bodies; if a body differs from the excerpts,
  STOP and report.

## Verification

- **Mechanical**: `npx tsc --noEmit` then `npm run check` (all harness checks must pass, the
  appearance panel is exercised by `scripts/test-file-isolation.mjs`), then `npm run build`.
  In the built stylesheet, `grep -c "left 180ms" dist/styles.css` → `0`.
- **Feel check**: open the appearance popover on the phone with a big drawing behind it.
  - Tap a family, then a value: the ring must still glide cell to cell, in the same 180 ms, with
    no visible jump at the start or the end.
  - In the row of families, hop between all five: the disc must stay glued to the icons and its
    travel must not lag behind a finger that taps quickly.
  - Chrome DevTools → Performance, record one travel on a throttled 4× CPU: no "Layout" or
    "Paint" entries during the 180 ms, only "Composite Layers" / transform updates.
  - Toggle `prefers-reduced-motion` (Rendering panel): the mark still lands on the right cell
    (instant is fine at this stage; plan 005 formalises it).
- **Done when**: the two marks animate with zero layout/paint in a Performance trace, and their
  resting positions are pixel-identical to before (compare screenshots of the popover open on
  stroke and on fill).
