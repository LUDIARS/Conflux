# Web UI (表示・入力 adapter)

対応仕様: Pf CF-WEB-001 (`01M2SMDQD5060SPPKSK6QFTSCG`)、CF-DESIGN-001 の Web/Tela 方針。価値: CF-UX-1〜4 の入口。
所属ドメイン: platform-foundation (`src/adapters/http/html/**`、`tests/adapters/**`)。
**以下の受入基準は設計案であり、ブラウザ・実機での達成確認は未実施 (未確認)。**

## 位置付け

Conflux は WebUI と Tela のオーバーレイ UI の両方を持つ。どちらも同じ use case と読み取りモデル
(`loadProjectOverview` ほか 7 ドメインの application) を使う **表示・入力 adapter** であり、
業務ルール・履歴・権限判定を UI ごとに複製しない。業務状態の所有者は既存 7 ドメインのまま。

| UI | 範囲 | 状態 |
|---|---|---|
| Web (`src/adapters/http/html/**`) | PC とスマホのブラウザ。SSR HTML + 最小の補助スクリプト | 今回実装 |
| Tela overlay | Tela ホストへの接続とオーバーレイ表示 | **後続 (未実装)**。Web と同じ use case / read model を呼ぶ別 adapter として追加する |

権限 (デプロイの管理職以上など) はサーバー側の use case が Cc の応答で判定する。UI は判定しない。
実接続できない spawn / ビルド / デプロイ / harness 選択は UI でも成功表示しない (I-3)。

## 画面構成

プロジェクト選択 (`GET /`) → 流れのグラフ (`GET /projects/:code`) → 選択した潮流/亜流の詳細。

- **PC (幅 960px 以上)**: グラフ面と詳細面を横に並べ、見比べられる。グラフ面は画面上部に留める。
- **スマホ・タブレット (960px 未満)**: 1 面ずつ表示し、「グラフ / 詳細」の切替で行き来する。
  切替・タブ・拡大率の変更は同じ選択 id (`variant`) を保つ。
- 詳細はタブで 6 区分に分ける: コンセプト / ルール差分 (比較・改修) / 対話 (コメント・評価) /
  成果物 (ビルド・デプロイ) / 作業依頼 (Cc spawn) / 合流判断。
- グラフを補う **流れ一覧** (潮流ごとの亜流一覧) も同じ `variant` へ遷移する。
- 技術設定 (Cf Flow の Cc 報告・本流命名・再照会) は折りたたみに置き、初期画面の主役にしない。

## 画面状態 (URL)

`/projects/:code?variant=<id>&view=graph|detail&tab=<tab>&zoom=fit|0.5|0.75|1|1.5|2&compare=<id>`

- 状態は URL だけが持つ (サーバー状態を増やさない)。リロード・共有・戻る操作で同じ画面になる。
- 不正な `view` / `tab` / `zoom` は既定値 (`graph` / `concept` / `1`) に戻す。
- POST 後の再表示 (PRG) は同じ `variant` と、操作した区分のタブ・`view=detail` へ戻す。

## グラフ操作

- 全体表示 (`zoom=fit`)・拡大・縮小・等倍をリンクで提供する (JS 無しでも動く)。
- グラフ領域は内部スクロールで移動でき、文書全体は横にはみ出さない。移動ボタン (上下左右) は
  補助スクリプトで有効化し、スクロール領域はキーボード (矢印、`+` / `-` / `0`) でも操作できる。
- touch だけ・hover だけに依存する操作を必須にしない。ノード名はリンクの accessible name と
  `<title>` に全文を持ち、長い名前は図上で省略する。

## 受入基準案 (未確認)

| ID | 基準 | 確認方法 |
|---|---|---|
| W-1 | 幅 320 / 390 / 768 / 1280px で文書全体の横はみ出しがない (グラフ領域の内部移動は可) | ブラウザ実測 (未実施) |
| W-2 | 主操作のタップ領域 44px 以上、入力欄の文字 16px 以上 | CSS の静的確認 (テスト記述済み・未実行) と実測 (未実施) |
| W-3 | 表示切替・タブ・拡大率・流れ一覧の操作で選択 id を失わない | 単体テスト記述済み・未実行 |
| W-4 | 全入力に label、フォーカス表示、キーボード操作 | 静的テスト記述済み・未実行、支援技術での確認は未実施 |
| W-5 | 長いタイトル・ブランチ名・コメント、多数ノード、空状態、存在しない選択、送信失敗/オフラインを扱う | 単体テスト記述済み・未実行、実機は未実施 |

## 実装

| 役割 | ファイル |
|---|---|
| 画面状態 (URL の解析・生成) | `src/adapters/http/html/view-state.ts` |
| 拡大率 | `src/adapters/http/html/graph-zoom.ts` |
| SVG 描画・ラベル省略 | `graph-svg.ts`, `svg-label.ts` |
| グラフ操作領域 | `graph-viewport.ts` |
| 流れ一覧 | `flow-list.ts` |
| グラフ面 / 詳細面 / タブ | `graph-pane.ts`, `detail-pane.ts`, `detail-tabs.ts`, `tab-panels.ts` |
| 見出し・設定 | `project-header.ts` |
| フォーム部品 | `form-controls.ts`, `variant-forms.ts`, `flow-forms.ts` |
| 骨格・CSS・補助スクリプト | `layout.ts`, `styles.ts`, `client-script.ts` |
| プロジェクト一覧 | `project-index.ts` |

テスト: `tests/adapters/web-ui.test.ts`, `tests/adapters/http-app.test.ts`。
