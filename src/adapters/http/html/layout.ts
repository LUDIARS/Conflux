import { esc } from './escape.ts';

const STYLE = `
:root { --bg:#f8fafc; --fg:#0f172a; --muted:#64748b; --card:#ffffff; --line:#cbd5e1; --accent:#3b82f6; --warn:#b45309; --bad:#b91c1c; --ok:#15803d; }
@media (prefers-color-scheme: dark) { :root { --bg:#0b1120; --fg:#e2e8f0; --muted:#94a3b8; --card:#111827; --line:#334155; --accent:#60a5fa; --warn:#f59e0b; --bad:#f87171; --ok:#4ade80; } }
* { box-sizing: border-box; }
body { margin:0; font-family: system-ui, "Segoe UI", "Hiragino Sans", sans-serif; background:var(--bg); color:var(--fg); }
header { padding:12px 16px; border-bottom:1px solid var(--line); display:flex; gap:16px; align-items:baseline; flex-wrap:wrap; }
main { padding:16px; display:grid; gap:16px; max-width:1280px; margin:0 auto; }
section { background:var(--card); border:1px solid var(--line); border-radius:8px; padding:12px 16px; overflow-x:auto; }
h1 { font-size:20px; margin:0; } h2 { font-size:16px; margin:0 0 8px; } h3 { font-size:14px; margin:12px 0 6px; }
.muted { color:var(--muted); } .warn { color:var(--warn); } .bad { color:var(--bad); } .ok { color:var(--ok); }
table { border-collapse: collapse; width:100%; font-size:13px; } td, th { border-bottom:1px solid var(--line); padding:4px 6px; text-align:left; vertical-align:top; }
form { display:grid; gap:6px; margin:8px 0; max-width:640px; } input, textarea, select { font:inherit; padding:4px 6px; }
button { font:inherit; padding:4px 10px; cursor:pointer; }
.badge { display:inline-block; padding:1px 6px; border-radius:10px; border:1px solid var(--line); font-size:12px; }
.thread { margin-left:16px; border-left:2px solid var(--line); padding-left:8px; }
.ai { border-left-color: var(--accent); }
svg text { fill: var(--fg); font-size:12px; }
`;

export function page(title: string, body: string): string {
  return `<!doctype html>
<html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title><style>${STYLE}</style></head>
<body>${body}</body></html>`;
}

export function errorBanner(message: string | null): string {
  return message ? `<section class="bad" role="alert">${esc(message)}</section>` : '';
}
