import {
  createElement,
  useEffect,
  useState,
  type MouseEvent as ReactMouseEvent,
  type ReactNode
} from "react";
import type { Capabilities } from "./capabilities";
import { Icon } from "./icons";
import { t } from "./i18n";

/** Excalidraw stores rounded corners as `roundness: { type: 3 }` on shapes. */
const ROUND = 3;

/*
 * Appearance, in two levels: one icon per family along a row that slides out of the
 * button, then the values of that family in a list that opens above it. The single
 * long panel it replaces took the whole column height and pushed the drawing away.
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

type Category = "stroke" | "fill" | "width" | "style" | "corners" | "text";

interface AppearanceMenuProps {
  open: boolean;
  style: StyleState;
  capabilities: Capabilities;
  onPick: (patch: StylePatch) => void;
  onPreview: (patch: StylePatch) => void;
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

function line(label: string, children: ReactNode): ReactNode {
  return createElement("div", { className: "jse-appearance__row" },
    createElement("span", { className: "jse-appearance__label" }, label),
    createElement("div", { className: "jse-appearance__choices" }, children)
  );
}

export function AppearanceMenu({ open, style, capabilities, onPick, onPreview }: AppearanceMenuProps) {
  // The slider has its own value while it is being dragged: the element is only
  // rewritten on release, so its style would otherwise lag a whole round trip.
  const [dragging, setDragging] = useState<number | null>(null);
  const [category, setCategory] = useState<Category | null>(null);
  const width = dragging ?? style.strokeWidth;

  // Closing the menu ends any half-finished drag and forgets the open family.
  useEffect(() => {
    if (!open) {
      setDragging(null);
      setCategory(null);
    }
  }, [open]);

  // A family that no longer applies (the selection changed) closes itself.
  useEffect(() => {
    const available: Category[] = [
      ...(capabilities.stroke ? ["stroke" as Category] : []),
      ...(capabilities.fill ? ["fill" as Category] : []),
      ...(capabilities.width ? ["width" as Category] : []),
      ...(capabilities.style ? ["style" as Category] : []),
      ...(capabilities.corners ? ["corners" as Category] : []),
      ...(capabilities.text ? ["text" as Category] : [])
    ];
    if (category && !available.includes(category)) {
      setCategory(null);
    }
  }, [capabilities, category]);

  const pick = (patch: StylePatch) => (event: ReactMouseEvent<HTMLButtonElement>): void => {
    event.preventDefault();
    event.stopPropagation();
    onPick(patch);
  };

  const categoryButton = (key: Category, label: string, content: ReactNode, delay = 0): ReactNode => createElement("button", {
    type: "button",
    className: `jse-tool clickable-icon jse-appearance__category${open ? " is-entering" : ""}${category === key ? " is-active" : ""}`,
    style: { animationDelay: `${delay}ms` },
    "aria-label": label,
    "aria-pressed": category === key,
    title: label,
    onClick: (event: ReactMouseEvent<HTMLButtonElement>) => {
      event.preventDefault();
      event.stopPropagation();
      setCategory((current) => (current === key ? null : key));
    }
  }, content);

  const noFill = style.backgroundColor === "transparent";
  // Rightmost appears first, like the shape strip: the delay shrinks along the row.
  const delayFor = (index: number): number => (families.length - index) * 26;
  const families: { key: Category; label: string; content: ReactNode }[] = [
    ...(capabilities.stroke ? [{
      key: "stroke" as Category,
      label: t("stroke"),
      content: createElement("span", {
        className: "jse-appearance__swatch jse-appearance__swatch--ring",
        style: { borderColor: style.strokeColor }
      })
    }] : []),
    ...(capabilities.fill ? [{
      key: "fill" as Category,
      label: t("fill"),
      content: createElement("span", {
        className: `jse-appearance__swatch${noFill ? " is-empty" : ""}`,
        style: noFill ? {} : { backgroundColor: style.backgroundColor }
      })
    }] : []),
    ...(capabilities.width ? [{
      key: "width" as Category,
      label: t("thickness"),
      content: createElement("span", {
        className: "jse-appearance__bar",
        style: { height: `${Math.min(6, Math.max(1, style.strokeWidth))}px` }
      })
    }] : []),
    ...(capabilities.style ? [{
      key: "style" as Category,
      label: t("lineStyle"),
      content: createElement(Icon, { name: "dashes", className: `jse-line-style jse-line-style--${style.strokeStyle}` })
    }] : [])
  ];
  if (capabilities.corners) {
    families.push({
      key: "corners",
      label: t("corners"),
      content: createElement(Icon, { name: style.roundness === null ? "square" : "squircle" })
    });
  }
  if (capabilities.text) {
    families.push({ key: "text", label: t("size"), content: createElement(Icon, { name: "type" }) });
  }

  let panel: ReactNode = null;
  if (category === "stroke") {
    panel = createElement("div", { className: "jse-appearance__grid" }, STROKE_COLORS.map((color) => chip(
      style.strokeColor.toLowerCase() === color,
      `${t("colourStroke")} ${color}`,
      pick({ strokeColor: color }),
      createElement("span", { className: "jse-appearance__dot", style: { backgroundColor: color } }),
      "jse-appearance__chip--color"
    )));
  } else if (category === "fill") {
    panel = createElement("div", { className: "jse-appearance__grid" }, FILL_COLORS.map((color) => chip(
      (color === null && noFill) || (color !== null && style.backgroundColor.toLowerCase() === color),
      color === null ? t("noFill") : `${t("colourFill")} ${color}`,
      pick(color === null
        ? { backgroundColor: "transparent" }
        : { backgroundColor: color, fillStyle: style.fillStyle === "hachure" ? "solid" : style.fillStyle }),
      color === null
        ? createElement("span", { className: "jse-appearance__none" })
        : createElement("span", { className: "jse-appearance__dot", style: { backgroundColor: color } }),
      "jse-appearance__chip--color"
    )));
  } else if (category === "width") {
    panel = createElement("div", { className: "jse-appearance__stack" },
      createElement("div", { className: "jse-appearance__choices" }, STROKE_WIDTHS.map((preset) => chip(
        style.strokeWidth === preset.value,
        preset.label(),
        pick({ strokeWidth: preset.value }),
        createElement("span", { className: "jse-appearance__line", style: { height: `${Math.min(6, preset.value)}px` } }),
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
    );
  } else if (category === "style") {
    panel = line(t("lineStyle"), STROKE_STYLES.map((entry) => chip(
      style.strokeStyle === entry.value,
      entry.label(),
      pick({ strokeStyle: entry.value }),
      createElement("span", { className: `jse-appearance__line jse-appearance__line--${entry.value}` }),
      "jse-appearance__chip--line"
    )));
  } else if (category === "corners") {
    panel = line(t("corners"), EDGES.map((edge) => chip(
      edge.value === null ? style.roundness === null : style.roundness !== null,
      edge.label(),
      pick({ roundness: edge.value }),
      createElement("span", { className: `jse-appearance__shape${edge.value ? " is-round" : ""}` }),
      "jse-appearance__chip--line"
    )));
  } else if (category === "text") {
    panel = line(t("size"), FONT_SIZES.map((font) => chip(
      style.fontSize === font.value,
      font.label(),
      pick({ fontSize: font.value }),
      createElement("span", { className: "jse-appearance__size" }, "A"),
      "jse-appearance__chip--font"
    )));
  }

  return createElement("div", { className: "jse-appearance" },
    panel
      ? createElement("div", { className: "jse-appearance__panel", key: category }, panel)
      : null,
    createElement("div", { className: "jse-appearance__categories" }, families.map((family, index) => (
      categoryButton(family.key, family.label, family.content, delayFor(index))
    )))
  );
}
