# Changelog

All notable changes to this project are documented here.

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
