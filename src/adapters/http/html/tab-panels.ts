import type { ProjectOverview, VariantDetail } from '../../../evolution-streams/application/project-overview.ts';
import type { VariantComparison } from '../../../evolution-streams/domain/variant-comparison.ts';
import { esc } from './escape.ts';
import { field, hidden, option, submit } from './form-controls.ts';
import { commentForm, decisionForm, deployForm, requestForm, revisionForm } from './variant-forms.ts';
import { commentsSection, comparisonSection, decisionsSection, ratingsSection, resultsSection, revisionsSection, workSection } from './variant-sections.ts';
import type { ProjectViewState } from './view-state.ts';

/** Inputs every tab body may need; each panel picks only what it shows. */
export interface TabPanelContext {
  readonly overview: ProjectOverview;
  readonly detail: VariantDetail;
  readonly state: ProjectViewState;
  readonly comparison: VariantComparison | undefined;
}

function compareForm({ overview, detail, state }: TabPanelContext): string {
  const others = overview.variants.filter((v) => v.id !== detail.variant.id);
  if (others.length === 0) return '<p class="muted">比較できる別の亜流がまだありません。</p>';
  const options = others.map((v) => option(v.id, v.title, v.id === state.compareId)).join('');
  return `<form class="inline-form" method="get" action="/projects/${esc(encodeURIComponent(overview.workspace.projectCode))}#detail">
${hidden('variant', detail.variant.id)}${hidden('view', 'detail')}${hidden('tab', 'rules')}
${field('比較する亜流', `<select name="compare">${options}</select>`)}${submit('ルールを比較')}</form>`;
}

export function rulesPanel(ctx: TabPanelContext): string {
  return compareForm(ctx) + comparisonSection(ctx.comparison) + revisionsSection(ctx.detail) + revisionForm(ctx.overview.workspace, ctx.detail);
}

export function talkPanel({ overview, detail }: TabPanelContext): string {
  return commentsSection(detail) + ratingsSection(detail) + commentForm(overview.workspace, detail);
}

export function resultsPanel({ overview, detail }: TabPanelContext): string {
  return resultsSection(detail, overview.workspace.projectCode) + deployForm(overview.workspace, detail);
}

export function workPanel({ overview, detail }: TabPanelContext): string {
  return workSection(detail, overview.workspace.projectCode) + requestForm(overview.workspace, detail);
}

export function decisionPanel({ overview, detail }: TabPanelContext): string {
  return decisionsSection(detail) + decisionForm(overview.workspace, detail);
}
