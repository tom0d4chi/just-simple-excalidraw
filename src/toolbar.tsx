import {
  createElement,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent
} from "react";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import { anyCapability, capabilitiesForTool, type Capabilities } from "./capabilities";
import { Icon, type IconName } from "./icons";
import { AppearanceValues, familiesFor, type Category, type Family, type StylePatch, type StyleState } from "./appearance";
import { t } from "./i18n";
import { haptic } from "./haptics";
import { MENU_MOTION_VARS, menuDelay } from "./motion";

type ToolName = "hand" | "selection" | "rectangle" | "diamond" | "ellipse" | "arrow" | "line" | "freedraw" | "text" | "image" | "eraser";

interface ToolDefinition {
  tool: ToolName;
  icon: IconName;
  label: string;
}

const TOOL_DEFINITIONS: Record<ToolName, ToolDefinition> = {
  hand: { tool: "hand", icon: "hand", label: t("hand") },
  selection: { tool: "selection", icon: "square-dashed-mouse-pointer", label: t("selection") },
  freedraw: { tool: "freedraw", icon: "pencil", label: t("freedraw") },
  eraser: { tool: "eraser", icon: "eraser", label: t("eraser") },
  rectangle: { tool: "rectangle", icon: "square", label: t("rectangle") },
  diamond: { tool: "diamond", icon: "diamond", label: t("diamond") },
  ellipse: { tool: "ellipse", icon: "circle", label: t("ellipse") },
  arrow: { tool: "arrow", icon: "arrow-up-right", label: t("arrow") },
  line: { tool: "line", icon: "minus", label: t("line") },
  text: { tool: "text", icon: "type", label: t("text") },
  image: { tool: "image", icon: "image", label: t("image") }
};

/*
 * Touch has no need for a hand tool: one finger always acts with the current
 * tool, two fingers pan and pinch-zoom (Excalidraw's own multi-touch gesture,
 * like every drawing app on a phone). So the column keeps only what a phone
 * actually reaches for; the rest waits behind one button instead of holding a
 * permanent slot under the thumb.
 */
/* The shape family shares one slot: a button that opens the list on the spot. */
const SHAPES: readonly ToolName[] = ["rectangle", "diamond", "ellipse", "arrow", "line"];
const TOUCH_CORE: readonly ToolName[] = ["selection", "freedraw", "text", "eraser"];

const DESKTOP_TOOLS: readonly ToolName[] = [
  "hand", "selection", "freedraw", "eraser", "rectangle", "diamond", "ellipse", "arrow", "line", "text", "image"
];

interface CanvasToolbarProps {
  api: ExcalidrawImperativeAPI | null;
  activeTool: string;
  locked: boolean;
  style: StyleState;
  selectionCount: number;
  textSelected: boolean;
  /** What the current selection (or tool) can actually be styled with. */
  capabilities: Capabilities;
  /** True when a shape or an image sits under the column: it then needs a backing. */
  contentUnder?: boolean;
  /** Dark sheet: the ink has to go light. */
  dark?: boolean;
  onMenusToggled?: () => void;
  selectionArmed: boolean;
  onToggleSelection: () => void;
  canRedo: boolean;
  canUndo: boolean;
  isTouchDevice: boolean;
  getCanvasElement: () => HTMLElement | null;
}

/**
 * Excalidraw refuses to arm its image tool from code (it inserts through its own
 * file dialog), so pick the file here and insert the element ourselves.
 */
function readImageFile(file: File): Promise<{ dataURL: string; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error("read error"));
    reader.onload = () => {
      const dataURL = String(reader.result);
      const image = new Image();
      image.onload = () => resolve({ dataURL, width: image.naturalWidth, height: image.naturalHeight });
      image.onerror = () => reject(new Error("decode error"));
      image.src = dataURL;
    };
    reader.readAsDataURL(file);
  });
}

/** Lucide glyph rendered with Obsidian's own `.svg-icon` sizing rules. */
/**
 * Excalidraw renders its own buttons for these actions (in the bar this plugin
 * hides). Clicking them is exact — it runs the same handler, with the same
 * history entry — where a synthesized key press has to guess at modifiers.
 */
export function pressExcalidrawButton(selector: string): boolean {
  if (typeof document?.querySelector !== "function") {
    return false;
  }
  const button = document.querySelector<HTMLButtonElement>(selector);
  if (!button || button.disabled) {
    return false;
  }
  button.click();
  return true;
}

function isEditableTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && (
    target.isContentEditable ||
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.tagName === "SELECT"
  );
}

/**
 * Excalidraw exposes `history.clear()` but no undo/redo in its public API, so
 * reuse its own keyboard shortcuts by replaying the key press on its container.
 */
export function replayShortcut(
  getCanvasElement: () => HTMLElement | null,
  key: string,
  shiftKey = false,
  withCtrl = true,
  keyCode?: number,
  codeName?: string
): void {
  const canvas = getCanvasElement();
  if (!canvas || isEditableTarget(document.activeElement)) {
    return;
  }
  const code = keyCode ?? key.toUpperCase().charCodeAt(0);
  canvas.dispatchEvent(new KeyboardEvent("keydown", {
    key,
    code: codeName ?? `Key${key.toUpperCase()}`,
    keyCode: code,
    which: code,
    ctrlKey: withCtrl,
    metaKey: true,
    shiftKey,
    bubbles: true,
    cancelable: true
  }));
}

export function CanvasToolbar({
  api,
  activeTool,
  locked,
  style,
  selectionCount,
  textSelected,
  capabilities,
  contentUnder = false,
  dark = false,
  onMenusToggled = () => {},
  selectionArmed,
  onToggleSelection,
  canRedo,
  canUndo,
  isTouchDevice,
  getCanvasElement
}: CanvasToolbarProps) {
  const [shapeMenuOpen, setShapeMenuOpen] = useState(false);
  /*
   * The strip mounts closed, and its exit animation starts from a visible state. Leaving a
   * selection remounts the tools, so an unopened strip would play that exit from opacity 1 — a
   * flash in front of the canvas. It only earns the animation once it has been opened.
   */
  const [shapeMenuAnimated, setShapeMenuAnimated] = useState(false);
  /* The property whose values are open beside the column, and where its button sits. */
  const [openFamily, setOpenFamily] = useState<Category | null>(null);
  const [familyTop, setFamilyTop] = useState(0);
  // "Keep the tool" is a preference of the column, not a property of Excalidraw's
  // current tool: it can be armed before choosing a shape, and it then applies to
  // whatever is picked next.
  const [keepTool, setKeepTool] = useState(locked);
  const keepToolRef = useRef(locked);

  const [entered, setEntered] = useState(false);
  /*
   * The two layers slide past each other, and a sliding layer leaves the frame while it moves.
   * Clipping is only switched on for the length of the swap: the shape strip lives inside the same
   * box and must never be cut, and it is always closed by the time a swap starts.
   */
  const [clipping, setClipping] = useState(false);
  /*
   * Options for the tool that is about to draw, not for something selected. The pen has no
   * selection to hang its colour on, so the column can also be opened by the tool itself: the first
   * row of that column is the tool, lit, and touching it comes back to the tools.
   */
  const [toolOptions, setToolOptions] = useState(false);
  /*
   * The column holds two layers at once — the tools and the properties of a selection — and
   * always both, so the frame is the taller of the two and never moves when the content swaps.
   * Only opacity and a short slide change, in opposite directions: the set that goes fades
   * towards the left edge, the one that arrives comes in from the right.
   */
  const [lastShape, setLastShape] = useState<ToolName>("rectangle");
  const activeShape = SHAPES.includes(activeTool as ToolName) ? (activeTool as ToolName) : null;

  /*
   * The active tool's backing is one disc that travels from button to button, not a
   * grey circle that fades in under the new tool while the old one fades out. It is
   * measured from the button itself with `offsetTop/offsetLeft`, which no transform
   * touches: a rect read during the press (`scale(0.92)`) or during the column's
   * entrance would land a few pixels off.
   */
  const pillRef = useRef<HTMLDivElement | null>(null);
  const toolsLayerRef = useRef<HTMLDivElement | null>(null);
  const penRef = useRef<HTMLButtonElement | null>(null);
  const textRef = useRef<HTMLButtonElement | null>(null);
  const travelledTextRef = useRef(false);
  const propsLayerRef = useRef<HTMLDivElement | null>(null);
  const glideRef = useRef<HTMLDivElement | null>(null);
  const glideReadyRef = useRef(false);
  const [glideReady, setGlideReady] = useState(false);

  const measureGlideRef = useRef<() => void>(() => {});
  measureGlideRef.current = (): void => {
    const pill = pillRef.current;
    const glide = glideRef.current;
    if (!pill || !glide || typeof pill.querySelectorAll !== "function") {
      return;
    }

    // The popovers live inside the pill too, and their items carry `is-active` as
    // well: only a button that is a tool of the column can own the disc.
    // Only the layer that is showing can own the disc: the other one holds a copy of the same
    // buttons, and the disc would land on one nobody can see.
    const scope = propertiesMode ? ".jse-tools__layer--props" : ".jse-tools__layer--tools";
    const candidates = Array.prototype.slice.call(
      pill.querySelectorAll(`${scope} .jse-tool.is-active`)
    ) as HTMLElement[];
    // The pen lives outside the layers (it travels between them), so it is looked up first.
    const pen = pill.querySelector<HTMLElement>(".jse-tools__pen.is-active")
      ?? pill.querySelector<HTMLElement>(".jse-tools__text.is-active");
    const target = pen ?? candidates.find((button) => button.closest(".jse-shapes__menu") === null) ?? null;

    /*
     * Nothing lit: the disc fades out where it stands. Re-placing it at 0,0 here was the bug —
     * the next tool then looked like it was arriving from the top of the column.
     */
    if (!target) {
      glide.dataset.empty = "true";
      return;
    }

    let x = 0;
    let y = 0;
    if (target === pen) {
      // The pen is placed with `left: 50%` and a centring translate, so its offsets say nothing
      // about where it is drawn: its box does.
      const pillRect = pill.getBoundingClientRect();
      const penRect = pen.getBoundingClientRect();
      const border = parseFloat(getComputedStyle(pill).borderTopWidth) || 0;
      x = penRect.left - pillRect.left - border;
      y = penRect.top - pillRect.top - border;
    } else {
      let node: HTMLElement | null = target;
      while (node && node !== pill) {
        x += node.offsetLeft;
        y += node.offsetTop;
        node = node.offsetParent as HTMLElement | null;
      }
    }

    /*
     * Coming back from a blank column is an appearance, not a move: the disc is placed on the
     * tapped tool with the travel switched off for that one frame, so it does not glide in from
     * wherever it was last. Between two tools it travels, which is the case the travel is for.
     */
    const appearing = glide.dataset.empty !== "false";
    if (appearing) {
      glide.classList.add("is-placing");
    }
    glide.style.setProperty("--jse-glide-x", `${x}px`);
    glide.style.setProperty("--jse-glide-y", `${y}px`);
    glide.dataset.empty = "false";
    if (appearing) {
      // Read a layout value: without it the class is removed before the new position is painted,
      // and the travel runs after all.
      void glide.offsetWidth;
      glide.classList.remove("is-placing");
    }

    if (!glideReadyRef.current) {
      glideReadyRef.current = true;
      setGlideReady(true);
    }
  };

  /*
   * The appearance menu is worth showing whenever a pick has somewhere to go: with
   * a selection it restyles it, with a drawing tool it sets what the next stroke
   * will look like — that is how the pen gets its thickness.
   */
  const stylingTarget = anyCapability(capabilities);

  /*
   * Every button that changes what a finger does is a switch, not a one-way trap:
   * pressing the tool that is already active gives the sheet back to the hand.
   */
  const selectTool = (tool: ToolName) => (event: ReactMouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (!api) {
      return;
    }
    const current = api.getAppState().activeTool.type;
    if (current === tool) {
      // First touch closes the options, the second puts the tool down, as it always did.
      if (toolOptions) {
        setToolOptions(false);
        return;
      }
      api.setActiveTool({ type: "hand", locked: false });
      return;
    }
    api.setActiveTool({ type: tool, locked: keepToolRef.current });
    // A tool that can be styled opens its own page straight away.
    if (isTouchDevice && familiesFor(style, capabilitiesForTool(tool)).length > 0) {
      setToolOptions(true);
    }
  };

  const insertImage = (event: ReactMouseEvent<HTMLButtonElement>): void => {
    event.preventDefault();
    event.stopPropagation();
    const instance = api;
    if (!instance) {
      return;
    }
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.id = "jse-image-input";
    input.style.display = "none";
    document.body.appendChild(input);
    input.addEventListener("change", () => {
      const file = input.files?.[0];
      input.remove();
      if (!file) {
        return;
      }
      void readImageFile(file).then(({ dataURL, width, height }) => {
        const stamp = Date.now();
        const fileId = `jse-${stamp}-${Math.round(Math.random() * 1e6)}`;
        instance.addFiles([{
          id: fileId,
          dataURL,
          mimeType: file.type || "image/png",
          created: stamp
        } as never]);
        const appState = instance.getAppState();
        const limit = Math.min(appState.width * 0.7, width);
        const scale = limit / width;
        const w = Math.round(width * scale);
        const h = Math.round(height * scale);
        const element = {
          id: `jse-${stamp}-${Math.round(Math.random() * 1e6)}`,
          type: "image",
          x: -appState.scrollX + (appState.width - w) / 2,
          y: -appState.scrollY + (appState.height - h) / 2,
          width: w,
          height: h,
          angle: 0,
          strokeColor: "transparent",
          backgroundColor: "transparent",
          fillStyle: "solid",
          strokeWidth: 1,
          strokeStyle: "solid",
          roughness: 1,
          opacity: 100,
          groupIds: [],
          frameId: null,
          roundness: null,
          seed: Math.floor(Math.random() * 1e9),
          version: 1,
          versionNonce: Math.floor(Math.random() * 1e9),
          isDeleted: false,
          boundElements: null,
          updated: stamp,
          link: null,
          locked: false,
          status: "saved",
          fileId,
          scale: [1, 1]
        };
        instance.updateScene({
          elements: [...instance.getSceneElements(), element as never],
          appState: { selectedElementIds: { [element.id]: true } },
          // An insertion is an edit: one step, with the selection it leaves behind.
          captureUpdate: "IMMEDIATELY" as never
        });
      });
    }, { once: true });
    input.click();
  };

  const pickShape = (tool: ToolName) => (event: ReactMouseEvent<HTMLButtonElement>): void => {
    selectTool(tool)(event);
    setLastShape(tool);
    setShapeMenuOpen(false);
  };

  const toggleLock = (event: ReactMouseEvent<HTMLButtonElement>): void => {
    event.preventDefault();
    event.stopPropagation();
    const next = !keepToolRef.current;
    keepToolRef.current = next;
    setKeepTool(next);
    const current = api?.getAppState().activeTool.type;
    // Armed before a tool is chosen: it simply applies to the next pick.
    if (api && current && current !== "hand" && current !== "selection") {
      api.setActiveTool({ type: current as ToolName, locked: next });
    }
  };

  const toggleShapeMenu = (event: ReactMouseEvent<HTMLButtonElement>): void => {
    onMenusToggled();
    event.preventDefault();
    event.stopPropagation();
    setShapeMenuOpen((value) => !value);
    setShapeMenuAnimated(true);
  };

  /*
   * A property button opens the values of its family beside the column, centred on itself: its
   * own offsetTop is the whole anchor, read at press time before any transform is applied.
   */
  const toggleFamily = (key: Category) => (event: ReactMouseEvent<HTMLButtonElement>): void => {
    event.preventDefault();
    event.stopPropagation();
    const button = event.currentTarget;
    setFamilyTop(button.offsetTop + button.offsetHeight / 2);
    setOpenFamily((current) => (current === key ? null : key));
    onMenusToggled();
  };

  /*
   * Excalidraw applies a style to the selection itself when its own panel is
   * used; through the API the elements have to be written, with a new version so
   * the change is a real edit and lands in the history.
   */
  const applyStyle = (patch: StylePatch): void => {
    // Never write a property the kind of element cannot show: a line has no fill.
    const allowed: StylePatch = { ...patch };
    if (!capabilities.fill) {
      delete allowed.backgroundColor;
      delete allowed.fillStyle;
    }
    if (!capabilities.stroke) {
      delete allowed.strokeColor;
    }
    if (!capabilities.width) {
      delete allowed.strokeWidth;
    }
    if (!capabilities.style) {
      delete allowed.strokeStyle;
    }
    if (!capabilities.corners) {
      delete allowed.roundness;
    }
    if (!capabilities.text) {
      delete allowed.fontSize;
    }
    patch = allowed;
    if (!api) {
      return;
    }
    const appState = api.getAppState();
    const selected = new Set(Object.keys(appState.selectedElementIds ?? {}));
    const stamp = Date.now();
    const elements = api.getSceneElements().map((element) => {
      if (!selected.has(element.id) || element.isDeleted) {
        return element;
      }
      const next = {
        ...element,
        ...patch,
        version: element.version + 1,
        versionNonce: Math.floor(Math.random() * 1e9),
        updated: stamp
      };
      if (patch.roundness !== undefined) {
        next.roundness = patch.roundness === null ? null : ({ type: patch.roundness } as never);
      }
      return next;
    });
    const nextState: Record<string, unknown> = {};
    if (patch.strokeColor !== undefined) nextState.currentItemStrokeColor = patch.strokeColor;
    if (patch.backgroundColor !== undefined) nextState.currentItemBackgroundColor = patch.backgroundColor;
    if (patch.strokeWidth !== undefined) nextState.currentItemStrokeWidth = patch.strokeWidth;
    if (patch.strokeStyle !== undefined) nextState.currentItemStrokeStyle = patch.strokeStyle;
    if (patch.fillStyle !== undefined) nextState.currentItemFillStyle = patch.fillStyle;
    if (patch.fontSize !== undefined) nextState.currentItemFontSize = patch.fontSize;
    api.updateScene({
      elements: elements as never,
      appState: nextState as never,
      captureUpdate: "IMMEDIATELY" as never
    });
  };

  useEffect(() => {
    const frame = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  // A mode change closes whatever was open for the previous one.
  useEffect(() => {
    setShapeMenuOpen(false);
    setOpenFamily(null);
  }, [activeTool]);

  // Nothing selected: the properties go with the selection.
  useEffect(() => {
    if (!stylingTarget || selectionCount === 0) {
      setOpenFamily(null);
    }
  }, [stylingTarget, selectionCount]);

  useEffect(() => {
    if (!shapeMenuOpen && !openFamily) {
      return;
    }
    const onOutside = (event: PointerEvent): void => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) {
        return;
      }
      if (!target.closest(".jse-shapes")) {
        setShapeMenuOpen(false);
      }
      if (!target.closest(".jse-appearance-values")) {
        setOpenFamily(null);
      }
    };
    document.addEventListener("pointerdown", onOutside, true);
    return () => document.removeEventListener("pointerdown", onOutside, true);
  }, [shapeMenuOpen, openFamily]);

  /*
   * Every control in the column answers the finger, on press rather than on release: a tap that is
   * held can still be abandoned, and the confirmation belongs at the moment of contact.
   */
  useEffect(() => {
    const onPress = (event: PointerEvent): void => {
      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }
      /*
       * Every real control: the column's buttons, the shape strip, and anything the appearance bar
       * renders (chips, swatches, the shape grid) - all of them are <button> under that bar.
       */
      if (target.closest(".jse-tools__pen, .jse-tools__text")) {
        // handled by the button itself
        return;
      }
      if (target.closest(".jse-tool, .jse-shapes__item, .jse-appearance-values button")) {
        haptic("light");
      }
    };
    document.addEventListener("pointerdown", onPress, true);
    return () => document.removeEventListener("pointerdown", onPress, true);
  }, []);

  /*
   * Placed on every commit (a tool switch, a group folding in or out, a locale
   * change all move the button), and again on every size the column takes while it
   * animates its height.
   */
  useEffect(() => {
    measureGlideRef.current();
  });

  useEffect(() => {
    const pill = pillRef.current;
    if (!pill || typeof ResizeObserver === "undefined") {
      return;
    }
    const observer = new ResizeObserver(() => measureGlideRef.current());
    observer.observe(pill);
    return () => observer.disconnect();
  }, []);

  const toolButton = (
    { tool, icon, label }: ToolDefinition,
    onClick = selectTool,
    activeOverride?: boolean
  ) => {
    const active = activeOverride ?? activeTool === tool;
    return createElement("button", {
      key: tool,
      type: "button",
      className: `jse-tool clickable-icon${active ? " is-active" : ""}`,
      "aria-label": label,
      "aria-pressed": active,
      onClick: onClick(tool)
    }, createElement(Icon, { name: icon }));
  };

  const actionButton = (
    key: string,
    icon: IconName,
    label: string,
    onClick: (event: ReactMouseEvent<HTMLButtonElement>) => void,
    active = false,
    disabled = false,
    variant = ""
  ) => createElement("button", {
    key,
    type: "button",
    className: `jse-tool jse-tool--action clickable-icon${variant ? ` ${variant}` : ""}${active ? " is-active" : ""}${disabled ? " is-disabled" : ""}`,
    "aria-label": label,
    "aria-pressed": active,
    "aria-disabled": disabled,
    onClick: disabled ? undefined : onClick
  }, createElement(Icon, { name: icon }));

  /*
   * Actions that only exist while something is selected. They take their place
   * at the head of the column, next to the selection tool that produced them.
   */
  const stopAndRun = (event: ReactMouseEvent<HTMLButtonElement>, run: () => void): void => {
    event.preventDefault();
    event.stopPropagation();
    run();
  };

  /*
   * These actions live in the properties layer, which arrives as a fade. Growing their slot as
   * well would be a second animation in the same moment, so they are mounted at their final size
   * and the layer's fade is the only thing that moves.
   */
  const hasSelection = selectionCount > 0;
  /*
   * The pen only travels to a page that is about the pen; another tool's page keeps it in the tools.
   * Away means the pen is not part of the column at all (a selection, or another tool's page).
   */
  /*
   * The text tool travels exactly like the pen, with its own button: the two are independent, so a
   * change to one cannot alter the other's timing, slot or disc.
   */
  const textAtTop = !hasSelection && toolOptions && activeTool === "text";
  const textAway = hasSelection || (toolOptions && !textAtTop);
  const penAtTop = !hasSelection && toolOptions && activeTool === "freedraw";
  const penAway = hasSelection || (toolOptions && !penAtTop);
  const propertiesMode = isTouchDevice && ((stylingTarget && hasSelection) || toolOptions);
  /*
   * The props page keeps the pen's row for as long as it is fading out. Without it the row vanishes the
   * instant the tool is left, and every colour and weight below it is thrown to the top of the column
   * while the page is still on screen - the jump that made leaving the pen look broken.
   */
  const propsFrozenRef = useRef<ReturnType<typeof createElement>[] | null>(null);


  /*
   * What the properties layer last showed, kept while it leaves. Without this, deselecting empties
   * `families` (nothing selected, nothing to style) in the same frame that starts the exit, and the
   * buttons are gone before the fade can be seen: they vanish at once instead of sliding right.
   */
  const shownRef = useRef<null | {
    families: Family[];
    style: StyleState;
    textSelected: boolean;
    hasSelection: boolean;
  }>(null);
  // The pen's and the text tool's pages have no fill family, so the stroke shows its colour directly.
  const families = familiesFor(style, capabilities, { filledStroke: !hasSelection });
  if (propertiesMode) {
    shownRef.current = {
      families,
      style,
      textSelected,
      hasSelection: selectionCount > 0
    };
  }
  const shown = shownRef.current;
  const shownFamilies = propertiesMode || !shown ? families : shown.families;
  const shownStyle = propertiesMode || !shown ? style : shown.style;
  const shownTextSelected = propertiesMode || !shown ? textSelected : shown.textSelected;
  const shownHasSelection = propertiesMode || !shown ? selectionCount > 0 : shown.hasSelection;

  /*
   * The frame is exactly as tall as the layer that is showing, and that height is a number written
   * on the pill so the stylesheet can transition it: the column grows and shrinks like a menu
   * opening instead of snapping when the number of buttons changes.
   */
  useEffect(() => {
    /*
     * Only when the frame is drawn. Without a plate behind it the frame is invisible, and cutting
     * the outgoing column on a boundary nobody can see is how that boundary becomes visible: the
     * icons stop dead in mid-air. With the plate, the cut lands exactly on it.
     */
    if (!entered || !contentUnder) {
      return;
    }
    setClipping(true);
    const done = window.setTimeout(() => setClipping(false), 260);
    return () => window.clearTimeout(done);
  }, [propertiesMode, entered, contentUnder]);

  // A selection has its own properties; the tool's page is not needed while it lasts.
  useEffect(() => {
    if (hasSelection) {
      setToolOptions(false);
    }
  }, [hasSelection]);

  /*
   * Where the pen belongs right now: its slot in the tools, or the empty first row of its own page.
   * Measured, not computed from indices, because the frame changes height and its content is
   * centred in it.
   */
  const applyHeightRef = useRef<() => void>(() => {});

  useLayoutEffect(() => {
    const pill = pillRef.current;
    const pen = penRef.current;
    if (!pill || !pen) {
      return;
    }
    // Leaving, it keeps the offset it had: updating it here would slide the pen vertically towards
    // the row of the other column while it fades, which is the drift this placement exists to avoid.
    if (penAway) {
      return;
    }
    const scope = penAtTop ? ".jse-tools__layer--props" : ".jse-tools__layer--tools";
    const layer = propertiesMode ? propsLayerRef.current : toolsLayerRef.current;
    const slot = pill.querySelector<HTMLElement>(`${scope} .jse-tools__pen-slot`);
    if (!slot || !layer) {
      return;
    }
    /*
     * The offset is the distance between the pen's row and the middle of the frame, in the layout
     * the change is heading to. It comes from the rows themselves (their offsetHeight ignores the
     * height animation and the entrance scale), so it is right before the frame has finished
     * resizing - which is exactly what removes the vertical drift: the middle of the frame does not
     * move, the top edge does.
     */
    /*
     * The slot's own offset, read from the layout: it does not move while the frame's height
     * animates, and it does not depend on that height either. The old sum of rows was converted
     * into a distance from the middle of the frame, which meant the button's position was a
     * function of the frame's height - and drifted with it while it faded.
     */
    const y = slot.offsetTop + (slot.offsetHeight - pen.offsetHeight) / 2;
    pen.style.setProperty("--pen-y", `${y}px`);

    /*
     * The disc under the pen has to travel with it. Measured once, it lands where the pen was and
     * walks the rest of the way on its own: that is the second disc seen arriving from below. With
     * its transition off for the length of the move, it is re-measured on every frame instead.
     */
    const glide = glideRef.current;
    if (!glide || activeTool !== "freedraw") {
      return;
    }
    glide.classList.add("is-placing");
    let frame = 0;
    const started = Date.now();
    const follow = (): void => {
      measureGlideRef.current();
      if (Date.now() - started < 320) {
        frame = requestAnimationFrame(follow);
      } else {
        glide.classList.remove("is-placing");
      }
    };
    frame = requestAnimationFrame(follow);
    return () => {
      cancelAnimationFrame(frame);
      glide.classList.remove("is-placing");
    };
    // penAtTop is what decides which slot the pen belongs to: leaving it out left the pen on the
    // tools row when the page opened from another tool's page, where nothing else had changed.
  }, [propertiesMode, hasSelection, toolOptions, penAtTop, shownFamilies.length]);

  /*
   * The text button's own placement. Duplicated from the pen on purpose: the two must be able to
   * change without touching each other, and this is the part where a shared implementation would
   * couple them.
   */
  useLayoutEffect(() => {
    const pill = pillRef.current;
    const text = textRef.current;
    if (!pill || !text) {
      return;
    }
    if (!travelledTextRef.current && activeTool === "text") {
      text.classList.add("no-fade");
      void text.offsetHeight;
      requestAnimationFrame(() => text.classList.remove("no-fade"));
    }
    travelledTextRef.current = activeTool === "text";

    if (textAway) {
      return;
    }
    const scope = textAtTop ? ".jse-tools__layer--props" : ".jse-tools__layer--tools";
    const layer = propertiesMode ? propsLayerRef.current : toolsLayerRef.current;
    const slot = pill.querySelector<HTMLElement>(`${scope} .jse-tools__text-slot`);
    if (!slot || !layer) {
      return;
    }
    const y = slot.offsetTop + (slot.offsetHeight - text.offsetHeight) / 2;
    text.style.setProperty("--text-y", `${y}px`);

    const glide = glideRef.current;
    if (!glide || activeTool !== "text") {
      return;
    }
    glide.classList.add("is-placing");
    let frame = 0;
    const started = Date.now();
    const follow = (): void => {
      measureGlideRef.current();
      if (Date.now() - started < 320) {
        frame = requestAnimationFrame(follow);
      } else {
        glide.classList.remove("is-placing");
      }
    };
    frame = requestAnimationFrame(follow);
    return () => {
      cancelAnimationFrame(frame);
      glide.classList.remove("is-placing");
    };
  }, [propertiesMode, hasSelection, toolOptions, activeTool, textAtTop, shownFamilies.length]);

  const applyHeight = (): void => {
    const pill = pillRef.current;
    const layer = propertiesMode ? propsLayerRef.current : toolsLayerRef.current;
    if (!pill || !layer) {
      return;
    }
    const styles = getComputedStyle(pill);
    const pad = parseFloat(styles.paddingTop) || 0;
    const border = parseFloat(styles.borderTopWidth) || 0;
    // The layer fills the pill, so its own height says nothing about its content: the buttons do.
    const content = Array.prototype.slice.call(layer.children).reduce((sum: number, child: HTMLElement) => {
      const childStyles = getComputedStyle(child);
      const margins = (parseFloat(childStyles.marginTop) || 0) + (parseFloat(childStyles.marginBottom) || 0);
      // offsetHeight, not the rect: the column is scaled while it animates in, and a rect would
      // report the scaled size.
      return sum + child.offsetHeight + margins;
    }, 0);
    const wanted = content + (pad + border) * 2;
    /*
     * A short screen - a phone on its side - must not push the last buttons off the edge. The column
     * stops where the undo bar begins and scrolls the rest: at 44 px a target is already as small as
     * a finger allows, so the screen is what gives way.
     */
    const band = pill.parentElement;
    const history = band ? band.querySelector<HTMLElement>(":scope > .jse-tools__history") : null;
    const gap = parseFloat(styles.getPropertyValue("--jse-nav-gap")) || 8;
    const top = pill.getBoundingClientRect().top;
    const available = window.innerHeight - top - (history?.offsetHeight ?? 0) - gap * 2;
    const capped = available > 44 && wanted > available;
    pill.style.height = `${capped ? Math.floor(available) : wanted}px`;
    pill.classList.toggle("is-scroll", capped);
  };
  applyHeightRef.current = applyHeight;

  /* Turning the phone is a new amount of screen, so the column is measured again. */
  useEffect(() => {
    const onResize = (): void => applyHeightRef.current?.();
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
    };
  }, []);

  useLayoutEffect(() => {
    applyHeight();
    /*
     * On the first paint the stylesheet may not have been applied yet, and the buttons then have no
     * margins: the frame would be a few pixels short until something else changed. One frame later
     * the real layout exists, so it is measured again.
     */
    const later = requestAnimationFrame(() => applyHeight());
    // The stylesheet of the host can land after the first paint too; one late pass settles it.
    const late = window.setTimeout(applyHeight, 120);
    return () => {
      cancelAnimationFrame(later);
      window.clearTimeout(late);
    };
    // The undo bar appearing or going away changes how much screen the column may take.
  }, [propertiesMode, shownFamilies.length, shownHasSelection, canUndo, canRedo]);
  /*
   * Always mounted, never conditional: the properties layer has to keep its height while it is
   * hidden, or the column would grow the moment something is selected.
   */

  const contextClass = (available: boolean): string =>
    `jse-tool--context jse-tool--collapsible${available ? "" : " is-collapsed"}`;
  const contextButtons = [
    actionButton("edit-text", "square-pen", t("editText"), (event) =>
      stopAndRun(event, () => {
        // Enter on a selected text element opens its editor. Excalidraw's own
        // "Edit" button in the hidden bar is enabled but does nothing when
        // clicked from here, so it is not used.
        replayShortcut(getCanvasElement, "Enter", false, false, 13, "Enter");
      }), false, false, contextClass(shownTextSelected)),
    actionButton("duplicate", "copy", t("duplicate"), (event) =>
      stopAndRun(event, () => {
        if (!pressExcalidrawButton('.App-bottom-bar button[aria-label="Duplicate"]')) {
          replayShortcut(getCanvasElement, "d", false, true, 68, "KeyD");
        }
      }), false, false, contextClass(shownHasSelection)),
    actionButton("delete", "trash-2", t("remove"), (event) =>
      stopAndRun(event, () => {
        if (!pressExcalidrawButton('.App-bottom-bar button[aria-label="Delete"]')) {
          replayShortcut(getCanvasElement, "Delete", false, false, 46, "Delete");
        }
      }), false, false, contextClass(shownHasSelection))
  ];

  const lockButton = actionButton(
    "lock",
    locked ? "lock" : "lock-open",
    locked ? t("unlockTool") : t("lockTool"),
    toggleLock,
    locked
  );

  // While the slider moves, only the default changes: rewriting the selection on
  // every pixel would fill the history with intermediate widths.
  const previewStyle = (patch: StylePatch): void => {
    if (!api || patch.strokeWidth === undefined) {
      return;
    }
    api.updateScene({
      appState: { currentItemStrokeWidth: patch.strokeWidth } as never,
      // What the next stroke will look like, not what the drawing is.
      captureUpdate: "NEVER" as never
    });
  };

  /*
   * With something selected the column stops being a box of drawing tools and becomes the
   * properties of what is selected: one button per family, each painted with the value it holds.
   * Nothing selected, nothing to style: the tools come back.
   */
  /*
   * The pen is not re-created on the other side: the same button moves to the top of the column when
   * its page opens, and back down when it closes. Each layer keeps an empty slot the size of a
   * button where the pen belongs, so the rest of the column is laid out around it.
   */
  const penElement = createElement("button", {
    key: "pen",
    type: "button",
    ref: penRef,
    className: `jse-tool jse-tool--action clickable-icon jse-tools__pen${activeTool === "freedraw" ? " is-active" : ""}${penAway ? " is-away" : ""}`,
    "aria-label": TOOL_DEFINITIONS.freedraw.label,
    "aria-pressed": activeTool === "freedraw",
    /*
     * These two answer through their own handler. They are the buttons that move when they are
     * pressed, and the delegated listener never reached them on the device - so the confirmation is
     * wired where the press is actually delivered.
     */
    onPointerDown: () => haptic("light"),
    onClick: (event: ReactMouseEvent<HTMLButtonElement>) => {
      event.preventDefault();
      event.stopPropagation();
      if (!api) {
        return;
      }
      if (penAtTop) {
        // Tapping the pen on its own page puts the tool down, which is the way back to the tools.
        setToolOptions(false);
        api.setActiveTool({ type: "hand", locked: false });
        return;
      }
      selectTool("freedraw")(event);
    }
  }, createElement(Icon, { name: "pencil" }));

  const penSlot = (where: string) => createElement("div", {
    key: `pen-slot-${where}`,
    className: "jse-tools__pen-slot",
    "aria-hidden": true
  });

  const textTraveller = createElement("button", {
    key: "text-traveller",
    type: "button",
    ref: textRef,
    className: `jse-tool jse-tool--action clickable-icon jse-tools__text${activeTool === "text" ? " is-active" : ""}${textAway ? " is-away" : ""}`,
    "aria-label": TOOL_DEFINITIONS.text.label,
    "aria-pressed": activeTool === "text",
    onPointerDown: () => haptic("light"),
    onClick: (event: ReactMouseEvent<HTMLButtonElement>) => {
      event.preventDefault();
      event.stopPropagation();
      if (!api) {
        return;
      }
      if (textAtTop) {
        setToolOptions(false);
        api.setActiveTool({ type: "hand", locked: false });
        return;
      }
      selectTool("text")(event);
    }
  }, createElement(Icon, { name: TOOL_DEFINITIONS.text.icon }));

  const textSlot = (where: string) => createElement("div", {
    key: `text-slot-${where}`,
    className: "jse-tools__text-slot",
    "aria-hidden": true
  });

  // Other tools keep the plain row: only the pen is worth a button that travels.
  const toolRow = !hasSelection && toolOptions && activeTool !== "freedraw" && activeTool !== "text"
    ? createElement("button", {
        key: "tool-exit",
        type: "button",
        className: "jse-tool jse-tool--action clickable-icon is-active",
        "aria-label": TOOL_DEFINITIONS[activeTool as ToolName]?.label ?? t("freedraw"),
        "aria-pressed": true,
        onClick: (event: ReactMouseEvent<HTMLButtonElement>) => {
          event.preventDefault();
          event.stopPropagation();
          setToolOptions(false);
        }
      }, createElement(Icon, { name: TOOL_DEFINITIONS[activeTool as ToolName]?.icon ?? "pencil" }))
    : null;

  const propertyButtons = shownFamilies.map((family) => createElement("button", {
        key: family.key,
        type: "button",
        className: `jse-tool jse-tool--action clickable-icon${openFamily === family.key ? " is-open" : ""}`,
        "aria-label": family.label,
        "aria-expanded": openFamily === family.key,
        "aria-pressed": openFamily === family.key,
        onClick: toggleFamily(family.key)
      }, family.content));

  // Reversed, so the strip reads from the button outwards: the shape next to the
  // button is the first one, and the first to land.
  const shapeOrder = [...SHAPES].reverse();

  const shapeButton = createElement("div", { className: "jse-shapes", key: "shapes" },
    createElement("button", {
      type: "button",
      className: `jse-tool clickable-icon${activeShape ? " is-active" : ""}${shapeMenuOpen ? " is-open" : ""}`,
      "aria-label": t("shapes"),
      "aria-expanded": shapeMenuOpen,
      "aria-pressed": Boolean(activeShape),
      onClick: toggleShapeMenu
    }, createElement(Icon, { name: TOOL_DEFINITIONS[activeShape ?? lastShape].icon })),
    createElement("div", {
        className: `jse-shapes__menu${entered && shapeMenuAnimated ? " jse-anim" : ""}${shapeMenuOpen ? "" : " is-closed"}`,
        role: "menu",
        "aria-hidden": !shapeMenuOpen,
        onPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => event.stopPropagation()
      },
      shapeOrder.map((tool, index) => createElement("button", {
        key: tool,
        type: "button",
        role: "menuitem",
        className: `jse-tool clickable-icon jse-tool--shape jse-shapes__item${shapeMenuOpen ? " is-entering" : ""}${activeTool === tool ? " is-active" : ""}`,
        style: { animationDelay: menuDelay(index, shapeOrder.length) },
        "aria-label": TOOL_DEFINITIONS[tool].label,
        "aria-pressed": activeTool === tool,
        onClick: pickShape(tool)
      }, createElement(Icon, { name: TOOL_DEFINITIONS[tool].icon }))),
      createElement("div", { className: "jse-shapes__separator", role: "presentation" }),
      createElement("button", {
        type: "button",
        role: "menuitem",
        className: `jse-tool clickable-icon jse-tool--shape jse-shapes__item${shapeMenuOpen ? " is-entering" : ""}${keepTool ? " is-active" : ""}`,
        style: { animationDelay: "0ms" },
        "aria-label": keepTool ? t("stopKeepingShape") : t("keepShape"),
        "aria-pressed": keepTool,
        onClick: toggleLock
      }, createElement(Icon, { name: locked ? "lock" : "lock-open" }))
    )
  );

  const toolLayer = [
    toolButton(TOOL_DEFINITIONS.selection, () => () => onToggleSelection(), selectionArmed),
    penSlot("tools"),
    textSlot("tools"),
    shapeButton,
    toolButton(TOOL_DEFINITIONS.image, () => insertImage),
    toolButton(TOOL_DEFINITIONS.eraser)
  ];

  const desktopLayer = DESKTOP_TOOLS.map((tool) => toolButton(TOOL_DEFINITIONS[tool]));

  const undoButton = actionButton("undo", "undo-2", t("undo"), (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (!pressExcalidrawButton('[data-testid="button-undo"]')) {
      replayShortcut(getCanvasElement, "z");
    }
  }, false, false, `jse-tool--collapsible${entered ? " jse-anim" : ""}${canUndo ? "" : " is-collapsed"}`);

  const redoButton = actionButton("redo", "redo-2", t("redo"), (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (!pressExcalidrawButton('[data-testid="button-redo"]')) {
      replayShortcut(getCanvasElement, "z", true);
    }
  }, false, false, `jse-tool--collapsible${entered ? " jse-anim" : ""}${canRedo ? "" : " is-collapsed"}`);

  /*
   * The properties page keeps its last content while it slides out. Its rows change with the mode - the
   * active tool's own row comes and goes, the pen's row comes and goes - so a page rebuilt on the way
   * out throws every colour and weight to the top of the column while it is still on screen. Frozen, the
   * page fades in place.
   */
  const propsChildren: ReturnType<typeof createElement>[] = [
    ...(toolRow ? [toolRow] : []),
    ...(penAtTop ? [penSlot("props")] : []),
    ...(textAtTop ? [textSlot("props")] : []),
    ...propertyButtons,
    ...contextButtons
  ];
  const frozenPropsRef = propsFrozenRef;
  if (propertiesMode) {
    frozenPropsRef.current = propsChildren;
  }
  const shownProps = propertiesMode ? propsChildren : (frozenPropsRef.current ?? propsChildren);

  return createElement("div", {
    className: `jse-tools${contentUnder ? " has-content-under" : ""}`,
    // The stylesheet reads these; nothing here hardcodes a duration twice.
    style: MENU_MOTION_VARS,
    onPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => event.stopPropagation()
  },
  createElement("div", {
    className: `jse-tools__pill${dark ? " jse-pill--dark" : ""}${entered ? " jse-anim" : ""}${glideReady ? " has-glide" : ""}${propertiesMode ? " is-props" : ""}`,
    ref: pillRef
  },
    createElement("div", {
      className: "jse-tools__glide",
      ref: glideRef,
      "aria-hidden": true
    }),
    createElement("div", {
      className: `jse-tools__clip${clipping && contentUnder ? " is-clipping" : ""}`
    },
    createElement("div", {
      className: `jse-tools__layer jse-tools__layer--tools${propertiesMode ? " is-out-left" : ""}`,
      ref: toolsLayerRef,
      "aria-hidden": propertiesMode,
      inert: propertiesMode ? "" : undefined
    },
      /*
       * The contextual actions belong to the properties layer, not here: with something selected
       * this layer is leaving, and seeing duplicate and delete fade away in it while the
       * properties arrive reads as a copy of the same buttons.
       */
      ...(isTouchDevice ? toolLayer : desktopLayer)),
    createElement("div", {
      className: `jse-tools__layer jse-tools__layer--props${propertiesMode ? "" : " is-out-right"}`,
      ref: propsLayerRef,
      "aria-hidden": !propertiesMode,
      inert: propertiesMode ? undefined : ""
    },
      ...shownProps)),
    openFamily
      ? createElement("div", {
          className: "jse-appearance-values",
          role: "menu",
          style: { top: `${familyTop}px` },
          onPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => event.stopPropagation()
        },
        createElement(AppearanceValues, {
          category: openFamily,
          style: shownStyle,
          onPick: applyStyle
        }))
      : null,
    penElement,
    textTraveller,
  ),
    createElement("div", {
      className: `jse-tools__history${canUndo || canRedo ? "" : " is-empty"}`,
      role: "group",
      "aria-label": t("undo")
    },
      redoButton,
      undoButton),
  isTouchDevice ? null : lockButton
  );
}
