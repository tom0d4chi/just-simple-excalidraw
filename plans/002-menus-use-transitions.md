# 002 — Open and close the strip with transitions, not keyframes

- **Status**: TODO
- **Commit**: a6e9950
- **Severity**: HIGH
- **Category**: Interruptibility
- **Estimated scope**: 1 file (`src/styles.css`), 4 rules + 2 keyframe blocks removed

## Problem

The shape strip and the collapsible tools enter and leave with `@keyframes ... forwards`.
Keyframes cannot be retargeted: closing the strip and reopening it inside the 120 ms exit replays
the entry from `opacity: 0`, so the strip flashes instead of turning around. The shape strip's
exit also uses `ease-in`, which starts slow — the exact opposite of what an exit needs, and the
only moment a user actually watches.

The buttons that own these animations are tapped tens of times a day; rapid open/close is the
normal way this strip is used.

```css
/* src/styles.css:472-484 — current */
.jse-shapes__menu.is-closed {
  opacity: 0;
  transform: translateX(6px);
  pointer-events: none;
}

.jse-shapes__menu.jse-anim {
  animation: jse-menu-in 140ms ease-out backwards;
}

.jse-shapes__menu.jse-anim.is-closed {
  animation: jse-menu-out 120ms ease-in forwards;
}
```

```css
/* src/styles.css:595-601 — current */
.jse-root .jse-tools__pill > .jse-tool--collapsible.jse-anim {
  animation: jse-tool-in 200ms cubic-bezier(0.22, 0.61, 0.36, 1) backwards;
}

.jse-root .jse-tools__pill > .jse-tool--collapsible.jse-anim.is-collapsed {
  animation: jse-tool-out 180ms cubic-bezier(0.22, 0.61, 0.36, 1) forwards;
}
```

```css
/* src/styles.css:851-857 — current, same pattern for the shapes button */
.jse-root .jse-tools__pill > .jse-shapes--collapsible.jse-anim {
  animation: jse-tool-in 200ms cubic-bezier(0.22, 0.61, 0.36, 1) backwards;
}

.jse-root .jse-tools__pill > .jse-shapes--collapsible.jse-anim.is-collapsed {
  animation: jse-tool-out 180ms cubic-bezier(0.22, 0.61, 0.36, 1) forwards;
}
```

The keyframes themselves live at `src/styles.css:603-649` (`jse-menu-in`, `jse-menu-out`,
`jse-tool-in`, `jse-tool-out`).

## Target

Transitions on the two properties that can be interrupted, with the strong ease-out curve, and a
`@starting-style` for the first paint. Enter 140 ms, exit 100 ms — exits are faster than
entrances, the standard asymmetry.

```css
/* target — src/styles.css, replaces the rule at 478-484 */
.jse-shapes__menu {
  /* Resting (open) state: the transform below is the closed offset's counterpart. */
  opacity: 1;
  transform: translateX(0);
  transition:
    opacity 140ms cubic-bezier(0.23, 1, 0.32, 1),
    transform 140ms cubic-bezier(0.23, 1, 0.32, 1);
}

@starting-style {
  .jse-shapes__menu {
    opacity: 0;
    transform: translateX(6px);
  }
}

.jse-shapes__menu.is-closed {
  opacity: 0;
  transform: translateX(6px);
  pointer-events: none;
  /* Leaving is quicker than arriving. */
  transition:
    opacity 100ms cubic-bezier(0.23, 1, 0.32, 1),
    transform 100ms cubic-bezier(0.23, 1, 0.32, 1);
}
```

```css
/* target — the two collapsible tool rules at 595-601 and 851-857 collapse into one */
.jse-root .jse-tools__pill > .jse-tool--collapsible,
.jse-root .jse-tools__pill > .jse-shapes--collapsible {
  /* The rows already carry height:var(--jse-tool-size, 42px) when open; animating the
     opacity only is deliberate — see step 3. */
  opacity: 1;
  transition: opacity 140ms cubic-bezier(0.23, 1, 0.32, 1);
}

.jse-root .jse-tools__pill > .jse-tool--collapsible.is-collapsed,
.jse-root .jse-tools__pill > .jse-shapes--collapsible.is-collapsed {
  opacity: 0;
  transition: opacity 100ms cubic-bezier(0.23, 1, 0.32, 1);
}
```

Delete `@keyframes jse-menu-in`, `jse-menu-out`, `jse-tool-in`, `jse-tool-out` (603-649) and
every reference to the `jse-anim` class in these four rules. Leave the `jse-anim` class itself in
the markup alone — the bar entrance (`287`) still uses it.

## Repo conventions to follow

The plugin already states "motion is reversible everywhere: every state change is a transition
between two classes" (`src/styles.css:282-285`) — this plan simply makes the strip obey that
comment. The tool disc is the in-repo exemplar of a retargetable transition
(`src/styles.css:406-412`).

## Steps

1. Replace the shape strip's open/closed rules (472-484) with the target CSS. The strip's base
   rule at `438-471` already sets `opacity: 1; transform: none;` — after this change it must set
   `transform: translateX(0)` instead of `none`, because a transition between `none` and a
   translate does not interpolate in every engine. Change only that one declaration there.
2. Add the `@starting-style` block right after the strip's base rule.
3. Replace both collapsible rules (595-601, 851-857) with the merged pair in the target. The
   collapsed rows already animate their `height` in the old keyframes; that height animation is
   dropped on purpose: it animates a layout property on a column that sits over the canvas (the
   audit's performance rule), and the strip is 42 px tall, so an opacity-only change reads clean.
   Keep the existing `height: 0; margin-bottom: 0; overflow: hidden` from the `.is-collapsed`
   rules at `578-593` and `838-849` — the layout jump stays instant, the fade covers it.
4. Delete the four keyframe blocks at 603-649.
5. If plan 006 landed first, use `var(--jse-ease-out)` instead of the literal curve.

## Boundaries

- Do NOT touch `.jse-tools__pill.jse-anim` / `jse-bar-in` (287-300) — the bar entrance is not
  interruptible by design (it runs once when the view mounts).
- Do NOT change the 6 px offset, the 140/100 ms durations, or add a scale.
- Do NOT touch `src/*.tsx`: the `jse-anim` / `is-closed` / `is-collapsed` classes are already
  toggled correctly by the components.
- Do NOT animate `height` back in "for completeness".
- If the rules at those lines differ from the excerpts, STOP and report.

## Verification

- **Mechanical**: `npm run check` (the harness drives the strip) then `npm run build`;
  `grep -c "jse-menu-in\|jse-menu-out\|jse-tool-in\|jse-tool-out" dist/styles.css` → `0`.
- **Feel check**: on the phone, with a drawing open:
  - Tap the shapes button twice in quick succession, five times in a row: the strip must turn
    around mid-flight, never disappear and re-enter from nothing.
  - Open the strip, then immediately tap a shape: the strip must start closing on the same frame.
  - Same test on a collapsible tool row (the row that appears only with a selection).
  - DevTools → Animations, playback 10%: the exit must start fast (most of the 6 px offset covered
    in the first 30 ms) and the entry must decelerate into place.
  - Rendering panel → `prefers-reduced-motion: reduce`: plan 005 handles the final state
    (instant, no fade); if it has not landed, the transitions still run and that is acceptable
    here.
- **Done when**: spamming the toggle never shows a frame with the strip fully invisible while it
  should be open, and no `@keyframes` remains for the strip or the collapsible rows.
