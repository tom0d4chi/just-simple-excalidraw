import {
  createElement,
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent
} from "react";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import { anyCapability, type Capabilities } from "./capabilities";
import { Icon, type IconName } from "./icons";
import { AppearanceValues, familiesFor, type Category, type StylePatch, type StyleState } from "./appearance";
import { t } from "./i18n";

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
function pressExcalidrawButton(selector: string): boolean {
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
function replayShortcut(
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
  isTouchDevice,
  getCanvasElement
}: CanvasToolbarProps) {
  const [shapeMenuOpen, setShapeMenuOpen] = useState(false);
  /* Which property panel is open, and the middle of the button that opened it: the panel is
     anchored to that button, not to the column. */
  const [openFamily, setOpenFamily] = useState<Category | null>(null);
  const [familyTop, setFamilyTop] = useState(0);
  // "Keep the tool" is a preference of the column, not a property of Excalidraw's
  // current tool: it can be armed before choosing a shape, and it then applies to
  // whatever is picked next.
  const [keepTool, setKeepTool] = useState(locked);
  const keepToolRef = useRef(locked);
  const [entered, setEntered] = useState(false);

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
    const candidates = Array.prototype.slice.call(
      pill.querySelectorAll(".jse-tool.is-active")
    ) as HTMLElement[];
    const target = candidates.find((button) => button.closest(".jse-shapes__menu") === null) ?? null;

    let x = 0;
    let y = 0;
    let node: HTMLElement | null = target;
    while (node && node !== pill) {
      x += node.offsetLeft;
      y += node.offsetTop;
      node = node.offsetParent as HTMLElement | null;
    }

    glide.style.setProperty("--jse-glide-x", `${x}px`);
    glide.style.setProperty("--jse-glide-y", `${y}px`);
    // The hand tool has no lit button: the disc steps aside instead of sitting on
    // whatever was active last.
    glide.dataset.empty = target ? "false" : "true";

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
  const selectTool = (tool: ToolName) => (event: ReactMouseEvent<HTMLButtonElement>): void => {
    event.preventDefault();
    event.stopPropagation();
    if (!api) {
      return;
    }
    const current = api.getAppState().activeTool.type;
    const next = current === tool ? "hand" : tool;
    api.setActiveTool({ type: next, locked: next === "hand" ? false : keepToolRef.current });
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
          appState: { selectedElementIds: { [element.id]: true } }
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
  };

  /*
   * The panel hangs beside the button that opened it, centred on it: its own offsetTop is all
   * the anchoring needed, and it is read at press time, before any transform is applied.
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
    api.updateScene({ elements: elements as never, appState: nextState as never });
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
      if (!(event.target instanceof HTMLElement) || !event.target.closest(".jse-shapes")) {
        setShapeMenuOpen(false);
      }
      if (!(event.target instanceof HTMLElement) || !event.target.closest(".jse-appearance-values")) {
        setOpenFamily(null);
      }
    };
    document.addEventListener("pointerdown", onOutside, true);
    return () => document.removeEventListener("pointerdown", onOutside, true);
  }, [shapeMenuOpen, openFamily]);

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

  const contextClass = (available: boolean): string =>
    `jse-tool--context jse-tool--collapsible${entered ? " jse-anim" : ""}${available ? "" : " is-collapsed"}`;
  const contextButtons = [
    actionButton("edit-text", "square-pen", t("editText"), (event) =>
      stopAndRun(event, () => {
        // Enter on a selected text element opens its editor. Excalidraw's own
        // "Edit" button in the hidden bar is enabled but does nothing when
        // clicked from here, so it is not used.
        replayShortcut(getCanvasElement, "Enter", false, false, 13, "Enter");
      }), false, false, contextClass(textSelected)),
    actionButton("duplicate", "copy", t("duplicate"), (event) =>
      stopAndRun(event, () => {
        if (!pressExcalidrawButton('.App-bottom-bar button[aria-label="Duplicate"]')) {
          replayShortcut(getCanvasElement, "d", false, true, 68, "KeyD");
        }
      }), false, false, contextClass(selectionCount > 0)),
    actionButton("delete", "trash-2", t("remove"), (event) =>
      stopAndRun(event, () => {
        if (!pressExcalidrawButton('.App-bottom-bar button[aria-label="Delete"]')) {
          replayShortcut(getCanvasElement, "Delete", false, false, 46, "Delete");
        }
      }), false, false, contextClass(selectionCount > 0))
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
    api.updateScene({ appState: { currentItemStrokeWidth: patch.strokeWidth } as never });
  };

  /*
   * With something selected the column stops being a box of drawing tools and becomes the
   * properties of what is selected: one button per family, each showing the value it holds.
   * Nothing selected, nothing to style: the tools come back.
   */
  const propertiesMode = isTouchDevice && stylingTarget && selectionCount > 0;
  const families = familiesFor(style, capabilities);
  const propertyButtons = propertiesMode
    ? families.map((family) => createElement("button", {
        key: family.key,
        type: "button",
        className: `jse-tool jse-tool--action clickable-icon${openFamily === family.key ? " is-open" : ""}`,
        "aria-label": family.label,
        "aria-expanded": openFamily === family.key,
        "aria-pressed": openFamily === family.key,
        onClick: toggleFamily(family.key)
      }, family.content))
    : [];

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
        className: `jse-shapes__menu${entered ? " jse-anim" : ""}${shapeMenuOpen ? "" : " is-closed"}`,
        role: "menu",
        "aria-hidden": !shapeMenuOpen,
        onPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => event.stopPropagation()
      },
      shapeOrder.map((tool, index) => createElement("button", {
        key: tool,
        type: "button",
        role: "menuitem",
        className: `jse-tool clickable-icon jse-tool--shape jse-shapes__item${shapeMenuOpen ? " is-entering" : ""}${activeTool === tool ? " is-active" : ""}`,
        style: { animationDelay: `${(shapeOrder.length - index) * 26}ms` },
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

  return createElement("div", {
    className: `jse-tools${contentUnder ? " has-content-under" : ""}`,
    onPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => event.stopPropagation()
  },
  createElement("div", {
    className: `jse-tools__pill${dark ? " jse-pill--dark" : ""}${entered ? " jse-anim" : ""}${glideReady ? " has-glide" : ""}`,
    ref: pillRef
  },
    createElement("div", {
      className: "jse-tools__glide",
      ref: glideRef,
      "aria-hidden": true
    }),
    isTouchDevice
      ? (propertiesMode
          ? [
              toolButton(TOOL_DEFINITIONS.selection, () => () => onToggleSelection(), selectionArmed),
              ...contextButtons,
              ...propertyButtons
            ]
          : [
              toolButton(TOOL_DEFINITIONS.selection, () => () => onToggleSelection(), selectionArmed),
              toolButton(TOOL_DEFINITIONS.freedraw),
              shapeButton,
              toolButton(TOOL_DEFINITIONS.text),
              toolButton(TOOL_DEFINITIONS.image, () => insertImage),
              toolButton(TOOL_DEFINITIONS.eraser),
              ...contextButtons
            ])
      : (propertiesMode
          ? [
              toolButton(TOOL_DEFINITIONS.selection, () => () => onToggleSelection(), selectionArmed),
              ...propertyButtons
            ]
          : DESKTOP_TOOLS.map((tool) => toolButton(TOOL_DEFINITIONS[tool]))),
    openFamily
      ? createElement("div", {
          className: "jse-appearance-values",
          role: "menu",
          style: { top: `${familyTop}px` },
          onPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => event.stopPropagation()
        },
        createElement(AppearanceValues, {
          category: openFamily,
          style,
          onPick: applyStyle,
          onPreview: previewStyle
        }))
      : null,
    isTouchDevice ? null : lockButton,
    actionButton("undo", "undo-2", t("undo"), (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (!pressExcalidrawButton('[data-testid="button-undo"]')) {
        replayShortcut(getCanvasElement, "z");
      }
    }),
    actionButton("redo", "redo-2", t("redo"), (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (!pressExcalidrawButton('[data-testid="button-redo"]')) {
        replayShortcut(getCanvasElement, "z", true);
      }
    }, false, false, `jse-tool--collapsible${entered ? " jse-anim" : ""}${canRedo ? "" : " is-collapsed"}`)
  ));
}
