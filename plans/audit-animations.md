# Animation audit — Canvas Drawings (just-simple-excalidraw)

Commit: `main` @ 0.1.93 · Effort: standard · Read-only: nothing below is applied.
Method: `improve-animations` (Emil Kowalski's rule catalog).

## Recon

- **Stack**: Obsidian plugin, React 19 (created via `createElement`), TypeScript, one stylesheet
  (`src/styles.css`, ~1250 lines). No motion library: plain CSS transitions + `@keyframes`, plus
  one imperative JS loop for the double-tap zoom.
- **Where motion lives**: `src/styles.css`; the zoom tween in `main.ts` (~line 255-288).
- **Conventions**: durations hand-typed per rule; the curve `cubic-bezier(0.22, 0.61, 0.36, 1)`
  is repeated 9 times, `cubic-bezier(0.32, 0.72, 0, 1)` once (tool disc), and
  `cubic-bezier(0.34, 1.56, 0.64, 1)` (overshoot) once for the bar and once for the icon swell.
  No `--ease-*` / `--duration-*` tokens.
- **Personality**: crisp tool chrome imitating Obsidian mobile. Should read as precise, not playful.
- **Frequency map**: tool taps and tool switches — 100+/day (highest). Shape strip open/close and
  the appearance popover — tens of times/day. Undo/redo, lock, delete — tens. Double-tap zoom —
  occasional. Nothing in this plugin is rare enough to buy delight.

## Findings

| # | Severity | Category | Location | Finding | Fix summary |
|---|---|---|---|---|---|
| 1 | HIGH | Performance | `styles.css:1005-1016` and `styles.css:1088-1104` | Both travelling marks animate `left`, `top`, `width`, `height`. Those are layout properties: every frame forces layout + paint + composite, on top of a live Excalidraw canvas, on an Android WebView. | Fixed 36 px box, positioned by `transform: translate(x, y)`; transition `transform` only (and `border-radius` where the mark morphs). |
| 2 | HIGH | Interruptibility | `styles.css:479-483`, `596-600`, `852-856` | Open and close are `@keyframes` with `forwards`. Keyframes restart from zero instead of retargeting, so closing the strip and reopening it inside 120 ms replays the entry from `opacity: 0` — a visible flash. The exit also uses `ease-in` (`483`), which delays the only moment the user is watching. | Enter/exit as transitions on `transform` + `opacity` (retarget mid-flight), exit `120ms` with the strong ease-out curve. |
| 3 | MEDIUM | Easing & physicality | `styles.css:340-347` | Press feedback is `transform 0.08s ease-in-out` with `scale(0.92)`. 80 ms with a built-in curve reads as a flicker; the depressor is deeper than the 0.95–0.98 band used for press states. | `transform 140ms cubic-bezier(0.23, 1, 0.32, 1)` and `scale(0.96)` on `:active`. |
| 4 | MEDIUM | Cohesion | `styles.css:288`, `304` | The bar entrance and the active-icon swell use an overshoot curve (`0.34, 1.56, 0.64, 1`) while everything else in the plugin is crisp (`0.22, 0.61, 0.36, 1`). Bounce on tool chrome contradicts the product's personality — and the swell is on the most-hit element in the plugin. | Replace the overshoot with the strong ease-out curve; keep no bounce. |
| 5 | MEDIUM | Accessibility | `styles.css:1010`, `1096`, `1110`, `1235`; `main.ts:255-288` | Movement with no `prefers-reduced-motion` branch: marker travel (two places), panel height, popover corner, and the JS zoom tween. The existing four reduced-motion blocks cover entrances only. | Under reduced motion keep opacity/colour, drop position and height changes; have the zoom jump to its target instead of tweening. |
| 6 | LOW | Cohesion & tokens | `styles.css` (9 occurrences of `0.22, 0.61, 0.36, 1`) | Curves are typed per rule. Three near-identical families exist and drift is already visible (140 vs 150 vs 180 vs 200 ms on the same curve). | Introduce `--jse-ease-out`, `--jse-ease-in-out`, `--jse-ease-glide` and a 3-step duration scale; point existing rules at them. |
| 7 | LOW | Stagger | `styles.css:1145-1160` | The value chips stagger by DOM order, +18 ms each, up to 180 ms on the 11th cell: the second row starts moving 90 ms after the first, and the last cell lands at ~320 ms — past the 300 ms budget for UI. Cells in the same row should share a delay. | Delay by row (`nth-child(n+6)` = +24 ms) instead of per cell, cap at 2 rows. |

### Accepted tradeoffs (not findings)

- The zoom tween uses `setTimeout` rather than `requestAnimationFrame`, with the reasoning written
  at `main.ts:260-263` (a hidden or throttled view would leave a rAF tween stuck halfway). Documented
  deliberately — left alone; only the missing reduced-motion branch is reported (#5).
- The appearance panel animates `height` (`styles.css:1110`) because it must actually grow to fit a
  family of a different size; its comment states this. Only the reduced-motion gap is reported (#5).
- `transform-origin: center` on centred popovers here is correct: they are not anchored in a way
  that needs an origin, they are edge-aligned by `bottom`/`right`.

## Missed opportunities (additive)

1. **Family switch double-exposes** (`appearance.tsx` `panelFor`): the outgoing family's chips and
   the incoming ones are the same DOM nodes, so the swap shows the old value pressed against the new
   label for one frame. A 2 px `filter: blur()` during the height transition masks it.
2. **The popover opens without saying where it came from.** It grows from its trigger but only
   `translateY(6px)` + fade; a `transform-origin` at the trigger edge (`right bottom`) would make the
   growth read as attached to the button.
3. **Arming multi-select has no motion.** It changes an icon and nothing else — the one state in the
   plugin whose consequences (a drag selecting instead of panning) are invisible until the user
   already dragged. A one-shot 160 ms pulse on the column's edge would say "armed" without cost.
