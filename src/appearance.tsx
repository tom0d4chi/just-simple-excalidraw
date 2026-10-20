import {
  createElement,
  useEffect,
  useState,
  type MouseEvent as ReactMouseEvent,
  type ReactNode
} from "react";
import { t } from "./i18n";

/** Excalidraw stores rounded corners as `roundness: { type: 3 }` on shapes. */
const ROUND = 3;

/**
 * The appearance controls for whatever is being drawn or selected: stroke,
 * fill, thickness, line style, edges and text size. Same shape of menu as the
 * shape picker — a column that slides out of its button — rather than
 * Excalidraw's own property bar, which this plugin hides.
 */

export const STROKE_COLORS: readonly string[] = [
  "#1e1e1e", "#e03131", "#2f9e44", "#1971c2", "#f08c00",
  "#9c36b5", "#0c8599", "#e8590c", "#495057", "#5f3dc4"
];

export const FILL_COLORS: readonly (string | null)[] = [
  null,
  "#ffc9c9", "#b2f2bb", "#a5d8ff", "#ffec99", "#eebefa",
  "#d0bfff", "#c3fae8", "#ced4da", "#ffd8a8", "#868e96"
];

const STROKE_WIDTHS: readonly { value: number; label: () => string }[] = [
  { value: 1, label: () => t("thin") },
  { value: 2, label: () => t("medium") },
  { value: 4, label: () => t("thick") }
];

const STROKE_STYLES: readonly { value: string; label: () => string }[] = [
  { value: "solid", label: () => t("solid") },
  { value: "dashed", label: () => t("dashed") },
  { value: "dotted", label: () => t("dotted") }
];

const EDGES: readonly { value: number | null; label: () => string }[] = [
  { value: null, label: () => t("sharpCorners") },
  { value: ROUND, label: () => t("roundCorners") }
];

const FONT_SIZES: readonly { value: number; label: () => string }[] = [
  { value: 16, label: () => t("small") },
  { value: 20, label: () => t("normal") },
  { value: 28, label: () => t("large") },
  { value: 36, label: () => t("huge") }
];

export interface StyleState {
  strokeColor: string;
  backgroundColor: string;
  strokeWidth: number;
  strokeStyle: string;
  fillStyle: string;
  fontSize: number;
  roundness: number | null;
}

export interface StylePatch {
  strokeColor?: string;
  backgroundColor?: string;
  strokeWidth?: number;
  strokeStyle?: string;
  fillStyle?: string;
  fontSize?: number;
  roundness?: number | null;
}

interface AppearanceMenuProps {
  open: boolean;
  style: StyleState;
  showText: boolean;
  showEdges: boolean;
  onPick: (patch: StylePatch) => void;
  onPreview: (patch: StylePatch) => void;
}

function row(label: string, children: ReactNode): ReactNode {
  return createElement("div", { className: "jse-appearance__row" },
    createElement("span", { className: "jse-appearance__label" }, label),
    createElement("div", { className: "jse-appearance__choices" }, children)
  );
}

function chip(active: boolean, label: string, onClick: (event: ReactMouseEvent<HTMLButtonElement>) => void, content: ReactNode, extra = ""): ReactNode {
  return createElement("button", {
    type: "button",
    className: `jse-appearance__chip${extra ? ` ${extra}` : ""}${active ? " is-active" : ""}`,
    "aria-label": label,
    "aria-pressed": active,
    title: label,
    onClick
  }, content);
}

export function AppearanceMenu({ open, style, showText, showEdges, onPick, onPreview }: AppearanceMenuProps) {
  // The slider has its own value while it is being dragged: the element is only
  // rewritten on release, so its style would otherwise lag a whole round trip.
  const [dragging, setDragging] = useState<number | null>(null);
  const width = dragging ?? style.strokeWidth;

  // Closing the menu ends any half-finished drag of the slider.
  useEffect(() => {
    if (!open) {
      setDragging(null);
    }
  }, [open]);

  const pick = (patch: StylePatch) => (event: ReactMouseEvent<HTMLButtonElement>): void => {
    event.preventDefault();
    event.stopPropagation();
    onPick(patch);
  };

  return createElement("div", { className: "jse-appearance" },
    row(t("stroke"), STROKE_COLORS.map((color) => chip(
      style.strokeColor.toLowerCase() === color,
      `${t("colourStroke")} ${color}`,
      pick({ strokeColor: color }),
      createElement("span", { className: "jse-appearance__dot", style: { backgroundColor: color } }),
      "jse-appearance__chip--color"
    ))),
    row(t("fill"), FILL_COLORS.map((color) => chip(
      (color === null && style.backgroundColor === "transparent") ||
        (color !== null && style.backgroundColor.toLowerCase() === color),
      color === null ? t("noFill") : `${t("colourFill")} ${color}`,
      pick(color === null
        ? { backgroundColor: "transparent" }
        : { backgroundColor: color, fillStyle: style.fillStyle === "hachure" ? "solid" : style.fillStyle }),
      color === null
        ? createElement("span", { className: "jse-appearance__none" })
        : createElement("span", { className: "jse-appearance__dot", style: { backgroundColor: color } }),
      "jse-appearance__chip--color"
    ))),
    createElement("div", { className: "jse-appearance__row" },
      createElement("span", { className: "jse-appearance__label" }, t("thickness")),
      createElement("div", { className: "jse-appearance__choices" }, STROKE_WIDTHS.map((width) => chip(
        style.strokeWidth === width.value,
        width.label(),
        pick({ strokeWidth: width.value }),
        createElement("span", {
          className: "jse-appearance__line",
          style: { height: `${Math.min(6, width.value)}px` }
        }),
        "jse-appearance__chip--line"
      ))),
      createElement("div", { className: "jse-appearance__slider-row" },
        createElement("input", {
          type: "range",
          min: 0.5,
          max: 10,
          step: 0.5,
          value: String(width),
          className: "jse-appearance__slider",
          "aria-label": t("thickness"),
          // moving only shifts the default; releasing writes the elements, so the
          // history keeps one step instead of one per pixel
          onInput: (event: { target: EventTarget | null }) => {
            const next = Number((event.target as HTMLInputElement).value);
            setDragging(next);
            onPreview({ strokeWidth: next });
          },
          onPointerUp: () => {
            if (dragging !== null) {
              onPick({ strokeWidth: dragging });
              setDragging(null);
            }
          },
          onKeyUp: () => {
            if (dragging !== null) {
              onPick({ strokeWidth: dragging });
              setDragging(null);
            }
          }
        }),
        createElement("span", { className: "jse-appearance__value" }, width.toFixed(1))
      )
    ),
    row(t("lineStyle"), STROKE_STYLES.map((line) => chip(
      style.strokeStyle === line.value,
      line.label(),
      pick({ strokeStyle: line.value }),
      createElement("span", {
        className: `jse-appearance__line jse-appearance__line--${line.value}`
      }),
      "jse-appearance__chip--line"
    ))),
    showEdges
      ? row(t("corners"), EDGES.map((edge) => chip(
          edge.value === null ? style.roundness === null : style.roundness !== null,
          edge.label(),
          pick({ roundness: edge.value }),
          createElement("span", {
            className: `jse-appearance__shape${edge.value ? " is-round" : ""}`
          }),
          "jse-appearance__chip--line"
        )))
      : null,
    showText
      ? row(t("size"), FONT_SIZES.map((font) => chip(
          style.fontSize === font.value,
          font.label(),
          pick({ fontSize: font.value }),
          createElement("span", { className: "jse-appearance__size" }, "A"),
          "jse-appearance__chip--font"
        )))
      : null
  );
}
