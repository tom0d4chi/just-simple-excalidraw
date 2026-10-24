# Changelog

All notable changes to this project are documented here.

## 0.1.182 - 2026-10-23

- A shape taken is two beats now - 30 ms at full amplitude, 38 ms of silence, 30 ms again - instead of
  one 60 ms pulse. Lengthening a pulse at maximum amplitude turns it into a hum, and a hum reads as
  softer than a knock: the finger judges the onset, and a long tail only blurs it.

## 0.1.181 - 2026-10-23

- A shape taken lands as HEAVY: full amplitude for 60 ms instead of 32, against a sweep that alternates
  43 % and 71 %. It was already at full amplitude, so the extra weight comes from lasting twice as long.

## 0.1.180 - 2026-10-23

- The sweep alternates one tap at 43 % (LIGHT, 50 ms) and one at 71 % (MEDIUM, 43 ms), so a single
  sweep puts both under the same finger and the hand can choose. Temporary: it settles on one.

## 0.1.179 - 2026-10-23

- The sweep takes LIGHT's amplitude - 43 % - instead of a full-amplitude pulse cut down to 11 ms. A
  phone hits hard at 100 % whatever the length; the only way to be softer is the other lever. It comes
  with LIGHT's own 50 ms, so the crackle is gentler and rounder, and a shape taken keeps the full
  amplitude at 32 ms. Two textures instead of two lengths of the same blow.
- A style now says either an impact or a duration, never both: the vibration fallback gets the duration
  that matches the intent.

## 0.1.178 - 2026-10-23

- The sweep at 11 ms.

## 0.1.177 - 2026-10-23

- The sweep at 13 ms.

## 0.1.176 - 2026-10-23

- The sweep sits at 15 ms: 22 ms was too strong under the finger, and 10 ms was under its threshold. A
  shape taken keeps its 32 ms, so the contrast is carried by that one being twice as long.

## 0.1.175 - 2026-10-23

- The marquee's crackle goes to medium - 22 ms at full amplitude instead of 10 - so the sweep is clearly
  present against the 32 ms of a shape taken.

## 0.1.174 - 2026-10-23

- Every tap is now a single full-amplitude pulse, and only its length changes: 10 ms for the marquee's
  crackle, 15 ms for a button, 32 ms for a shape taken. The impact styles are gone - LIGHT is a 50 ms
  pulse at 43 % amplitude, MEDIUM 43 ms at 71 %, HEAVY 60 ms at 100 %, which on a phone reads as "weak,
  then two identical thumps".
- Sent through vibrate({ duration }), which the plugin maps to a one-shot at DEFAULT_AMPLITUDE.

## 0.1.173 - 2026-10-23

- Everything back to LIGHT - the column, the pen, the text, the cadrage, the marquee's ticking - and the
  arrival of a shape keeps its HEAVY.
- A shape the box leaves is forgotten, so taking it again announces it again: the set of what the
  gesture holds is replaced on every frame, not only when something arrives.

## 0.1.172 - 2026-10-23

- The marquee ticks for distance, flat: one tap every 32 px travelled, whatever the speed. What the
  hand feels is how far it has gone, not how fast.
- Every tap is a MEDIUM impact - the whole column, the pen, the text, the cadrage - and a shape joining
  the box lands as a HEAVY one, once per shape. The sweep is a rhythm, the arrival is an event.

## 0.1.171 - 2026-10-23

- LIGHT is a whisper on most phones, and a 5 ms pulse is under what an Android vibrator will render at all - the tick was being sent and arriving as nothing. A tick is a MEDIUM impact now, or 16 ms through the vibration API; a plain light press goes from 8 to 10 ms.

## 0.1.170 - 2026-10-23

- Nothing is felt, and there are three different reasons it could be: the plugin never asks, the Capacitor plugin is absent, or the vibration API is. haptic-log.md opens with what the device offers - capacitor yes/no, haptics yes/no, vibrate yes/no - then one line per call with the path it took, capped at a hundred and twenty so a marquee cannot flood the vault.

## 0.1.169 - 2026-10-23

- Two things were wrong. The step was constant, so the tempo was linear in speed - and a linear tempo reads as "about the same" to the hand; the range has to be wider than the speed range. It is 170 px per tap at a careful sweep and 42 px at a flick now, blended on the smoothed speed. The other was worse: the tick went to Capacitor as style "TICK", which the plugin does not have - it knows LIGHT, MEDIUM and HEAVY. Every tap was rejected on the phone and fell back to the vibration API, which a WebView usually ignores. A tick is the lightest impact, and it is sent as one. Verified: 400 px at 420 px/s -> 4 taps (3.9/s), at 1100 px/s -> 10 taps (24/s), a flick -> 33/s, against a ceiling of 38.

## 0.1.168 - 2026-10-23

- One tap every 55 px travelled, so the tempo is the speed of the hand divided by the step: sweep twice as fast, crackle twice as fast; stop the finger, the sound stops. What sits under the box stops mattering, which is what a speed should depend on. Distance comes from the coalesced points of each move event - a flick arrives as one event holding fifteen points, and counting only its endpoints would make the fastest sweep the quietest one. Ceiling at thirty taps a second, where the platform merges them into a buzz anyway; the debt is kept and spent as soon as the hand allows. Verified: 500 px at walking pace -> 12 taps; the same 500 px at double speed -> 11 taps in half the time; an instantaneous flick -> 1 tap, the rest queued behind the ceiling.

## 0.1.167 - 2026-10-23

- One tap per shape the box takes, at the moment it takes it. The set of what a gesture has already caught is reset for each marquee, so a shape the box leaves and takes again does not tick twice, and a sweep over nothing stays silent. A dedicated "tick" style - 5 ms, the shortest the platform will give - so a run of them reads as a rhythm rather than one long buzz. Verified: a sweep over three rectangles ticks three times, one per shape; a sweep that encloses nothing ticks zero.

## 0.1.166 - 2026-10-23

- The measurements killed the idea of a "light" pinch: a hand travels 100-300 px in 80-160 ms whether it means it or not. So the gesture is not identified by size. What it does is Procreate's: a pinch keeps its zoom, and the drawing is re-fitted only when the zoom has gone past the point where the whole sheet already fits on screen - below that, zooming out has nothing left to show. Measured on release: content bounds times zoom against the canvas box. The log records whether the sheet fitted, so the next batch of gestures settles it. Verified: closing pinch with a small rectangle -> one scrollToContent and the view centred; closing pinch with 4000x3000 of content at zoom 1 -> fits false, no call.

## 0.1.165 - 2026-10-23

- Sixty gestures recorded on the phone say what a hand actually does: 80-160 ms, fingers travelling 100-300 px. So "light" as a small movement could never fire - the threshold was written from an idea of a hand, not from one. What fires now is the shape of the gesture: the fingers closed (ratio at most 0.86) within 380 ms. Closing the fingers is a zoom out, and zooming out is how anyone asks to see the whole sheet; zooming in is untouched, so a pinch that meant to zoom still zooms. The log carries the ratio and the zoom at release, and starts from a clean table.

## 0.1.164 - 2026-10-23

- A phone's console cannot be read from here; the vault can. Every two-finger gesture appends one line to pinch-log.md at the vault root: hour, duration, the spread it started from, the travel of the pair, the drift of its middle, how many move events arrived, and whether it was recognised. Written as a table so the note reads on its own, and temporary: it goes once the thresholds are set from a real hand rather than from a guess.

## 0.1.163 - 2026-10-23

- Two releases have now guessed at a threshold for a gesture nobody can see on the other side of the phone. This one stops guessing: the palette gets "Fit drawing to view" - the same scrollToContent, one tap, no gesture - and every two-finger gesture reports its duration, the travel of the pair and the drift of its middle in a notice, so the next threshold comes from a measurement instead of from another guess.

## 0.1.162 - 2026-10-23

- The test was a ratio: the spread at the end against the spread at the start. Two fingers land a couple of centimetres apart, so 12 % of that is a few millimetres of travel - a band nobody reaches, which is why the first version never fired on the phone even though it passed every synthetic test. Light is now how little the hand moved: the distance between the fingers changed by less than 44 px and the middle of the pair moved less than 44 px, within 400 ms. Plus a haptic tap when it fires, since the gesture has nothing to see. Verified: 36 px of travel refits, 140 px does not.

## 0.1.161 - 2026-10-23

- Two fingers, almost no spread, released quickly, no travel in between: scrollToContent fits the whole scene to the viewport, animated, with a tenth of margin. No camera arithmetic of our own - Excalidraw already measures both the scene and the viewport. Light, in numbers: under 330 ms, spread within 12 % of where it started, middle of the pair moved less than 26 px. A zoom pinch fails all three, a two-finger pan fails the last one; both verified silent. Also fixed: a second finger counted as a second tap, so every two-finger pinch tripped the double-tap zoom before the fingers moved. Only a primary touch counts as a tap now - verified the double tap still zooms.

## 0.1.160 - 2026-10-23

- Their offset was a distance from the middle of the frame, and the frame's height is animated: as it shrank the middle rose, so the button climbed while it faded - a diagonal exit that came back on the return trip. The offset is now a distance from the top edge, a fixed edge, read from the slot's own offsetTop instead of a sum of row heights. Two things found on the way: the layers were covering the pill's padding, so the buttons sat on the border with all the air under them; and the pen's placement effect did not depend on penAtTop, so opening the pen page from another tool's page left the pen on the tools row. Verified: pen leaving from the pen page holds top 5 while fading out (left 1 -> -13) with the frame steady at 142; travelling to its page it goes 40 -> 19 -> 12 -> 7 -> 5 with the disc at 0,0; the first row is now inset 5 px from the frame's edge.

## 0.1.159 - 2026-10-23

- The delegated listener never reached those two on the device - and they are exactly the buttons that move when pressed, so the confirmation is wired where the press is delivered: an onPointerDown on each. The delegated listener returns early for them, so a press still buzzes once and never twice. The travelling behaviour is untouched: same elements, same placement, same disc. Verified: pen press, pen press again, text press, text press again - one buzz each, tool back to hand after the second; a property button still buzzes once.

## 0.1.158 - 2026-10-23

- src/haptics.ts: Capacitor's Haptics plugin first (Obsidian's mobile shell is a Capacitor app), then the vibration API, then silence; wrapped so it can never throw into a click handler. One delegated pointerdown listener in the toolbar covers the whole surface - the column's buttons, the shape strip, the appearance values panel - so a control added later gets it for free. On press, not on release: a held tap can still be abandoned and the confirmation belongs at contact. Verified with navigator.vibrate stubbed: every column button buzzes once per press, the shape strip buzzes, the appearance swatch buzzes, a press on the canvas stays silent.

## 0.1.157 - 2026-10-23

- The layers centred their content and the frame's height is animated, so while the swap played every button also drifted vertically: the column slid diagonally instead of straight. Invisible enough while the column was centred; obvious the moment it hung from the top. The layers are anchored to the top. Buttons hold their y, fade sideways, the frame closes under them. Verified on both trips: outgoing column keeps Multi-select at y 25 and Eraser at y 245 through all six samples while the frame goes 272 -> 142, and on the way back 142 -> 272 with both held. The pen page still lands its traveller at 4 px with the disc at 0,0.

## 0.1.156 - 2026-10-23

- align-items: flex-start with a top padding of --jse-nav-gap: the same margin above the column as on its right, both read from the platform bar. A side effect worth keeping: the column no longer re-centres when its height changes, it grows downward from a fixed top. Verified with a 52 px bar sitting 24 px above the bottom: column top 24, right 24; the undo bar still 24 above the bar and 24 from the edge; the text page opens with the column at the same top (24) and the travelling button 4 px inside it.

## 0.1.155 - 2026-10-23

- 0.1.154 matched the icon size, which is not the same thing: the two bars still differed in thickness. layout.ts now also publishes the bar's height as --jse-nav-bar; the column takes its width from it minus its own padding and border, and the icons follow at 0.57 of the button, the ratio Obsidian uses itself. Verified against simulated bars: 52 px tall gives a 52 px column with 42 px buttons and 24 px icons, 36 px gives 36 / 26 / 15, 64 px gives 64 / 54 / 31.

## 0.1.154 - 2026-10-23

- layout.ts now measures an icon inside Obsidian's own navbar and publishes its width as --jse-nav-icon. The band takes that value and scales its buttons from it with the ratio the column already used (1.75): 24 px icons give 42 px buttons and a 52 px column, which is the height of the platform bar - the two read as one family. The metrics also moved from three places (pill, history, fallbacks) to the band, which both inherit. Verified with a simulated bar holding 24 px icons: --jse-nav-icon 24 px, column icons 24x24, buttons 42x42, pill and history 52 px wide.

## 0.1.153 - 2026-10-23

- The entrance animation was declared for the layers only: the exit named the history bar, the entrance did not, so redo was inserted at full size and only ever animated out. Same selector, both scopes now. Verified by toggling the collapsed class: animationName jse-tool-in, height 8 -> 21 -> 29 -> 33 -> 35 -> 36 px and opacity 0.23 -> 1 over 180 ms.

## 0.1.152 - 2026-10-23

- The two buttons trade places in their bar: redo first, undo second. Verified: the bar reads Redo then Undo, with redo collapsed (0 px, nothing to redo) and undo at 36 px, the bar itself still 46 px square.

## 0.1.151 - 2026-10-23

- Obsidian's floating bar leaves a margin under itself, and that is the app's own idea of comfortable: layout.ts now publishes it as --jse-nav-gap (window height minus the bar's bottom) and the column and the undo bar use it on both axes. Same air below that bar as between it and the undo bar, as to the right of the undo bar, and as to the right of the column. Verified with a simulated bar 48 px tall sitting 24 px above the bottom: the variable reads 24 px and the three gaps measure 24 px each. With no bar, nothing is published and both fall back to 8 px.

## 0.1.150 - 2026-10-23

- It was hung under the pill (top: 100%), so every height animation dragged it along. It is now a child of the band, pinned to its bottom with right: 0, and its position is the same number in every state. Being outside the pill it stopped inheriting the column's metrics and fell back to 42 px buttons: a 46 px column came out 52 px wide and three pixels off its axis. It now states the same --jse-tool-size and --jse-icon-size, so it is exactly as wide as the column and sits on the same axis. Verified: 46x46, centre delta 0, flush with the bottom of the band, and top 531 px in every sample while the column resizes from 236 to 274 px.

## 0.1.149 - 2026-10-23

- The two buttons swap places in the column: selection, pen, text, shapes, image, eraser. Verified: the column reads Multi-select, pen slot, text slot, shapes, Image, Eraser, with the pen at 213 px and the text at 251 px; the shape strip still opens eight pixels to the left of its button and stays centred on it.

## 0.1.148 - 2026-10-23

- It was fading out to the left with the tools layer while its page opened. It now has the same journey as the pen - up to the head of its page, disc under it, tapping it puts the tool down - implemented as a second, independent mechanism: its own element, its own layout effect, its own class and slot in the stylesheet. Duplicated on purpose: the pen was reverted once already for being touched by a shared change, and this keeps the two from ever dragging each other. Verified: text 118 -> 73 -> 30 -> 16 -> 9 -> 5 -> 4 px while the frame goes 236 -> 124, page showing Size and Stroke with no duplicate row, disc at 0,0, tapping the button gives hand. The pen still lands at 4 px with Thickness and Stroke.

## 0.1.147 - 2026-10-23

- Those pages have no fill family beside the stroke, so the colour can be the mark itself instead of a ring around nothing. With a selection the ring stays: a filled disc next to a filled fill swatch would be two discs of colour with no way to tell which is which. Verified: pen and text pages show a filled 22 px disc with the stroke colour and no border, turning rgb(224,49,49) after picking red, with currentItemStrokeColor updated; a selected rectangle keeps the 3 px ring in its own colour.

## 0.1.146 - 2026-10-23

- Generalising the travelling button to the text tool broke the pen's behaviour, so the column is back to what it was in 0.1.144. Verified by comparing the built bundle with the 0.1.144 asset: identical, byte for byte (b7b93a15...).

## 0.1.145 - 2026-10-23

- The travelling button is no longer about the pen: it carries whichever of the two stylable column tools is active, with its own icon, label and pressed state, and each keeps a slot where it belongs in both layers. Tapping text opens its page (size, stroke) with the button at the head of it and the disc under it; tapping that button puts the tool down and returns to the tools. Appearing is instant rather than a fade: the button it replaces was solid a frame ago, so it is solid again at once and only the travel animates. Shapes keep the plain row at the head of their page. Verified: text travel 80 -> 47 -> 26 -> 14 -> 8 -> 5 -> 4 px with the frame 213 -> 124 and opacity 1 throughout, page showing Size and Stroke; tapping the button gives hand and the tools; the pen still lands at 4 px with Thickness and Stroke.

## 0.1.144 - 2026-10-23

- Two discs were visible for two different reasons. The pen kept painting its own active background: the rule that clears it is written for buttons inside the layers, and the pen lives outside them. And the disc was measured once, at the pen's previous position, then animated the rest of the way by itself - which is the disc seen arriving from below. The pen is now covered by that rule, and during a move the disc follows the pen frame by frame with its transition switched off for those 320 ms. Verified: pen background rgba(0,0,0,0) in every state, disc at 0,0 from the pen through the whole travel, opacity 1.

## 0.1.143 - 2026-10-23

- Two things pulled it upwards. Its position was a distance from the top edge of the frame, and that edge moves as the frame changes height; it is now a distance from the middle, which does not. And its offset was recomputed on the way out, animating towards the depth of the other column's row. Verified: on the exit the pen's screen centre stays at 230.5 px for the whole 220 ms while its left edge goes 5 -> 1.3 -> -5 -> -8.9 -> -11.1 -> -12.2 -> -12.8 -> -13 px and opacity 1 -> 0; the travel to its own page still runs 42 -> 34 -> 21 -> 13 -> 6.6 -> 4.9 -> 4 px against a slot at 5 px.

## 0.1.142 - 2026-10-23

- It faded in place while the frame changed height underneath, which read as fading upwards. It now slides 18 px towards the left edge with the same 220 ms curve as the layers, and its row is frozen for the length of the exit so that nothing drags it vertically while it goes. The offset needed its own specificity: the base button rule sets translate: -50% for the centring, and a plain .is-away rule lost to it. Verified: left edge 5 -> 1.3 -> -5 -> -8.9 -> -11.1 -> -12.2 -> -12.8 -> -13 px over 220 ms while the top stays at 43 px and opacity falls 1 -> 0; returning restores 5 px and opacity 1.

## 0.1.141 - 2026-10-23

- .jse-root .jse-tool.clickable-icon sets the press-feedback transition and outranks a plain .jse-tools__pen, so the pen was repositioned instantly: the movement existed in the code but not on screen. The pen rule now matches that specificity and is written after it. Its position is computed from the slot's row - padding plus the rows above - and not from the slot's screen position: the frame's height is animated, so a measurement taken right after writing it still describes the previous state. Rows are read with offsetHeight, which ignores both the height animation and the column's entrance transform. Verified: pen at 43 px against a slot at 43 px in the tools, 5/5 on its own page and 43/43 on the way back, frame at 236, 124, 236; sampled travel 34 -> 21 -> 13 -> 9 -> 6.5 -> 5 px over 220 ms.

## 0.1.140 - 2026-10-23

- It could end up on the multi-select for two reasons. The first is a real bug: touching a stylable tool other than the pen opened a page that reserved the head slot as well, and the pen (which is drawn outside both layers) moved onto it, over the Rectangle row. The second is a missing fallback: with no measured position the pen stayed at top: 0, in the flow, under the first button, which is also what happens if its stylesheet is not applied. The pen now only travels to a page about the pen, fades out on another tool's page or with a selection, and the stylesheet places it on the second row by default. Verified: idle pen at 214 px against a multi-select at 176 px, no overlap; on its own page it sits at the head (4 px) with Thickness and Stroke below; on a rectangle's page it is at opacity 0 while the page shows Rectangle, Corners, Line style, Thickness, Fill, Stroke.

## 0.1.86 - 2026-10-21

- The mark on the active tool is one disc that travels between the buttons instead of a
  grey circle fading in under the new tool while it fades out under the old one. It is
  measured from the button itself (`offsetTop/offsetLeft`, which no transform touches, so
  a press or the column's entrance cannot skew it) and re-measured whenever the column
  reflows, so it stays on its tool while a group folds in or out. With the hand tool
  active nothing is lit and the disc steps aside.

## 0.1.85 - 2026-10-21

- The backing behind the column follows the appearance popover while it grows: a family
  panel animates its height in after the menu opens, and the rectangle used to decide
  the backing was read once, at open time, so the area the panel gained was ignored. The
  column and both popovers are now watched for size changes and re-measured whenever one
  lands (a closed menu is still ignored — nothing can sit under something invisible).

## 0.1.44 - 2026-10-20

- Removed a marquee rule left over from the first touch implementation: it was
  still painting its own thin dashed border in --text-accent (orange on a warm
  theme) on top of the new one, hence the double frame.

## 0.1.43 - 2026-10-20

- The marquee is drawn by the plugin now, in Obsidian's accent with a hint of fill,
  rounded corners and dashes that march while the drag lasts. Excalidraw's own is
  square and violet, and its colour is not exposed to CSS, so its interactive
  canvas is hidden for the duration of the gesture and restored on release.

## 0.1.43 - 2026-10-20

- The appearance menu shows whenever a pick has somewhere to go: with a selection
  it restyles it, and with a drawing tool active (pen, a shape, text) it sets what
  the next stroke will look like. The pen finally has a thickness while you draw.

## 0.1.42 - 2026-10-20

- That button is called "Sélection multi" now, and wears a dashed frame with a
  pointer instead of a plain arrow: it says what it is — the marquee — since
  everything else about the cursor happens without it.

## 0.1.41 - 2026-10-20

- A tap on empty paper leaves the cursor mode even when the cursor was pressed
  from its button: the button goes dark and the hand takes over. A drag keeps the
  mode, so the marquee still works.

## 0.1.40 - 2026-10-20

- The cursor is two things now. Pressed from its button it is a real mode: it
  lights up, and a drag on empty paper draws a marquee until it is pressed again
  (or another tool takes over). Armed silently to carry a selected element it does
  not light up, and a touch on empty paper hands the sheet back to the hand, so a
  drag there still pans.

## 0.1.39 - 2026-10-20

- The shape strip reads from its button outwards: the shapes are reversed, and the
  item closest to the button lands first, then the next one, out to the far left.
- Each item slides in from the right (14px) while scaling up, as if it came out of
  the button.

## 0.1.38 - 2026-10-20

- The shape list is a horizontal strip now, and it has no plate either: icons
  straight on the sheet, with a thin rule before the lock.
- Its items land one after the other (26ms apart) instead of all at once.

## 0.1.37 - 2026-10-20

- Every tool button is a switch: pressing the one that is already active gives the
  sheet back to the hand (cursor, pen, text, eraser, and each shape in the list).

## 0.1.36 - 2026-10-20

- The column has no plate behind it any more: no background, no border, no
  shadow. The icons sit straight on the sheet. The popovers keep their surface,
  since they hold text and swatches.

## 0.1.35 - 2026-10-20

- The gesture decides, as the finger lands: on an element the selection tool is
  armed (and the element selected), so the drag moves it; on empty paper the hand
  takes over, so the drag pans instead of starting a marquee. A cursor armed
  deliberately from its button keeps its marquee on empty paper.

## 0.1.34 - 2026-10-20

- A selection no longer changes the tool: tapping an element selects it and leaves
  the hand in place, so a drag pans instead of drawing a marquee. The marquee only
  exists while the cursor button is armed — as asked, and nothing else arms it.

## 0.1.33 - 2026-10-20

- An empty tap really returns to the hand now. The canvas clears the selection
  during the same tap, so the check ran too early and found nothing to react to;
  the decision is taken one tick later, once the canvas is done: nothing selected
  means the tap landed on paper.

## 0.1.32 - 2026-10-20

- A tap on an element now selects it and arms the selection tool, which the hand
  tool alone could never do (it ignores taps). A tap on empty paper drops the
  selection and hands the sheet back to the hand. A drag still pans and never
  selects — only a tap does.

## 0.1.31 - 2026-10-20

- On touch, a finger drag pans by default again: the hand is the base tool, and
  the marquee only appears when the cursor button is picked.
- While something is selected the selection tool takes over on its own, so the
  drag moves and resizes the element instead of panning; emptying the selection
  (tap on empty canvas) hands the sheet back to the hand tool.

## 0.1.30 - 2026-10-20

- "Edit text" works: it pressed Excalidraw's own Edit button, which is enabled but
  does nothing when its bar is hidden, and that silent success blocked the
  fallback. It now sends Enter to the canvas, which opens the editor on the
  selected text.

## 0.1.29 - 2026-10-20

- The ruled grid is replaced by a dot grid. Excalidraw paints its grid into the
  canvas bitmap, where no stylesheet can reach, so its grid is kept off and the
  canvas is left transparent: the paper (background plus dots) is drawn behind it
  and follows pan and zoom. The background now comes from Obsidian's theme, so a
  drawing reads correctly in light and dark.
- A setting turns the dots off.

## 0.1.28 - 2026-10-20

- "Edit text" no longer borrows the text tool's T: it has its own glyph (a square
  with a pen), so selecting a text no longer shows the same icon twice.

## 0.1.27 - 2026-10-20

- The palette only appears when something is selected: with nothing to style it
  had no business in the column, and it now folds away with the actions it
  belongs to (same in/out motion).
- Duplicate, delete, edit text and the palette now sit together in one group at
  the foot of the tools, instead of the actions hanging under the selection tool.

## 0.1.26 - 2026-10-20

- Interface strings follow Obsidian's own language (read from moment's locale)
  instead of the Spanish the fork came with: French, English and Spanish are
  provided, anything else falls back to English. Labels, tool names, the
  appearance menu and the settings tab all switch together.
- The appearance menu no longer gets cut: its rows are tighter (36px swatches) and
  its height cap is above what six rows need, so nothing scrolls at normal
  phone sizes; on a very short window it scrolls instead of being clipped.

## 0.1.25 - 2026-10-20

- The appearance controls are back, in the same kind of menu as the shape picker:
  stroke colour, fill, thickness, line style, corners, and text size when a text
  is involved. It opens out of its button, upwards, with the same in/out motion.
- With something selected the menu shows that element's own style, not the tool
  defaults, and every pick rewrites the selected elements (new version, so it is
  a real step in the history) as well as the defaults for the next one.
- Excalidraw's own property panel stays hidden.

## 0.1.24 - 2026-10-20

- The column now centres on the drawing area Obsidian actually leaves free: the
  mobile navbar and the gap under it are measured and subtracted, so the middle
  of the column sits in the middle of what you can draw on. It follows the bar
  when it grows, hides or the device rotates.
- Redo only appears when there is something to redo — it folds away with the same
  animation as the selection actions.
- Undo, redo, duplicate, delete and edit text now click Excalidraw's own buttons
  instead of replaying key presses: same handler, same history entry, no guessing
  at modifiers.

## 0.1.23 - 2026-10-20

- The column's inset is written once for both ends (6px, border included), and no
  margin is left above the first button or below the last one, so the space at
  the top and at the bottom is identical — at rest and expanded.

## 0.1.22 - 2026-10-20

- The column is centred on the canvas, not on a band inset by the safe area: the
  bottom inset (the gesture bar) was pushing the middle up by half of it, which
  is why it looked slightly high, and why it grew lopsided. It now sits on the
  exact middle of the drawing area and stays there when it expands.

## 0.1.21 - 2026-10-20

- Every animation now runs both ways. The shape list fades and slides out the
  same way it comes in, and the selection actions collapse instead of vanishing,
  so the column slides back on its own.
- Resting states never depend on an animation finishing: each state is written
  as a class, and the animation only supplies the frames in between. If motion is
  off or a WebView skips it, the result is still the correct picture.

## 0.1.20 - 2026-10-20

- Excalidraw's bottom left bar is now hidden entirely: its three selection
  actions moved into the editing column. They appear only when something is
  selected — duplicate and delete for any selection, plus edit text when a single
  text element is selected — and grow into place, so the rest of the column
  slides instead of jumping.
- Duplicate and delete reuse Excalidraw's own shortcuts, so they go through its
  history and leave an undoable step.

## 0.1.19 - 2026-10-20

- The image tool is back in the column instead of the shape list. It no longer
  arms Excalidraw's image tool, which refuses to be set from code: the button
  opens the system picker, reads the file and inserts the picture in the middle
  of the view, already selected. Saved with the drawing like any other image.
- The shape list opens straight down instead of sideways, and it fades in with a
  short slide instead of bouncing.

## 0.1.18 - 2026-10-20

- The hamburger is gone. What it held is either useless in a vault or available
  elsewhere, so the bar it lived in now only shows when a selection exists, for
  duplicate and delete.
- The column holds a single shape button instead of a "more tools" button: it
  opens a short list aligned with its icon — rectangle, diamond, ellipse, arrow,
  line, image — plus a lock to keep the shape after each draw. The button wears
  the icon of the shape you last picked and lights up when a shape is active.
- The column is centred in the view again instead of being pushed down by the
  space the hamburger used to need.

## 0.1.17 - 2026-10-20

- Fixed the canvas menu (the burger) being clipped: it now opens above its
  button with a capped height and scrolls, instead of stretching the bar off
  screen. The bar sits bottom left again, the orientation Excalidraw positions
  its menus and its colour sheet for.
- That menu was Excalidraw's own and mostly irrelevant in a vault: "Open",
  "Save to…", "Export image…", its dark mode toggle and three promotional links
  are hidden. It now holds three useful entries — find on canvas, help, and
  reset the canvas, which still asks for confirmation.

## 0.1.16 - 2026-10-20

Touch interaction rebuilt around how phones actually work, and the column
trimmed to its core.

- **One finger acts, two fingers pan and pinch-zoom.** That is Excalidraw's own
  multi-touch gesture, and what every mobile drawing app does. On touch the
  selection tool is now the base tool, so a drag on empty canvas draws a marquee,
  a drag on a shape moves it, and panning never needs a mode change. The hand
  tool and its double-tap workaround are gone from mobile; the hand tool is kept
  on desktop, where there is no second finger.
- **The column keeps only the core:** selection, pen, rectangle, arrow, text,
  eraser, colour, undo, redo. Line, ellipse, diamond, image and the tool lock
  moved behind a "more" button that opens above the core set and collapses as
  soon as a tool is picked. When the active tool lives in the overflow, the
  "more" button shows it.
- **Motion:** the column lands with a short spring, the newly selected tool
  bounces once, tools revealed by the overflow pop in. Press feedback on every
  button, all of it disabled under `prefers-reduced-motion`.
- **No desktop leftovers on touch:** hover styling only where a pointer can
  hover, no keyboard shortcut badges, no hint line, no long-press callout or
  text selection on the column.

## 0.1.15 - 2026-10-20

Mobile robustness pass, from an audit of the touch interaction:

- The toolbar no longer moves under the finger: the colour button used to
  appear and disappear, shifting the whole column by 22px. It is always
  rendered, disabled when no style can be applied.
- A double tap no longer goes dead after the first selection: only a tap that
  actually drops a selection hands back to the hand tool.
- The double-tap marquee selects whole groups, like Excalidraw, instead of a
  single member that would then move alone.
- The column keeps clear of Obsidian's floating navbar on a short viewport
  (phone held sideways) instead of overlapping it by a few pixels.
- The gesture handlers attach to the view host rather than to the canvas node
  looked up at mount, so they cannot end up bound to nothing.

## 0.1.14 - 2026-10-20

- Design pass: the editor now follows the vault theme instead of Excalidraw's
  own palette. Excalidraw's colour, surface, button, input, shadow, radius and
  font variables are re-pointed at Obsidian tokens, so light/dark, community
  themes, the accent colour and the interface font all apply to the toolbar,
  Excalidraw's menu, its colour sheet, its popovers and the context menu.
- Canvas background follows the theme background instead of Excalidraw's fixed
  white/near-black.
- Raised surfaces use Obsidian's recipe: theme background, hair border, theme
  shadow. The colour sheet is a theme panel with `--radius-l` corners.

## 0.1.13 - 2026-10-20

- The toolbar is fixed to the right edge, one vertical column. The horizontal
  bottom placement and its setting are gone.
- The settings tab no longer has options; it reports the installed version, so
  an update that did not land is visible immediately.

## 0.1.12 - 2026-10-20

- Double tap and drag on the canvas draws a selection marquee, so selecting no
  longer needs a trip to the toolbar; a double tap without dragging switches to
  the selection tool, and that automatic switch hands back to the hand tool as
  soon as nothing is selected.
- Toolbar rebuilt so every control is reachable without scrolling: eight buttons
  on the first row, the rest wrapped under it, all fifteen on one row from a
  tablet or an unfolded folding phone.
- The toolbar now carries the colour / stroke sheet ("Color y grosor"), which
  matters on a phone where Excalidraw hides it behind its own bar.
- Excalidraw's own bar (canvas menu, duplicate, delete) is kept and moved to the
  top right, drawn with the same tokens, instead of being hidden.

## 0.1.11 - 2026-10-20

- The hand tool is now the default, so a drag pans the canvas; selection is one
  tap away in the toolbar.
- Added an Obsidian mobile style floating toolbar with all drawing tools, tool
  lock, undo and redo, drawn with Obsidian's own tokens and Lucide icons.
- Added a setting to place that toolbar at the bottom (horizontal) or along the
  right edge (vertical).
- Fixed shifted taps and drags on mobile: Excalidraw's cached canvas offset is
  now refreshed whenever the view moves, instead of only when the canvas or the
  window resizes.
- Skips autosave writes when the serialized scene is unchanged.

## 0.1.10 - 2026-09-19

- Removed the unused Firebase configuration and Google API key inherited from
  the upstream Excalidraw package, which could trigger corporate secret scanners.
- Added build regression tests and release checks to prevent Google API keys
  or the unused Firebase configuration from reappearing in published bundles.

## 0.1.9 - 2026-08-27

- Added support for Obsidian on phones and tablets.
- Added a release audit that rejects desktop-only manifests and runtime Node.js
  or Electron dependencies.

## 0.1.7 - 2026-08-22

- Prevented stale asynchronous file loads from replacing the current canvas.
- Prevented concurrent editing of the same drawing in multiple plugin tabs.
- Saved pending changes before reloading the same drawing and strengthened scene
  validation before an editor is mounted.

## 0.1.6 - 2026-08-22

- Fixed a critical data-loss bug that could overwrite a drawing with the scene
  from a previously opened file when switching files in the same tab.
- Added a regression test that verifies scenes and autosaves remain isolated
  to their own files.

## 0.1.3 - 2026-08-20

- Made npm and its committed `package-lock.json` the canonical reproducible
  build environment used both locally and in GitHub Actions.

## 0.1.2 - 2026-08-20

- Removed the redundant word “Obsidian” from the plugin manifest description.
- Added GitHub artifact attestations for `main.js` and `styles.css`.
- Removed unused web-storage recovery and Excalidraw's dynamic error-constructor helper.

## 0.1.1 - 2026-08-20

- Rebuilt the editor without Mermaid conversion and its dependency tree.
- Reduced the release `main.js` from 24.62 MB to under 5 MB for Obsidian Sync
  Standard compatibility.
- Replaced the full font collection with one embedded Excalifont subset for
  Latin characters.

## 0.1.0 - 2026-08-20

- First public release.
- Local Excalidraw editor for native `.excalidraw` files.
- Autosave, conflict protection, embedded images, local recovery and offline
  packaged font assets.
