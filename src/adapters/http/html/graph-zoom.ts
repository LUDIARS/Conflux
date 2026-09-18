/** Graph zoom as carried in the `zoom` query value: whole-graph fit or a fixed scale step. */
export type GraphZoom = { readonly kind: 'fit' } | { readonly kind: 'scale'; readonly value: number };

export const ZOOM_STEPS = [0.5, 0.75, 1, 1.5, 2] as const;
export const DEFAULT_ZOOM: GraphZoom = { kind: 'scale', value: 1 };
export const FIT_ZOOM: GraphZoom = { kind: 'fit' };

/** Unknown or out-of-range values fall back to actual size instead of failing the page. */
export function parseGraphZoom(raw: string | null | undefined): GraphZoom {
  if (raw === 'fit') return FIT_ZOOM;
  const value = Number(raw);
  return (ZOOM_STEPS as readonly number[]).includes(value) ? { kind: 'scale', value } : DEFAULT_ZOOM;
}

export function formatGraphZoom(zoom: GraphZoom): string {
  return zoom.kind === 'fit' ? 'fit' : String(zoom.value);
}

export function describeGraphZoom(zoom: GraphZoom): string {
  return zoom.kind === 'fit' ? '全体表示' : `${Math.round(zoom.value * 100)}%`;
}

/** Next step in the given direction; from fit, zooming starts again at actual size. Undefined at the ends. */
export function stepGraphZoom(zoom: GraphZoom, direction: 1 | -1): GraphZoom | undefined {
  if (zoom.kind === 'fit') return DEFAULT_ZOOM;
  const index = ZOOM_STEPS.indexOf(zoom.value as (typeof ZOOM_STEPS)[number]);
  const next = ZOOM_STEPS[index + direction];
  return next === undefined ? undefined : { kind: 'scale', value: next };
}
