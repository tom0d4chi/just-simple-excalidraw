import { readFile } from "node:fs/promises";

/*
 * Patches applied to Excalidraw while it is being bundled.
 *
 * The library is a dependency, not our code: its internals are compiled, renamed and not exported, so
 * the only place to change one of its behaviours is the text that enters our own bundle. Each patch is
 * anchored on the exact source it expects and throws when that text is gone - a library update must
 * stop the build, never quietly bring back the behaviour we removed or lose the one we added.
 */

/*
 * The grips a selection is handled by, drawn in one function: the rotation one is turned into nothing
 * (this plugin draws its own), and the eight resize ones become white discs with an accent rim, 14 px
 * across on screen - constant, because the size is divided by the zoom.
 *
 * Only the drawing changes. The area that answers a finger is Excalidraw's own touch size, untouched.
 */
const nativeGrips =
  'i==="rotation"?Ta(e,l+c/2,s+m/2,c/2):e.roundRect?(e.beginPath(),e.roundRect(l,s,c,m,2/t.zoom.value),e.fill(),e.stroke()):nl(e,l,s,c,m,l+c/2,s+m/2,n,!0)';
const drawnGrips =
  'i==="rotation"?0:(function(){var R=7/t.zoom.value;'
  + 'e.beginPath();e.arc(l+c/2,s+m/2,R,0,6.2832);'
  + 'e.fillStyle="#ffffff";e.fill();'
  + 'e.lineWidth=1.6/t.zoom.value;e.stroke();'
  + 'e.fillStyle=e.strokeStyle})()';

/** Rewrites the transform-handle renderer: no native rotation grip, round resize grips. */
export const excalidrawGrips = {
  name: "excalidraw-grips",
  setup(build) {
    build.onLoad({ filter: /excalidraw[\\/]dist[\\/]prod[\\/]index\.js$/ }, async (args) => {
      const contents = await readFile(args.path, "utf8");
      if (!contents.includes(nativeGrips)) {
        throw new Error("Excalidraw's transform handles were not found where expected: the grips patch must be rewritten.");
      }
      return { contents: contents.replace(nativeGrips, drawnGrips), loader: "js" };
    });
  }
};
