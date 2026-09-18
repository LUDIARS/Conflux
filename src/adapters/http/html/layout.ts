import { CLIENT_SCRIPT } from './client-script.ts';
import { esc } from './escape.ts';
import { STYLE } from './styles.ts';

const OFFLINE_BANNER = '<p class="banner warn" data-offline-banner role="status" hidden>通信できません。接続が戻るまで送信を止めています (入力内容はこの画面に残ります)。</p>';

export function page(title: string, body: string): string {
  return `<!doctype html>
<html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title><style>${STYLE}</style></head>
<body><a class="skip-link" href="#main">本文へ移動</a>${OFFLINE_BANNER}${body}<script>${CLIENT_SCRIPT}</script></body></html>`;
}

export function errorBanner(message: string | null): string {
  return message ? `<p class="banner bad" role="alert">操作できませんでした: ${esc(message)}</p>` : '';
}
