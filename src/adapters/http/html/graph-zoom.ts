/** Graph zoom as carried in the `zoom` query value: screen-led default, whole-graph fit, or a fixed scale step. */
export type GraphZoom = { readonly kind: 'auto' } | { readonly kind: 'fit' } | { readonly kind: 'scale'; readonly value: number };

export const ZOOM_STEPS = [0.5, 0.75, 1, 1.5, 2] as const;
export const ACTUAL_SIZE_ZOOM: GraphZoom = { kind: 'scale', value: 1 };
export const FIT_ZOOM: GraphZoom = { kind: 'fit' };

/**
 * Opening a project lets the screen decide, because the two orientations fail in opposite ways.
 * The wide graph reaches past its short pane, so arriving at actual size hides variants off the
 * right edge; the narrow graph shrinks its labels past reading when squeezed into a phone pane.
 * Auto fits the wide one and leaves the narrow one at actual size with scrolling; the stylesheet
 * applies it, so the entry view is right at any width without a script or a reload.
 */
export const AUTO_ZOOM: GraphZoom = { kind: 'auto' };
export const DEFAULT_ZOOM: GraphZoom = AUTO_ZOOM;

/** Unknown or out-of-range values fall back to the screen-led default instead of failing the page. */
export function parseGraphZoom(raw: string | null | undefined): GraphZoom {
  if (raw === 'fit') return FIT_ZOOM;
  const value = Number(raw);
  return (ZOOM_STEPS as readonly number[]).includes(value) ? { kind: 'scale', value } : DEFAULT_ZOOM;
}

export function formatGraphZoom(zoom: GraphZoom): string {
  return zoom.kind === 'scale' ? String(zoom.value) : zoom.kind;
}

export function describeGraphZoom(zoom: GraphZoom): string {
  if (zoom.kind === 'auto') return '画面に合わせる';
  return zoom.kind === 'fit' ? '全体表示' : `${Math.round(zoom.value * 100)}%`;
}

/** Next step in the given direction; from auto or fit, zooming starts again at actual size. Undefined at the ends. */
export function stepGraphZoom(zoom: GraphZoom, direction: 1 | -1): GraphZoom | undefined {
  if (zoom.kind !== 'scale') return ACTUAL_SIZE_ZOOM;
  const index = ZOOM_STEPS.indexOf(zoom.value as (typeof ZOOM_STEPS)[number]);
  const next = ZOOM_STEPS[index + direction];
  return next === undefined ? undefined : { kind: 'scale', value: next };
}
