import { DEFAULT_ZOOM, formatGraphZoom, parseGraphZoom, type GraphZoom } from './graph-zoom.ts';

/** Detail sections of the selected variant, in navigation order. */
export const DETAIL_TABS = [
  { id: 'concept', label: 'コンセプト' },
  { id: 'rules', label: 'ルール差分' },
  { id: 'talk', label: '対話' },
  { id: 'results', label: '成果物' },
  { id: 'work', label: '作業依頼' },
  { id: 'decision', label: '合流判断' },
] as const;

export type DetailTabId = (typeof DETAIL_TABS)[number]['id'];
export type PaneView = 'graph' | 'detail';

/**
 * Web screen state. It lives only in the URL, so reload, share and back keep the same
 * screen; the Tela overlay will keep its own equivalent without touching domain state.
 */
export interface ProjectViewState {
  readonly variantId?: string;
  readonly compareId?: string;
  /** Which pane a narrow screen shows; wide screens show both. */
  readonly view: PaneView;
  readonly tab: DetailTabId;
  readonly zoom: GraphZoom;
}

export const DEFAULT_TAB: DetailTabId = 'concept';

function isTab(value: string | null): value is DetailTabId {
  return DETAIL_TABS.some((t) => t.id === value);
}

export function parseProjectView(query: URLSearchParams): ProjectViewState {
  const variantId = query.get('variant') || undefined;
  const compareId = query.get('compare') || undefined;
  const tab = query.get('tab');
  return {
    ...(variantId ? { variantId } : {}),
    ...(compareId ? { compareId } : {}),
    view: query.get('view') === 'detail' ? 'detail' : 'graph',
    tab: isTab(tab) ? tab : DEFAULT_TAB,
    zoom: parseGraphZoom(query.get('zoom')),
  };
}

/** Patch where `variantId: undefined` explicitly clears the selection; an absent key keeps it. */
export type ProjectViewPatch = { readonly [K in keyof ProjectViewState]?: ProjectViewState[K] | undefined };

/**
 * Link to the project page with some state changed. Everything not patched — above all the
 * selected variant id — is carried over, so switching pane, tab or zoom never loses the selection.
 * Defaults are omitted to keep links short.
 */
export function projectViewHref(projectCode: string, state: ProjectViewState, patch: ProjectViewPatch = {}): string {
  const next = { ...state, ...patch };
  const params = new URLSearchParams();
  if (next.variantId) params.set('variant', next.variantId);
  if (next.compareId && next.variantId) params.set('compare', next.compareId);
  if (next.view && next.view !== 'graph') params.set('view', next.view);
  if (next.tab && next.tab !== DEFAULT_TAB) params.set('tab', next.tab);
  const zoom = formatGraphZoom(next.zoom ?? DEFAULT_ZOOM);
  if (zoom !== formatGraphZoom(DEFAULT_ZOOM)) params.set('zoom', zoom);
  const qs = params.toString();
  return `/projects/${encodeURIComponent(projectCode)}${qs ? `?${qs}` : ''}`;
}

/**
 * Where a form post returns to (Post/Redirect/Get): the same variant on the detail pane and the tab
 * of the operation just done, with the failure reason when there is one.
 */
export function returnHref(projectCode: string, variantId: string | undefined, tab: DetailTabId, error?: string): string {
  const base: ProjectViewState = { view: 'graph', tab: DEFAULT_TAB, zoom: DEFAULT_ZOOM };
  const href = projectViewHref(projectCode, base, variantId ? { variantId, view: 'detail', tab } : {});
  return error ? `${href}${href.includes('?') ? '&' : '?'}${new URLSearchParams({ error }).toString()}` : href;
}
