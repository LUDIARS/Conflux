/**
 * Page CSS. Breakpoint: below 960px one pane is shown at a time (graph / detail switch),
 * from 960px graph and detail sit side by side. The document itself never scrolls
 * sideways; wide content (graph, tables) scrolls inside its own box.
 */
export const WIDE_BREAKPOINT_PX = 960;

export const STYLE = `
:root { --bg:#f8fafc; --fg:#0f172a; --muted:#475569; --card:#ffffff; --line:#cbd5e1; --accent:#2563eb; --accent-fg:#ffffff; --focus:#f59e0b; --warn:#b45309; --bad:#b91c1c; --ok:#15803d; --tap:44px; }
@media (prefers-color-scheme: dark) { :root { --bg:#0b1120; --fg:#e2e8f0; --muted:#94a3b8; --card:#111827; --line:#334155; --accent:#60a5fa; --accent-fg:#0b1120; --focus:#fbbf24; --warn:#f59e0b; --bad:#f87171; --ok:#4ade80; } }
* { box-sizing: border-box; }
html { -webkit-text-size-adjust: 100%; }
body { margin:0; font-family: system-ui, "Segoe UI", "Hiragino Sans", "Noto Sans JP", sans-serif; font-size:15px; line-height:1.6; background:var(--bg); color:var(--fg); overflow-x:hidden; overflow-wrap:anywhere; }
h1 { font-size:20px; margin:0; } h2 { font-size:18px; margin:0 0 8px; } h3 { font-size:16px; margin:16px 0 8px; } h4 { font-size:14px; margin:12px 0 6px; }
p { margin:6px 0; }
a { color:var(--accent); }
code { font-size:13px; overflow-wrap:anywhere; word-break:break-all; }
.muted { color:var(--muted); } .warn { color:var(--warn); } .bad { color:var(--bad); } .ok { color:var(--ok); } .small { font-size:13px; }
:focus-visible { outline:3px solid var(--focus); outline-offset:2px; }
svg a.graph-node:focus-visible rect { stroke:var(--focus); stroke-width:4; }
.skip-link { position:absolute; left:8px; top:-60px; background:var(--card); padding:8px 12px; z-index:10; }
.skip-link:focus { top:8px; }
.topbar { padding:8px 16px; border-bottom:1px solid var(--line); background:var(--card); display:flex; flex-wrap:wrap; gap:4px 16px; align-items:center; justify-content:space-between; }
.crumbs { min-width:0; display:flex; flex-wrap:wrap; align-items:center; gap:0 4px; }
.crumbs a { display:inline-flex; align-items:center; min-height:var(--tap); }
.settings { max-width:100%; }
.settings summary { min-height:var(--tap); display:flex; align-items:center; gap:8px; cursor:pointer; }
.settings-body { padding:4px 0 8px; }
.banner { margin:0 0 12px; padding:10px 12px; border:1px solid currentColor; border-radius:8px; background:var(--card); }
[data-offline-banner] { margin:8px 16px; }
main { padding:12px 16px 32px; max-width:1440px; margin:0 auto; }
.pane { background:var(--card); border:1px solid var(--line); border-radius:10px; padding:12px 16px; min-width:0; }
.panes { display:grid; grid-template-columns:minmax(0,1fr); gap:16px; }
.pane section { border-top:1px solid var(--line); margin-top:12px; padding-top:4px; }
.empty { padding:16px 0; }
.narrow-only { display:block; }
.view-switch { display:grid; grid-template-columns:1fr 1fr; gap:4px; margin:0 0 12px; position:sticky; top:0; z-index:5; background:var(--bg); padding:4px 0; }
.switch { display:flex; align-items:center; justify-content:center; gap:6px; min-height:var(--tap); padding:4px 8px; border:1px solid var(--line); border-radius:8px; background:var(--card); text-decoration:none; color:var(--fg); min-width:0; }
.switch[aria-current="page"] { background:var(--accent); color:var(--accent-fg); border-color:var(--accent); }
.switch-title { font-size:12px; opacity:.85; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:60%; }
.workspace[data-view="graph"] .pane-detail { display:none; }
.workspace[data-view="detail"] .pane-graph { display:none; }
.back-link { min-height:var(--tap); align-items:center; }
.back-link.narrow-only { display:flex; }
.graph-toolbar { display:flex; flex-wrap:wrap; gap:4px; align-items:center; margin-bottom:6px; }
.tool { display:inline-flex; align-items:center; justify-content:center; min-width:var(--tap); min-height:var(--tap); padding:0 10px; border:1px solid var(--line); border-radius:8px; background:var(--card); color:var(--fg); text-decoration:none; font:inherit; cursor:pointer; }
.tool[aria-current="true"] { border-color:var(--accent); color:var(--accent); font-weight:600; }
.tool[aria-disabled="true"] { opacity:.4; cursor:default; }
.zoom-level { min-width:4em; text-align:center; }
.pan-group { display:inline-flex; gap:4px; }
.graph-scroll { overflow:auto; max-height:60vh; min-height:200px; border:1px solid var(--line); border-radius:8px; background:var(--bg); overscroll-behavior:contain; touch-action:pan-x pan-y; }
.graph-svg { display:block; }
.graph-svg.graph-rightward { display:none; }
/* Asking for the whole graph shrinks it at any width; the reader chose that over reading the labels. */
.graph-scroll.fit { overflow:hidden; }
.graph-scroll.fit .graph-svg { width:100%; height:auto; max-height:60vh; }
svg text { fill: var(--fg); font-size:12px; }
.legend { font-size:12px; display:flex; flex-wrap:wrap; gap:4px 10px; align-items:center; }
.swatch { display:inline-block; width:12px; height:12px; border-radius:3px; vertical-align:middle; }
.swatch.official { background:#8b5cf6; } .swatch.tide { background:#3b82f6; } .swatch.variant { background:#22c55e; }
.line { display:inline-block; width:18px; border-top:2px dashed #f59e0b; vertical-align:middle; } .line.merged { border-top:2px solid #8b5cf6; }
.flow-list ul { list-style:none; margin:0; padding:0; }
.flow-tide { margin:8px 0; }
.flow-tide-title { font-weight:600; }
.flow-item { display:flex; flex-direction:column; justify-content:center; min-height:var(--tap); padding:6px 10px; border:1px solid var(--line); border-radius:8px; margin:4px 0; text-decoration:none; color:var(--fg); }
.flow-item[aria-current="true"] { border-color:var(--accent); box-shadow:inset 4px 0 0 var(--accent); }
.flow-concept { font-size:13px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.panel { margin-top:12px; border-top:1px solid var(--line); padding-top:4px; }
.panel > summary { min-height:var(--tap); display:flex; align-items:center; cursor:pointer; font-weight:600; }
ul.plain { padding-left:18px; }
.detail-head h2 { font-size:20px; margin:0; }
.branch code { display:inline-block; padding:2px 6px; border:1px solid var(--line); border-radius:6px; }
.tabs ul { list-style:none; margin:8px 0; padding:0; display:grid; grid-template-columns:repeat(3, minmax(0,1fr)); gap:4px; }
.tab { display:flex; align-items:center; justify-content:center; gap:4px; min-height:var(--tap); padding:4px 6px; border:1px solid var(--line); border-radius:8px; text-decoration:none; color:var(--fg); text-align:center; }
.tab[aria-current="page"] { background:var(--accent); color:var(--accent-fg); border-color:var(--accent); }
.count { font-size:12px; border-radius:10px; padding:0 6px; border:1px solid currentColor; }
.table-scroll { overflow-x:auto; max-width:100%; }
table { border-collapse: collapse; width:100%; font-size:13px; }
td, th { border-bottom:1px solid var(--line); padding:6px; text-align:left; vertical-align:top; min-width:6em; }
form { display:grid; gap:10px; margin:8px 0; max-width:640px; }
.inline-form { grid-template-columns:minmax(0,1fr); }
.field { display:grid; gap:4px; }
.field-label { font-weight:600; font-size:14px; }
.field-hint { font-size:13px; }
input, textarea, select { font:inherit; font-size:16px; min-height:var(--tap); padding:8px 10px; border:1px solid var(--line); border-radius:8px; background:var(--card); color:var(--fg); width:100%; max-width:100%; }
textarea { min-height:88px; resize:vertical; }
input[type="checkbox"] { width:24px; min-height:24px; height:24px; }
.check { display:flex; align-items:center; gap:8px; min-height:var(--tap); }
button, .button-link { font:inherit; min-height:var(--tap); padding:8px 16px; border:1px solid var(--line); border-radius:8px; background:var(--card); color:var(--fg); cursor:pointer; display:inline-flex; align-items:center; justify-content:center; text-decoration:none; }
button.primary { background:var(--accent); color:var(--accent-fg); border-color:var(--accent); justify-self:start; }
.badge { display:inline-block; padding:1px 6px; border-radius:10px; border:1px solid var(--line); font-size:12px; }
.thread { margin-left:12px; border-left:2px solid var(--line); padding-left:8px; }
.ai { border-left-color: var(--accent); }
.project-list { list-style:none; padding:0; margin:0; display:grid; gap:8px; grid-template-columns:repeat(auto-fill, minmax(min(100%, 260px), 1fr)); }
.project-card { display:flex; flex-direction:column; gap:2px; min-height:var(--tap); padding:12px; border:1px solid var(--line); border-radius:10px; text-decoration:none; color:var(--fg); }
@media (min-width: ${WIDE_BREAKPOINT_PX}px) {
  .narrow-only, .back-link.narrow-only { display:none; }
  .panes { grid-template-columns:minmax(0,1.1fr) minmax(0,1fr); align-items:start; }
  .workspace[data-view] .pane-graph, .workspace[data-view] .pane-detail { display:block; }
  .pane-graph { position:sticky; top:12px; max-height:calc(100vh - 24px); overflow-y:auto; }
  .tabs ul { grid-template-columns:repeat(6, minmax(0,1fr)); }
  .graph-scroll { max-height:55vh; }
  .graph-svg.graph-rightward { display:block; }
  .graph-svg.graph-upward { display:none; }
  /*
   * The entry view on a wide screen: the rightward graph is short and grows sideways, so it is
   * brought inside the pane rather than left reaching past the right edge where a reader arriving
   * at the project would never see it. A narrow screen keeps the drawn size and scrolls, because
   * squeezing the upward graph into a phone pane shrinks its labels past reading.
   */
  .graph-scroll.auto { overflow:hidden; }
  .graph-scroll.auto .graph-svg.graph-rightward { width:100%; height:auto; max-height:60vh; }
}
@media (prefers-reduced-motion: reduce) { * { scroll-behavior:auto !important; } }
`;
