# 005 — Cover the moving parts with `prefers-reduced-motion`

- **Status**: TODO
- **Commit**: a6e9950
- **Severity**: MEDIUM
- **Category**: Accessibility
- **Estimated scope**: 1 file (`src/styles.css`) + ~6 lines in `main.ts`

## Problem

Six reduced-motion blocks exist and all of them switch off entrances. Four moving things are not
covered at all: the two travelling marks, the appearance panel's height, the popover's corner, and
the double-tap zoom tween in JS. On a device with "Remove animations" enabled, the plugin still
slides rings across the screen and rescales the sheet.

```css
/* src/styles.css:1011-1015 — current, the family mark */
  transition:
    left 180ms cubic-bezier(0.22, 0.61, 0.36, 1),
```

```css
/* src/styles.css:1110 — current, the panel */
  transition: height 200ms cubic-bezier(0.22, 0.61, 0.36, 1), opacity 140ms ease;
```

```css
/* src/styles.css:1235 — current, the popover corner */
  transition: border-radius 200ms cubic-bezier(0.22, 0.61, 0.36, 1);
```

```ts
/* main.ts:264-287 — current, the zoom tween */
        const startZoom = zoom;
        const started = performance.now();
        const step = (): void => {
          const progress = Math.min(1, (performance.now() - started) / 240);
          const eased = 1 - Math.pow(1 - progress, 3);
```

## Target

Reduced motion means *fewer and gentler*, not zero: colour and opacity feedback stays, movement
and size changes are dropped. The marks must still land on the right cell — instantly.

```css
/* target — src/styles.css, added next to the existing reduced-motion blocks */
@media (prefers-reduced-motion: reduce) {
  /* The marks still move to the chosen cell, they just do not travel there. */
  .jse-appearance__family-marker,
  .jse-appearance__marker {
    transition: opacity 140ms ease;
  }

  /* The panel still opens and closes, without growing on the way. */
  .jse-appearance__panel {
    transition: opacity 140ms ease;
  }

  .jse-tools .jse-appearance-menu,
  .jse-tools .jse-appearance-menu::before {
    transition: none;
  }
}
```

```ts
// target — main.ts, inside the double-tap handler, before the tween is started
        const reduceMotion = typeof window.matchMedia === "function"
          && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        if (reduceMotion) {
          // Jump straight to the target: the anchor maths below is what makes it land on the
          // touched point, and it does not depend on the interpolation.
          api?.updateScene({
            appState: {
              zoom: { value: target as never },
              scrollX: (clientX - rect.left) / target - scene.x,
              scrollY: (clientY - rect.top) / target - scene.y
            }
          });
          return true;
        }
```

Insert that just after `clientX`/`clientY` are computed and before `const startZoom = zoom;`, so
the early return still gives the caller its `true` and never starts a tween.

## Repo conventions to follow

The existing blocks do exactly this — drop movement, keep the state. `src/styles.css:316-323`:

```css
@media (prefers-reduced-motion: reduce) {
  .jse-tools__pill.jse-anim,
  .jse-root .jse-tool .jse-icon,
  .jse-shapes__menu.jse-anim,
  .jse-root .jse-tools__pill > .jse-tool--collapsible.jse-anim {
    animation: none;
    transition: none;
  }
}
```

Place the new block next to the appearance-related blocks (after `1235`'s rule is a reasonable
spot) rather than at the end of the file, so the reader finds it with the rules it governs.

## Steps

1. Add the CSS block above to `src/styles.css`.
2. In `main.ts`, inside the double-tap handler (`onDoubleTap`), read the media query and return
   `true` after applying the target zoom directly, before the tween starts.
3. Make sure the early return cancels any tween in flight: put
   `if (zoomFrameRef.current !== null) { window.clearTimeout(zoomFrameRef.current); zoomFrameRef.current = null; }`
   immediately before applying the target, so a reduced-motion tap during an earlier tween does
   not get overwritten by the old timer.
4. If plan 001 landed first, the mark rules now transition `transform` — the reduced-motion rule
   above still wins, because it overrides the whole `transition` shorthand.

## Boundaries

- Do NOT set `transition: none` on the marks: with no transition the ring teleports to the new
  cell and is fine, but with `opacity 140ms` it fades in place, which is the gentler behaviour this
  plan asks for. Do not "simplify" it to `none`.
- Do NOT touch the zoom's 240 ms or its easing for the normal case.
- Do NOT gate the zoom behind a plugin setting; the system preference is the switch.
- Do NOT remove the existing six reduced-motion blocks.
- If `onDoubleTap` no longer matches the excerpt, STOP and report.

## Verification

- **Mechanical**: `npx tsc --noEmit` then `npm run check`, then `npm run build`;
  `grep -c "prefers-reduced-motion" dist/styles.css` → `7`.
- **Feel check**: on the phone, enable *Remove animations* (Android: Settings → Accessibility →
  Remove animations), then reopen Obsidian:
  - Open the appearance popover and pick another value: the ring must appear on the new cell
    without travelling across the panel.
  - Switch family: the panel must appear at its new size without growing.
  - Double-tap the canvas: the zoom must land on the touched point in one step, with no visible
    intermediate scale.
  - Turn the setting back off and confirm everything animates as before.
  - DevTools equivalent: Rendering → Emulate `prefers-reduced-motion: reduce`.
- **Done when**: with reduced motion on, no element changes position or size over time, while the
  popover, the strip and the panel still appear and disappear (no invisible UI).
