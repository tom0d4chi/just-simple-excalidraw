/*
 * Does anything sit under the floating column? The column has no plate of its own, and it
 * only needs one where an icon would be unreadable: over a shape or an image.
 */
export interface ScreenRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface ViewTransform {
  scrollX: number;
  scrollY: number;
  zoom: number;
  originX: number;
  originY: number;
}

export interface BoundedElement {
  x: number;
  y: number;
  width: number;
  height: number;
  isDeleted?: boolean;
}

export function elementScreenRect(element: BoundedElement, view: ViewTransform): ScreenRect {
  const zoom = view.zoom || 1;
  const left = view.originX + (element.x + view.scrollX) * zoom;
  const top = view.originY + (element.y + view.scrollY) * zoom;
  return {
    left,
    top,
    right: left + element.width * zoom,
    bottom: top + element.height * zoom
  };
}

export function rectsOverlap(a: ScreenRect, b: ScreenRect): boolean {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

export function anyElementUnder(
  elements: readonly BoundedElement[],
  panels: readonly ScreenRect[],
  view: ViewTransform
): boolean {
  if (panels.length === 0) {
    return false;
  }
  return elements.some((element) => (
    !element.isDeleted && panels.some((panel) => rectsOverlap(elementScreenRect(element, view), panel))
  ));
}
