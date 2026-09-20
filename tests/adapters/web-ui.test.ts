import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import projectViewHrefContract from '../../contracts/project-view-href.contract.ts';
import { createApp } from '../../src/adapters/http/create-app.ts';
import { CLIENT_SCRIPT } from '../../src/adapters/http/html/client-script.ts';
import { ACTUAL_SIZE_ZOOM, AUTO_ZOOM, DEFAULT_ZOOM, FIT_ZOOM, parseGraphZoom, stepGraphZoom } from '../../src/adapters/http/html/graph-zoom.ts';
import { STYLE } from '../../src/adapters/http/html/styles.ts';
import { truncateLabel } from '../../src/adapters/http/html/svg-label.ts';
import { DETAIL_TABS, parseProjectView, projectViewHref, returnHref, type ProjectViewPatch, type ProjectViewState } from '../../src/adapters/http/html/view-state.ts';
import type { HttpRequest } from '../../src/adapters/http/http-types.ts';
import { createTide, createVariant, recordRevision } from '../../src/evolution-streams/application/flow-use-cases.ts';
import { configureWorkspace } from '../../src/project-workspaces/application/workspace-use-cases.ts';
import { COMMIT_A, testDeps, workspaceInput } from '../support/fixtures.ts';
import { seedPlayableBuild, seedProject, unwrap } from '../support/seed.ts';

function get(path: string): HttpRequest {
  const url = new URL(path, 'http://localhost');
  return { method: 'GET', path: url.pathname, query: url.searchParams, headers: {}, body: '' };
}

function postForm(path: string, form: Record<string, string>): HttpRequest {
  return { method: 'POST', path, query: new URLSearchParams(), headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(form).toString() };
}

/** Every visible form control must sit inside a <label>, not rely on a placeholder. */
function unlabelledControls(html: string): string[] {
  const visible = html.replace(/<input type="hidden"[^>]*>/g, '');
  const missing: string[] = [];
  for (const m of visible.matchAll(/<(input|select|textarea)\b[^>]*>/g)) {
    const at = m.index ?? 0;
    if (visible.lastIndexOf('<label', at) <= visible.lastIndexOf('</label>', at)) missing.push(m[0]);
  }
  return missing;
}

function hrefsOf(html: string, className: string): string[] {
  return [...html.matchAll(new RegExp(`<a class="${className}" href="([^"]+)"`, 'g'))].map((m) => (m[1] as string).replace(/&amp;/g, '&'));
}

describe('web view state (CF-WEB-001)', () => {
  it('parses the URL and falls back to defaults for unknown values', () => {
    const s = parseProjectView(new URLSearchParams('variant=v1&view=weird&tab=nope&zoom=7'));
    assert.equal(s.variantId, 'v1');
    assert.equal(s.view, 'graph');
    assert.equal(s.tab, 'concept');
    assert.deepEqual(s.zoom, { kind: 'auto' });
    assert.deepEqual(parseProjectView(new URLSearchParams('zoom=fit&view=detail&tab=talk')).zoom, { kind: 'fit' });
    assert.deepEqual(parseProjectView(new URLSearchParams('zoom=1')).zoom, { kind: 'scale', value: 1 });
  });

  it('C-15 pane, tab and zoom links keep the selected variant id', () => {
    const state = parseProjectView(new URLSearchParams('variant=v 1&tab=talk&zoom=1.5'));
    const patches: ProjectViewPatch[] = [
      {},
      { view: 'detail' },
      { view: 'graph' },
      ...DETAIL_TABS.map((t) => ({ tab: t.id })),
      { zoom: { kind: 'fit' } },
      { zoom: { kind: 'scale', value: 0.5 } },
      { variantId: 'other' },
      { variantId: undefined },
    ];
    for (const patch of patches) {
      const href = projectViewHref('K D', state, patch);
      assert.equal(projectViewHrefContract.post(href, 'K D', state, patch), true, href);
    }
    assert.equal(new URL(projectViewHref('KD', state, { view: 'detail' }), 'http://x').searchParams.get('tab'), 'talk');
    assert.equal(typeof projectViewHrefContract.post('/projects/KD', 'KD', state, { view: 'detail' }), 'string');
  });

  it('returns a form post to the same variant and tab, carrying the failure reason', () => {
    const url = new URL(returnHref('KD', 'v1', 'work', '依頼 & 失敗'), 'http://x');
    assert.equal(url.searchParams.get('variant'), 'v1');
    assert.equal(url.searchParams.get('view'), 'detail');
    assert.equal(url.searchParams.get('tab'), 'work');
    assert.equal(url.searchParams.get('error'), '依頼 & 失敗');
    assert.equal(returnHref('KD', undefined, 'talk'), '/projects/KD');
  });

  it('steps zoom within range and restarts from actual size after fit', () => {
    assert.equal(stepGraphZoom({ kind: 'scale', value: 2 }, 1), undefined);
    assert.equal(stepGraphZoom({ kind: 'scale', value: 0.5 }, -1), undefined);
    assert.deepEqual(stepGraphZoom({ kind: 'fit' }, 1), { kind: 'scale', value: 1 });
    assert.deepEqual(stepGraphZoom({ kind: 'fit' }, -1), { kind: 'scale', value: 1 });
    assert.deepEqual(stepGraphZoom(parseGraphZoom('1'), 1), { kind: 'scale', value: 1.5 });
  });

  it('opens on the screen-led view, so no zoom and an unreadable zoom both mean auto', () => {
    assert.deepEqual(DEFAULT_ZOOM, AUTO_ZOOM);
    assert.deepEqual(parseGraphZoom(null), { kind: 'auto' });
    assert.deepEqual(parseGraphZoom('7'), { kind: 'auto' });
    assert.deepEqual(parseGraphZoom('fit'), { kind: 'fit' });
    assert.deepEqual(parseGraphZoom('1'), { kind: 'scale', value: 1 });
  });

  it('leaves auto out of the link and spells fit and actual size out', () => {
    const base: ProjectViewState = { view: 'graph', tab: 'concept', zoom: DEFAULT_ZOOM };
    assert.equal(projectViewHref('KD', base), '/projects/KD');
    assert.equal(projectViewHref('KD', base, { zoom: ACTUAL_SIZE_ZOOM }), '/projects/KD?zoom=1');
    assert.equal(projectViewHref('KD', base, { zoom: FIT_ZOOM }), '/projects/KD?zoom=fit');
    assert.equal(projectViewHref('KD', { ...base, zoom: FIT_ZOOM }, { zoom: AUTO_ZOOM }), '/projects/KD');
  });

  it('shrinks the wide graph only on arrival, and both graphs when the whole graph is asked for', () => {
    assert.match(STYLE, /\.graph-scroll\.auto \.graph-svg\.graph-rightward \{[^}]*width:100%/);
    assert.doesNotMatch(STYLE, /\.graph-scroll\.auto \.graph-svg\.graph-upward/);
    assert.match(STYLE, /\.graph-scroll\.fit \.graph-svg \{[^}]*width:100%/);
  });

  it('shortens long node labels but keeps short ones', () => {
    assert.equal(truncateLabel('コンボ型', 13), 'コンボ型');
    const long = truncateLabel('とても長い日本語の亜流タイトルでノードからはみ出す', 13);
    assert.ok(long.endsWith('…'));
    assert.ok([...long].length <= 13);
    assert.equal(truncateLabel('evolution/rush/combo/main', 15), 'evolution/rush/combo/main');
  });
});

describe('web project page (CF-WEB-001)', () => {
  it('keeps the selection across graph, list, pane switch and tabs', async () => {
    const { deps } = testDeps();
    const s = await seedProject(deps);
    const app = createApp(deps);
    const res = await app.handle(get(`/projects/KD?variant=${s.variant.id}&view=detail&tab=talk`));
    assert.equal(res.status, 200);
    assert.match(res.body, /data-view="detail"/);
    assert.match(res.body, /aria-current="true"[^>]*>/);
    for (const cls of ['switch', 'tab', 'flow-item']) {
      const hrefs = hrefsOf(res.body, cls);
      assert.ok(hrefs.length > 0, cls);
      for (const href of hrefs) assert.equal(new URL(href, 'http://x').searchParams.get('variant'), s.variant.id, `${cls}: ${href}`);
    }
    // Both orientations are rendered; the stylesheet picks one by width, so each keeps the selection.
    assert.match(res.body, /<svg[^>]*class="graph-svg graph-rightward"/);
    assert.match(res.body, /<svg[^>]*class="graph-svg graph-upward"/);
    const svgs = res.body.match(/<svg[^>]*class="graph-svg[\s\S]*?<\/svg>/g) ?? [];
    assert.equal(svgs.length, 2);
    for (const svg of svgs) assert.match(svg, /data-selected="true"/);
    assert.match(res.body, /@media \(min-width: 960px\) \{[^}]*\}[^@]*\.graph-svg\.graph-upward \{ display:none; \}/s);
    // only the active tab's body is rendered
    assert.match(res.body, /コメントを書く/);
    assert.doesNotMatch(res.body, /合流判断の履歴/);
    assert.match(res.body, /evolution\/rush\/combo\/main/);
  });

  it('labels every visible input on every tab', async () => {
    const { deps } = testDeps();
    const s = await seedProject(deps);
    unwrap(await recordRevision(deps, { projectCode: 'KD', variantId: s.variant.id, intent: 'x', summary: '', ruleChanges: [], gitRef: { branch: 'evolution/rush/combo/main', commit: COMMIT_A } }));
    await seedPlayableBuild(deps, s, COMMIT_A);
    const app = createApp(deps);
    for (const tab of DETAIL_TABS) {
      const res = await app.handle(get(`/projects/KD?variant=${s.variant.id}&tab=${tab.id}`));
      assert.equal(res.status, 200);
      assert.deepEqual(unlabelledControls(res.body), [], tab.id);
    }
    const results = await app.handle(get(`/projects/KD?variant=${s.variant.id}&tab=results`));
    assert.match(results.body, /デプロイ \(管理職以上\)/);
    assert.match(results.body, /この画面では権限を判定しません/);
    // Playable artifact links are primary actions, so they get the 44px tap target.
    assert.match(results.body, /<a class="button-link" href="https:\/\/builds\.example\/[^"]+\.zip" rel="noopener">windows \(DL\)<\/a>/);
  });

  it('handles long names and many nodes without dropping text', async () => {
    const { deps } = testDeps();
    await seedProject(deps);
    const longTitle = '長い名前'.repeat(20);
    const tide = unwrap(await createTide(deps, { projectCode: 'KD', slug: 'long', title: longTitle, concept: 'c' }));
    for (let i = 0; i < 30; i++) {
      unwrap(await createVariant(deps, { projectCode: 'KD', tideId: tide.id, slug: `v${i}`, title: `${longTitle}${i}`, concept: 'c', rules: [] }));
    }
    const app = createApp(deps);
    const res = await app.handle(get('/projects/KD?zoom=fit'));
    assert.equal(hrefsOf(res.body, 'flow-item').length, 31);
    assert.match(res.body, /class="graph-scroll fit"/);
    assert.match(res.body, /width="100%"/);
    assert.ok(res.body.includes(`aria-label="${longTitle} / ${longTitle}0"`));
    assert.ok(res.body.includes('…'));
  });

  it('shows empty states for a new project and an unknown selection', async () => {
    const { deps } = testDeps();
    unwrap(await configureWorkspace(deps, workspaceInput()));
    const app = createApp(deps);
    const empty = await app.handle(get('/projects/KD'));
    assert.equal(empty.status, 200);
    assert.match(empty.body, /まだ潮流がありません/);
    assert.match(empty.body, /<details class="panel" open>/);
    // The inline client script always names the selector, so match the element itself.
    assert.doesNotMatch(empty.body, /class="graph-viewport"/);
    const unknown = await app.handle(get('/projects/KD?variant=missing&view=detail'));
    assert.match(unknown.body, /選択された亜流はこのプロジェクトにありません/);
  });

  it('returns to the same variant and tab after a form post, with the failure reason', async () => {
    const { deps } = testDeps();
    const s = await seedProject(deps);
    const app = createApp(deps);
    const ok = await app.handle(postForm(`/projects/KD/variants/${s.variant.id}/comments`, { author: 'p', body: 'たのしい' }));
    assert.equal(ok.status, 303);
    const okUrl = new URL(ok.headers.location as string, 'http://x');
    assert.equal(okUrl.searchParams.get('variant'), s.variant.id);
    assert.equal(okUrl.searchParams.get('view'), 'detail');
    assert.equal(okUrl.searchParams.get('tab'), 'talk');
    const failed = await app.handle(postForm(`/projects/KD/variants/${s.variant.id}/comments`, { author: 'p', body: '' }));
    const failedUrl = new URL(failed.headers.location as string, 'http://x');
    assert.equal(failedUrl.searchParams.get('tab'), 'talk');
    assert.ok(failedUrl.searchParams.get('error'));
    const shown = await app.handle(get(`${failedUrl.pathname}${failedUrl.search}`));
    assert.match(shown.body, /role="alert"/);
  });

  it('keeps technical settings folded and does not claim Cf Flow is enabled', async () => {
    const { deps } = testDeps();
    await seedProject(deps);
    const res = await createApp(deps).handle(get('/projects/KD'));
    assert.match(res.body, /<details class="settings">/);
    assert.doesNotMatch(res.body, /Cf Flow 有効/);
  });

  it('lists projects as cards and explains the empty index', async () => {
    const { deps } = testDeps();
    const app = createApp(deps);
    assert.match((await app.handle(get('/'))).body, /プロジェクトはまだありません/);
    await seedProject(deps);
    assert.match((await app.handle(get('/'))).body, /class="project-card" href="\/projects\/KD"/);
  });
});

describe('web assets (CF-WEB-001)', () => {
  it('ships a helper script that parses and cannot close its own tag', () => {
    assert.doesNotThrow(() => new Function(CLIENT_SCRIPT));
    assert.doesNotMatch(CLIENT_SCRIPT, /<\/script/i);
    assert.doesNotMatch(CLIENT_SCRIPT, /fetch\(|XMLHttpRequest/);
  });

  it('declares tap targets, 16px inputs, focus rings and the pane breakpoint', () => {
    assert.match(STYLE, /--tap:44px/);
    assert.match(STYLE, /input, textarea, select \{[^}]*font-size:16px/);
    assert.match(STYLE, /:focus-visible \{ outline:3px/);
    assert.match(STYLE, /@media \(min-width: 960px\)/);
    assert.match(STYLE, /body \{[^}]*overflow-wrap:anywhere/);
    assert.match(STYLE, /\.table-scroll \{ overflow-x:auto/);
  });
});
