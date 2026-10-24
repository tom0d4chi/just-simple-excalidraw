# Boards

A local-first drawing board for Obsidian: open a board, think with your hands, close it. The file is
yours, the editor works offline, and nothing leaves the vault.

Boards is a fork of [Just Simple Excalidraw](https://github.com/DavidHurtadoAI/just-simple-excalidraw)
by David Hurtado, which itself stands on the open-source [Excalidraw](https://excalidraw.com/) editor.
The drawing engine is theirs; the name, the mobile toolbar and the file extension are this fork's.

## Why this fork exists

Just Simple Excalidraw did the hard part well: a small, honest wrapper around the real Excalidraw
editor, storing portable JSON files in the vault, with no account, no cloud, no feature race. It works,
and it stayed small on purpose.

But it was built for a desk. Its toolbar is Excalidraw's own, and that toolbar carries a desk's
assumptions: a burger menu, a "more tools" arrow, panels that open off-screen, hit areas sized for a
mouse. On a phone — which is where a drawing starts when an idea arrives — using it means aiming at a
pixel twice per stroke.

Boards is that same engine with the toolbar rebuilt for a hand: a single vertical column pinned to the
right edge, sized from Obsidian's own mobile chrome so the icons are the ones the eye already knows.
Everything that is not a drawing tool left the column, and every control answers with a tap you can
feel.

Two changes go further than the toolbar:

- **Files are `.board`**, because a drawing in this vault is a board, not a file format. Existing
  `.excalidraw` files still open, in the same view, untouched — no migration, no renaming.
- **The view frames itself on open**, so a file made on another device never lands on blank paper.

Nothing else was added on purpose. There is no embedding syntax, no OCR, no AI, no collaboration and no
export pipeline — not because they are bad ideas, but because they are other projects, and this one is
about the first thirty seconds of an idea.

## What it does

- Creates and opens native `.board` boards from the command palette or the ribbon.
- Opens `.excalidraw` files made before the rename, without converting them.
- Runs on Obsidian desktop, phones and tablets, with the same local-first behaviour everywhere.
- Uses the official Excalidraw editor with its standard drawing tools.
- Saves automatically after a short pause, and writes images into the board as embedded data so a
  board stays self-contained.
- Stops autosave if the file changes outside the open editor, instead of overwriting silently.
- Reports malformed files without touching the original.
- Follows Obsidian's light and dark theme.
- Frames the drawing when a board opens (setting, on by default).
- Replaces Excalidraw's toolbar with a vertical column styled after Obsidian's mobile chrome: icons
  24 px, buttons 42 px, and the column as thick as the platform bar is tall.
- Reads Excalidraw's own undo and redo buttons, so the history bar only shows what actually exists.

## Drawing controls

**On touch, one finger acts and two fingers pan and pinch-zoom.** A tap on empty paper drops the
selection and gives the sheet back to the hand; a tap on a shape selects it and lets the finger drag
it. The multi-select button arms a marquee that clicks as it sweeps — a tap every 32 px of travel, and
a heavier one each time a shape is caught.

**A closing pinch frames the whole board**, the way Procreate brings the canvas back: bring the fingers
together and, once everything already fits on screen, the view settles on the fit. Zooming in is never
touched.

## Theme

The editor does not carry its own palette. Excalidraw's design variables (`--island-bg-color`,
`--color-primary`, `--button-*`, `--input-*`, `--shadow-island`, `--ui-font`, …) are re-pointed at
Obsidian's tokens, so the chrome follows whatever the vault uses: light or dark, a community theme,
the accent colour chosen in Appearance, the interface font and the theme radii. Because everything is
expressed as CSS variables, changing the theme updates the editor live.

## Installation

### Manual

1. Download `main.js`, `manifest.json` and `styles.css` from the latest release.
2. Put them in `<vault>/.obsidian/plugins/boards/`.
3. Reload Obsidian and enable **Boards** in Settings → Community plugins.

### BRAT

Add `tom0d4chi/obsidian-boards` as a beta plugin in
[BRAT](https://github.com/TfTHacker/obsidian42-brat).

## One board, one editor

Each board file is editable in one Obsidian tab at a time; opening one that is already open activates
its existing tab. This prevents two editors from saving competing versions of the same file.

Obsidian's pane menu also shows **Split right** and **Split down** for every tab. Those commands
belong to Obsidian, not to this plugin, so they cannot be hidden only for boards through the supported
plugin API. If you use either command on a board, Obsidian may briefly create a new pane; the plugin
then returns focus to the original board and closes the duplicate pane.

## Lean build and Obsidian Sync

Community Plugins installs `main.js`, `manifest.json` and `styles.css` from a GitHub release. Since
Obsidian Sync Standard cannot sync a plugin file larger than 5 MB, the release `main.js` stays below
that limit: one embedded Excalifont subset covering Latin characters, including Spanish accents. Other
scripts and the optional font variants fall back to fonts available on the local system. No font and
no code is downloaded at runtime.

## Privacy and permissions

- **Network:** no runtime requests. The one bundled Latin font subset and all editor code ship in the
  release.
- **Vault files:** only the board you open or create, plus the folders you point the plugin at.
- **Clipboard:** standard copy and paste, including pasting an image, run only when you invoke them.
- **Files outside the vault:** only an image you explicitly choose or paste; it is embedded into the
  active board, and images over 10 MiB are rejected.
- **Browser storage:** the plugin itself keeps no vault data in `localStorage` or `sessionStorage`; the
  file in your vault is the source of truth.
- **Telemetry, ads, accounts and payments:** none.

## Development

Requires Node.js 22.13 or later and npm.

```bash
npm ci
npm run check   # tests, type-check, production build, release audit
npm run dev     # watch build
```

Releases are cut from `main`; `scripts/publish-build.mjs` pushes `main.js`, `manifest.json` and
`styles.css` to the `build` branch.

## License and acknowledgements

MIT, as the upstream project. The drawing engine is [Excalidraw](https://github.com/excalidraw/excalidraw)
(MIT), the toolbar icons are [Lucide](https://lucide.dev) (ISC), and the fork descends from
[Just Simple Excalidraw](https://github.com/DavidHurtadoAI/just-simple-excalidraw) by David Hurtado,
whose restraint made this possible. Boards is not affiliated with or endorsed by Excalidraw; if
Excalidraw matters to your work, consider supporting the upstream team with
[Excalidraw+](https://plus.excalidraw.com/).
