import type { VariantDetail } from '../../../evolution-streams/application/project-overview.ts';
import { esc } from './escape.ts';
import { decisionPanel, resultsPanel, rulesPanel, talkPanel, workPanel, type TabPanelContext } from './tab-panels.ts';
import { conceptSection } from './variant-sections.ts';
import { DETAIL_TABS, projectViewHref, type DetailTabId, type ProjectViewState } from './view-state.ts';

function countOf(d: VariantDetail, tab: DetailTabId): number | undefined {
  switch (tab) {
    case 'concept':
      return undefined;
    case 'rules':
      return d.revisions.length;
    case 'talk':
      return d.threads.length;
    case 'results':
      return d.builds.length;
    case 'work':
      return d.requests.length;
    case 'decision':
      return d.decisions.length;
  }
}

/** Section links as plain navigation: each tab is a URL, so it works with keyboard, touch and no script. */
export function renderTabNav(projectCode: string, state: ProjectViewState, d: VariantDetail): string {
  const links = DETAIL_TABS.map((t) => {
    const current = t.id === state.tab;
    const count = countOf(d, t.id);
    const href = projectViewHref(projectCode, state, { tab: t.id, view: 'detail' });
    return `<li><a class="tab" href="${esc(href)}#detail"${current ? ' aria-current="page"' : ''}>${esc(t.label)}${count ? ` <span class="count">${count}</span>` : ''}</a></li>`;
  }).join('');
  return `<nav class="tabs" aria-label="詳細の区分"><ul>${links}</ul></nav>`;
}

/** Body of the active tab only; the other sections stay one tap away in the tab nav. */
export function renderTabPanel(ctx: TabPanelContext): string {
  switch (ctx.state.tab) {
    case 'concept':
      return conceptSection(ctx.detail);
    case 'rules':
      return rulesPanel(ctx);
    case 'talk':
      return talkPanel(ctx);
    case 'results':
      return resultsPanel(ctx);
    case 'work':
      return workPanel(ctx);
    case 'decision':
      return decisionPanel(ctx);
  }
}
