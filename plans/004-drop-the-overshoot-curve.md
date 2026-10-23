# 004 — Drop the overshoot curve from the chrome

- **Status**: TODO
- **Commit**: a6e9950
- **Severity**: MEDIUM
- **Category**: Cohesion & tokens
- **Estimated scope**: 1 file (`src/styles.css`), 2 rules

## Problem

Two rules use `cubic-bezier(0.34, 1.56, 0.64, 1)` — a curve that overshoots — while everything
else in the plugin uses the crisp `cubic-bezier(0.22, 0.61, 0.36, 1)`. The product imitates
Obsidian's mobile chrome, which is precise and quiet; a bounce on the bar and on the active tool
icon reads as a different, more playful product. Worse, the icon swell is on the most-tapped
element in the plugin: the bounce is seen 100+ times a day, which is exactly where motion should
be minimal.

```css
/* src/styles.css:287-288 — current */
.jse-tools__pill.jse-anim {
  animation: jse-bar-in 220ms cubic-bezier(0.34, 1.56, 0.64, 1) backwards;
}
```

```css
/* src/styles.css:302-305 — current */
/* The active tool's icon swells while it is active and settles back after. */
.jse-root .jse-tool .jse-icon {
  transition: transform 180ms cubic-bezier(0.34, 1.56, 0.64, 1);
}
```

## Target

No overshoot anywhere. The bar entrance keeps its `scale(0.96)` start (that is correct: nothing
appears from `scale(0)`), and the icon swell keeps its 1.12 end value, but both travel on the
strong ease-out curve so they decelerate into place instead of bouncing past it.

```css
/* target */
.jse-tools__pill.jse-anim {
  animation: jse-bar-in 220ms var(--jse-ease-out, cubic-bezier(0.23, 1, 0.32, 1)) backwards;
}

.jse-root .jse-tool .jse-icon {
  transition: transform 180ms var(--jse-ease-out, cubic-bezier(0.23, 1, 0.32, 1));
}
```

## Repo conventions to follow

`jse-shape-in` and the strip's transitions already use a decelerating curve and nothing else
(`src/styles.css:888`, `1149`) — an entrance that arrives and stops. Imitate those; the bar and
the icon are the only two places where the plugin breaks its own rule today.

## Steps

1. Change the curve on line 288 to the target (keep `220ms` and `backwards`).
2. Change the curve on line 304 to the target (keep `180ms`).
3. If plan 006 landed first, use `var(--jse-ease-out)` with the literal as fallback, exactly as
   written in the target block.
4. Confirm no other overshoot exists: `grep -n "1.56" src/styles.css` must return nothing.

## Boundaries

- Do NOT change the durations (220 ms, 180 ms) or the scale values.
- Do NOT touch `jse-tool-in` / `jse-tool-out` / `jse-menu-in` / `jse-menu-out` — plan 002 replaces
  them wholesale; if that plan has already landed they no longer exist.
- Do NOT remove the icon swell itself; only its curve changes.
- Do NOT add a bounce elsewhere "to balance it out".

## Verification

- **Mechanical**: `npm run build`; `grep -c "1.56" dist/styles.css` → `0`.
- **Feel check**: reload the plugin view on the phone.
  - The column must arrive and settle — no visible overshoot of its edges past the final
    position.
  - Tap through tools quickly: the icon must grow and stop, not wobble.
  - DevTools → Animations, playback 10%: the icon swell must approach 1.12 monotonically, never
    crossing it.
  - Put the phone next to native Obsidian's own toolbar: the arrival should look like the same
    family.
- **Done when**: neither animation crosses its final value at any point (verify in the Animations
  panel's curve inspector), and no `1.56` remains in the stylesheet.
