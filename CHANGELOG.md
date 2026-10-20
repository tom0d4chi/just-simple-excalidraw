# Changelog

All notable changes to this project are documented here.

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
