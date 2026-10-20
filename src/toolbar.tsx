import {
  createElement,
  useEffect,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent
} from "react";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import { ICONS, type IconName } from "./icons";
import { AppearanceMenu, type StylePatch, type StyleState } from "./appearance";

type ToolName = "hand" | "selection" | "rectangle" | "diamond" | "ellipse" | "arrow" | "line" | "freedraw" | "text" | "image" | "eraser";

interface ToolDefinition {
  tool: ToolName;
  icon: IconName;
  label: string;
}

const TOOL_DEFINITIONS: Record<ToolName, ToolDefinition> = {
  hand: { tool: "hand", icon: "hand", label: "Desplazar" },
  selection: { tool: "selection", icon: "mouse-pointer-2", label: "Seleccionar" },
  freedraw: { tool: "freedraw", icon: "pencil", label: "Dibujo a mano" },
  eraser: { tool: "eraser", icon: "eraser", label: "Borrador" },
  rectangle: { tool: "rectangle", icon: "square", label: "Rectángulo" },
  diamond: { tool: "diamond", icon: "diamond", label: "Rombo" },
  ellipse: { tool: "ellipse", icon: "circle", label: "Elipse" },
  arrow: { tool: "arrow", icon: "arrow-up-right", label: "Flecha" },
  line: { tool: "line", icon: "minus", label: "Línea" },
  text: { tool: "text", icon: "type", label: "Texto" },
  image: { tool: "image", icon: "image", label: "Imagen" }
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
function Icon({ name }: { name: IconName }) {
  return createElement("svg", {
    className: "svg-icon jse-icon",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": "true",
    dangerouslySetInnerHTML: { __html: ICONS[name] }
  });
}

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
  canRedo,
  isTouchDevice,
  getCanvasElement
}: CanvasToolbarProps) {
  const [shapeMenuOpen, setShapeMenuOpen] = useState(false);
  const [styleMenuOpen, setStyleMenuOpen] = useState(false);
  const [entered, setEntered] = useState(false);

  const [lastShape, setLastShape] = useState<ToolName>("rectangle");
  const activeShape = SHAPES.includes(activeTool as ToolName) ? (activeTool as ToolName) : null;

  const selectTool = (tool: ToolName) => (event: ReactMouseEvent<HTMLButtonElement>): void => {
    event.preventDefault();
    event.stopPropagation();
    if (api) {
      api.setActiveTool({ type: tool });
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
    const current = TOOL_DEFINITIONS[activeTool as ToolName]?.tool;
    if (api && current) {
      api.setActiveTool({ type: current, locked: !locked });
    }
  };

  const toggleShapeMenu = (event: ReactMouseEvent<HTMLButtonElement>): void => {
    event.preventDefault();
    event.stopPropagation();
    setShapeMenuOpen((value) => !value);
  };

  const toggleStyleMenu = (event: ReactMouseEvent<HTMLButtonElement>): void => {
    event.preventDefault();
    event.stopPropagation();
    setStyleMenuOpen((value) => !value);
  };

  /*
   * Excalidraw applies a style to the selection itself when its own panel is
   * used; through the API the elements have to be written, with a new version so
   * the change is a real edit and lands in the history.
   */
  const applyStyle = (patch: StylePatch): void => {
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

  useEffect(() => {
    if (!shapeMenuOpen && !styleMenuOpen) {
      return;
    }
    const onOutside = (event: PointerEvent): void => {
      if (!(event.target instanceof HTMLElement) || !event.target.closest(".jse-shapes")) {
        setShapeMenuOpen(false);
        setStyleMenuOpen(false);
      }
    };
    document.addEventListener("pointerdown", onOutside, true);
    return () => document.removeEventListener("pointerdown", onOutside, true);
  }, [shapeMenuOpen, styleMenuOpen]);

  const toolButton = ({ tool, icon, label }: ToolDefinition, onClick = selectTool) => createElement("button", {
    key: tool,
    type: "button",
    className: `jse-tool clickable-icon${activeTool === tool ? " is-active" : ""}`,
    "aria-label": label,
    "aria-pressed": activeTool === tool,
    onClick: onClick(tool)
  }, createElement(Icon, { name: icon }));

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
    actionButton("edit-text", "type", "Editar texto", (event) =>
      stopAndRun(event, () => {
        if (!pressExcalidrawButton('.App-bottom-bar button[aria-label="Edit"]')) {
          replayShortcut(getCanvasElement, "Enter", false, false, 13, "Enter");
        }
      }), false, false, contextClass(textSelected)),
    actionButton("duplicate", "copy", "Duplicar", (event) =>
      stopAndRun(event, () => {
        if (!pressExcalidrawButton('.App-bottom-bar button[aria-label="Duplicate"]')) {
          replayShortcut(getCanvasElement, "d", false, true, 68, "KeyD");
        }
      }), false, false, contextClass(selectionCount > 0)),
    actionButton("delete", "trash-2", "Eliminar", (event) =>
      stopAndRun(event, () => {
        if (!pressExcalidrawButton('.App-bottom-bar button[aria-label="Delete"]')) {
          replayShortcut(getCanvasElement, "Delete", false, false, 46, "Delete");
        }
      }), false, false, contextClass(selectionCount > 0))
  ];

  const lockButton = actionButton(
    "lock",
    locked ? "lock" : "lock-open",
    locked ? "Desbloquear herramienta" : "Bloquear herramienta",
    toggleLock,
    locked
  );

  const appearanceButton = createElement("div", { className: "jse-shapes", key: "appearance" },
    createElement("button", {
      type: "button",
      className: `jse-tool jse-tool--action clickable-icon${styleMenuOpen ? " is-open" : ""}`,
      "aria-label": "Apariencia",
      "aria-expanded": styleMenuOpen,
      onClick: toggleStyleMenu
    }, createElement(Icon, { name: "palette" })),
    createElement("div", {
      className: `jse-shapes__menu jse-appearance-menu${entered ? " jse-anim" : ""}${styleMenuOpen ? "" : " is-closed"}`,
      role: "menu",
      "aria-hidden": !styleMenuOpen,
      onPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => event.stopPropagation()
    },
    createElement(AppearanceMenu, {
      style,
      showText: textSelected || activeTool === "text",
      showEdges: Boolean(activeShape) || selectionCount > 0,
      onPick: applyStyle
    }))
  );

  const shapeButton = createElement("div", { className: "jse-shapes", key: "shapes" },
    createElement("button", {
      type: "button",
      className: `jse-tool clickable-icon${activeShape ? " is-active" : ""}${shapeMenuOpen ? " is-open" : ""}`,
      "aria-label": "Formas",
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
      SHAPES.map((tool) => createElement("button", {
        key: tool,
        type: "button",
        role: "menuitem",
        className: `jse-tool clickable-icon jse-tool--shape${activeTool === tool ? " is-active" : ""}`,
        "aria-label": TOOL_DEFINITIONS[tool].label,
        "aria-pressed": activeTool === tool,
        onClick: pickShape(tool)
      }, createElement(Icon, { name: TOOL_DEFINITIONS[tool].icon }))),
      createElement("div", { className: "jse-shapes__separator", role: "presentation" }),
      createElement("button", {
        type: "button",
        role: "menuitem",
        className: `jse-tool clickable-icon jse-tool--shape${locked ? " is-active" : ""}`,
        "aria-label": locked ? "Desbloquear la forma" : "Fijar la forma",
        "aria-pressed": locked,
        onClick: toggleLock
      }, createElement(Icon, { name: locked ? "lock" : "lock-open" }))
    )
  );

  return createElement("div", {
    className: "jse-tools",
    onPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => event.stopPropagation()
  },
  createElement("div", { className: `jse-tools__pill${entered ? " jse-anim" : ""}` },
    isTouchDevice
      ? [
          toolButton(TOOL_DEFINITIONS.selection),
          ...contextButtons,
          toolButton(TOOL_DEFINITIONS.freedraw),
          shapeButton,
          toolButton(TOOL_DEFINITIONS.text),
          toolButton(TOOL_DEFINITIONS.image, () => insertImage),
          toolButton(TOOL_DEFINITIONS.eraser)
        ]
      : DESKTOP_TOOLS.map((tool) => toolButton(TOOL_DEFINITIONS[tool])),
    appearanceButton,
    isTouchDevice ? null : lockButton,
    actionButton("undo", "undo-2", "Deshacer", (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (!pressExcalidrawButton('[data-testid="button-undo"]')) {
        replayShortcut(getCanvasElement, "z");
      }
    }),
    actionButton("redo", "redo-2", "Rehacer", (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (!pressExcalidrawButton('[data-testid="button-redo"]')) {
        replayShortcut(getCanvasElement, "z", true);
      }
    }, false, false, `jse-tool--collapsible${entered ? " jse-anim" : ""}${canRedo ? "" : " is-collapsed"}`)
  ));
}
