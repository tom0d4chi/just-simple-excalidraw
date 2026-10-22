import {
  createElement,
  useEffect,
  useRef,
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
  /** Tells the owner when a family is open, so the popover can change shape. */
  onExpand?: (expanded: boolean) => void;
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

/* One grid for every family: no label, the icon that opened it says what it is. */
function grid(children: ReactNode): ReactNode {
  return createElement("div", { className: "jse-appearance__grid" }, children);
}

export function AppearanceMenu({ open, style, capabilities, onPick, onPreview, onExpand }: AppearanceMenuProps) {
  // The slider has its own value while it is being dragged: the element is only
  // rewritten on release, so its style would otherwise lag a whole round trip.
  const [dragging, setDragging] = useState<number | null>(null);
  const [category, setCategory] = useState<Category | null>(null);
  // Kept mounted while it collapses, so the panel can animate its height both ways.
  const [shownCategory, setShownCategory] = useState<Category | null>(null);
  /* One marker for the whole panel: it slides from the old value to the new one instead of
     a ring blinking out here and on over there. */
  const panelRef = useRef<HTMLDivElement | null>(null);
  const markerSignatureRef = useRef("");
  /* The family row gets the same travelling disc as the values below it. */
  const rowRef = useRef<HTMLDivElement | null>(null);
  const familySignatureRef = useRef("");
  const [familyMarker, setFamilyMarker] = useState<{ left: number; top: number; size: number } | null>(null);
  const [marker, setMarker] = useState<{ left: number; top: number; size: number; round: boolean } | null>(null);
  /* Height is measured from the content, so switching family animates from one height to the
     other instead of jumping: max-height can only animate collapsing and expanding. */
  const innerRef = useRef<HTMLDivElement | null>(null);
  const heightSignatureRef = useRef("");
  const [panelHeight, setPanelHeight] = useState(0);
  const width = dragging ?? style.strokeWidth;

  // Closing the menu ends any half-finished drag and forgets the open family.
  useEffect(() => {
    if (!open) {
      setDragging(null);
      setCategory(null);
    }
  }, [open]);

  useEffect(() => {
    if (category) {
      setShownCategory(category);
    }
  }, [category]);

  // The popover is a capsule while it is only its row of families; once a family opens it
  // takes the ordinary panel corners, so growing does not blow the radius up.
  useEffect(() => {
    onExpand?.(open && category !== null);
  }, [onExpand, open, category]);

  // Where the chosen value sits right now, measured from the panel itself.
  useEffect(() => {
    const panel = panelRef.current;
    if (!panel || !category) {
      return;
    }
    const active = panel.querySelector<HTMLElement>(".jse-appearance__chip.is-active");
    if (!active) {
      if (markerSignatureRef.current !== "none") {
        markerSignatureRef.current = "none";
        setMarker(null);
      }
      return;
    }
    const next = {
      left: active.offsetLeft,
      top: active.offsetTop,
      size: active.offsetWidth,
      round: active.classList.contains("jse-appearance__chip--color")
    };
    const signature = `${next.left},${next.top},${next.size},${next.round}`;
    if (signature !== markerSignatureRef.current) {
      markerSignatureRef.current = signature;
      setMarker(next);
    }
    // shownCategory matters: the cells only exist on the pass after the family is kept.
  }, [category, shownCategory, style, open]);

  // How tall the open family is right now.
  useEffect(() => {
    const inner = innerRef.current;
    const next = inner && category ? Math.ceil(inner.getBoundingClientRect().height) : 0;
    const signature = String(next);
    if (signature !== heightSignatureRef.current) {
      heightSignatureRef.current = signature;
      setPanelHeight(next);
    }
  }, [category, shownCategory, capabilities, style, open]);

  // Where the open family sits in its row, measured from the row itself.
  useEffect(() => {
    const row = rowRef.current;
    if (!row) {
      return;
    }
    const active = row.querySelector<HTMLElement>(".jse-appearance__category.is-active");
    if (!active) {
      if (familySignatureRef.current !== "none") {
        familySignatureRef.current = "none";
        setFamilyMarker(null);
      }
      return;
    }
    const next = { left: active.offsetLeft, top: active.offsetTop, size: active.offsetWidth };
    const signature = `${next.left},${next.top},${next.size}`;
    if (signature !== familySignatureRef.current) {
      familySignatureRef.current = signature;
      setFamilyMarker(next);
    }
  }, [category, capabilities, open]);

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

  /*
   * Colours sit nearest the thumb. The popover opens at the right edge of the screen, so the
   * last cells of the row are the easy ones to reach: the families are built in reading
   * order, then reversed so stroke and fill end up there.
   */
  families.reverse();

  const panelFor = (which: Category | null): ReactNode => {
    let panel: ReactNode = null;
    if (which === "stroke") {
    panel = createElement("div", { className: "jse-appearance__grid" }, STROKE_COLORS.map((color) => chip(
      style.strokeColor.toLowerCase() === color,
      `${t("colourStroke")} ${color}`,
      pick({ strokeColor: color }),
      createElement("span", { className: "jse-appearance__dot", style: { backgroundColor: color } }),
      "jse-appearance__chip--color"
    )));
  } else if (which === "fill") {
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
  } else if (which === "width") {
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
  } else if (which === "style") {
    panel = grid(STROKE_STYLES.map((entry) => chip(
      style.strokeStyle === entry.value,
      entry.label(),
      pick({ strokeStyle: entry.value }),
      createElement("span", { className: `jse-appearance__line jse-appearance__line--${entry.value}` }),
      "jse-appearance__chip--line"
    )));
  } else if (which === "corners") {
    panel = grid(EDGES.map((edge) => chip(
      edge.value === null ? style.roundness === null : style.roundness !== null,
      edge.label(),
      pick({ roundness: edge.value }),
      createElement("span", { className: `jse-appearance__shape${edge.value ? " is-round" : ""}` }),
      "jse-appearance__chip--line"
    )));
  } else if (which === "text") {
    panel = grid(FONT_SIZES.map((font) => chip(
      style.fontSize === font.value,
      font.label(),
      pick({ fontSize: font.value }),
      createElement("span", { className: "jse-appearance__size" }, "A"),
      "jse-appearance__chip--font"
    )));
  }

  return panel;
  };

  return createElement("div", { className: "jse-appearance" },
    /*
     * The panel animates its own height, and stays mounted while it collapses, so the
     * popover grows and shrinks smoothly instead of jumping.
     */
    createElement("div", {
      ref: panelRef,
      className: `jse-appearance__panel${category ? " is-open" : ""}`,
      style: { height: category ? `${panelHeight}px` : "0px" }
    },
      createElement("div", { ref: innerRef, className: "jse-appearance__inner" },
      marker
        ? createElement("div", {
            className: "jse-appearance__marker",
            style: {
              left: `${marker.left}px`,
              top: `${marker.top}px`,
              width: `${marker.size}px`,
              height: `${marker.size}px`,
              borderRadius: marker.round ? "50%" : "var(--radius-s, 8px)"
            }
          })
        : null,
      panelFor(shownCategory))),
    createElement("div", { className: "jse-appearance__categories", ref: rowRef },
      familyMarker
        ? createElement("div", {
            className: "jse-appearance__family-marker",
            style: {
              left: `${familyMarker.left}px`,
              top: `${familyMarker.top}px`,
              width: `${familyMarker.size}px`,
              height: `${familyMarker.size}px`
            }
          })
        : null,
      families.map((family, index) => (
      categoryButton(family.key, family.label, family.content, delayFor(index))
    )))
  );
}
