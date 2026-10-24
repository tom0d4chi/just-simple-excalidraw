import { readFile } from "node:fs/promises";

/*
 * Patches applied to Excalidraw while it is being bundled.
 *
 * The library is a dependency, not our code: its internals are compiled, renamed and not exported, so
 * the only place to change one of its behaviours is the text that goes into our own bundle. Each patch
 * is anchored on the exact source it expects and throws when that text is gone - a library update must
 * stop the build, never quietly bring back the behaviour we removed.
 */

/* The rotation grip Excalidraw paints for itself: one ternary in the transform-handle renderer. */
const rotationHandleDraw = 'i==="rotation"?Ta(e,l+c/2,s+m/2,c/2):';
const rotationHandleSilent = 'i==="rotation"?void 0:';

/** Hides Excalidraw's own rotation grip: this plugin draws a better one in its place. */
export const hideNativeRotationGrip = {
  name: "hide-native-rotation-grip",
  setup(build) {
    build.onLoad({ filter: /excalidraw[\\/]dist[\\/]prod[\\/]index\.js$/ }, async (args) => {
      const contents = await readFile(args.path, "utf8");
      if (!contents.includes(rotationHandleDraw)) {
        throw new Error("Excalidraw's rotation grip was not found: the patch that hides it must be rewritten.");
      }
      return { contents: contents.replace(rotationHandleDraw, rotationHandleSilent), loader: "js" };
    });
  }
};
