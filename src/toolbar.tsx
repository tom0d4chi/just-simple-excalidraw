import {
  createElement,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent
} from "react";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import { ICONS, type IconName } from "./icons";

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
const TOUCH_PRIMARY: readonly ToolName[] = ["selection", "freedraw", "rectangle", "arrow", "text", "eraser"];
const TOUCH_EXTRA: readonly ToolName[] = ["line", "ellipse", "diamond", "image"];

const DESKTOP_TOOLS: readonly ToolName[] = [
  "hand", "selection", "freedraw", "eraser", "rectangle", "diamond", "ellipse", "arrow", "line", "text", "image"
];

interface CanvasToolbarProps {
  api: ExcalidrawImperativeAPI | null;
  activeTool: string;
  locked: boolean;
  styleOpen: boolean;
  styleAvailable: boolean;
  isTouchDevice: boolean;
  getCanvasElement: () => HTMLElement | null;
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
function replayShortcut(getCanvasElement: () => HTMLElement | null, key: string, shiftKey = false): void {
  const canvas = getCanvasElement();
  if (!canvas || isEditableTarget(document.activeElement)) {
    return;
  }
  const code = key.toUpperCase().charCodeAt(0);
  canvas.dispatchEvent(new KeyboardEvent("keydown", {
    key,
    code: `Key${key.toUpperCase()}`,
    keyCode: code,
    which: code,
    ctrlKey: true,
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
  styleOpen,
  styleAvailable,
  isTouchDevice,
  getCanvasElement
}: CanvasToolbarProps) {
  const [expanded, setExpanded] = useState(false);
  const primaryTools = isTouchDevice ? TOUCH_PRIMARY : DESKTOP_TOOLS;
  const extraTools = isTouchDevice ? TOUCH_EXTRA : [];
  const activeIsExtra = extraTools.includes(activeTool as ToolName);

  const selectTool = (tool: ToolName) => (event: ReactMouseEvent<HTMLButtonElement>): void => {
    event.preventDefault();
    event.stopPropagation();
    if (api) {
      api.setActiveTool({ type: tool });
    }
  };

  const selectFromExtra = (tool: ToolName) => (event: ReactMouseEvent<HTMLButtonElement>): void => {
    selectTool(tool)(event);
    setExpanded(false);
  };

  const toggleLock = (event: ReactMouseEvent<HTMLButtonElement>): void => {
    event.preventDefault();
    event.stopPropagation();
    const current = TOOL_DEFINITIONS[activeTool as ToolName]?.tool;
    if (api && current) {
      api.setActiveTool({ type: current, locked: !locked });
    }
  };

  const toggleMore = (event: ReactMouseEvent<HTMLButtonElement>): void => {
    event.preventDefault();
    event.stopPropagation();
    setExpanded((value) => !value);
  };

  const toggleStyle = (event: ReactMouseEvent<HTMLButtonElement>): void => {
    event.preventDefault();
    event.stopPropagation();
    if (api) {
      api.updateScene({ appState: { openMenu: styleOpen ? null : "shape" } });
    }
  };

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
    disabled = false
  ) => createElement("button", {
    key,
    type: "button",
    className: `jse-tool jse-tool--action clickable-icon${active ? " is-active" : ""}${disabled ? " is-disabled" : ""}`,
    "aria-label": label,
    "aria-pressed": active,
    "aria-disabled": disabled,
    onClick: disabled ? undefined : onClick
  }, createElement(Icon, { name: icon }));

  const lockButton = actionButton(
    "lock",
    locked ? "lock" : "lock-open",
    locked ? "Desbloquear herramienta" : "Bloquear herramienta",
    toggleLock,
    locked
  );

  return createElement("div", {
    className: "jse-tools",
    onPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => event.stopPropagation()
  },
  createElement("div", { className: `jse-tools__pill${expanded ? " is-expanded" : ""}` },
    // The overflow opens above the core set and collapses as soon as a tool is
    // picked, so the column never stays long under the thumb.
    expanded ? [...extraTools.map((tool) => toolButton(TOOL_DEFINITIONS[tool], selectFromExtra)), lockButton] : null,
    primaryTools.map((tool) => toolButton(TOOL_DEFINITIONS[tool])),
    // Always rendered: a button that appears and disappears would shift every
    // other button under the user's finger.
    actionButton("style", "palette", "Color y grosor", toggleStyle, styleOpen, !styleAvailable),
    isTouchDevice ? null : lockButton,
    actionButton("undo", "undo-2", "Deshacer", (event) => {
      event.preventDefault();
      event.stopPropagation();
      replayShortcut(getCanvasElement, "z");
    }),
    actionButton("redo", "redo-2", "Rehacer", (event) => {
      event.preventDefault();
      event.stopPropagation();
      replayShortcut(getCanvasElement, "z", true);
    }),
    extraTools.length
      ? actionButton(
          "more",
          expanded ? "chevron-up" : "chevron-down",
          expanded ? "Menos herramientas" : "Más herramientas",
          toggleMore,
          expanded || activeIsExtra
        )
      : null
  ));
}
