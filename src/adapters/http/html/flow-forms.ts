import type { Tide, Variant } from '../../../evolution-streams/domain/model.ts';
import { esc } from './escape.ts';
import { field, option, submit } from './form-controls.ts';

function tideForm(code: string): string {
  return `<form method="post" action="/projects/${code}/tides"><h3>潮流</h3>
${field('識別名', '<input name="slug" required autocapitalize="off" spellcheck="false">', '英小文字')}
${field('名前', '<input name="title" required>')}
${field('コンセプト', '<textarea name="concept" rows="3" required></textarea>')}
${submit('潮流を作る')}</form>`;
}

function variantForm(code: string, tides: readonly Tide[], variants: readonly Variant[]): string {
  if (tides.length === 0) return '';
  const tideOptions = tides.map((t) => option(t.id, t.title)).join('');
  const parents = variants.map((v) => option(v.id, v.title)).join('');
  return `<form method="post" action="/projects/${code}/variants"><h3>亜流</h3>
${field('潮流', `<select name="tideId">${tideOptions}</select>`)}
${field('識別名', '<input name="slug" required autocapitalize="off" spellcheck="false">', '英小文字')}
${field('名前', '<input name="title" required>')}
${field('コンセプト', '<textarea name="concept" rows="3" required></textarea>')}
${field('ルール', '<textarea name="rules" rows="3"></textarea>', '1 行 1 件: キー: 内容')}
${field('分岐元', `<select name="branchedFromVariantId">${option('', '分岐元なし')}${parents}</select>`)}
${field('分岐点コミット (任意)', '<input name="branchedFromCommit" autocapitalize="off" spellcheck="false">')}
${submit('亜流を作る')}</form>`;
}

/** Creation forms, folded by default so they do not crowd the graph; open when the project is empty. */
export function renderFlowForms(projectCode: string, tides: readonly Tide[], variants: readonly Variant[]): string {
  const code = esc(encodeURIComponent(projectCode));
  return `<details class="panel"${tides.length === 0 ? ' open' : ''}><summary>流れを増やす (潮流・亜流の作成)</summary>
${tideForm(code)}${variantForm(code, tides, variants)}</details>`;
}
