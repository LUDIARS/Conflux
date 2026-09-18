# Conflux (Cf) Web UI をレスポンシブ化し、PC とスマホで流れのグラフと詳細を行き来できるようにする

- 日付: 2026-09-18
- ブランチ: `feature/conflux-foundation` (前委託 b4ffd591 の同じ Cf 基盤作業の続き。ローカル `main` 起点、リモート未設定)
- 委託: Concordia delegation run `c82e9586-bb9c-41ab-a3ad-3e5fc42a8c7b` / Memoria task 2742
- 設計の出典: Pf CF-WEB-001 (`01M2SMDQD5060SPPKSK6QFTSCG`)、CF-DESIGN-001 の Web/Tela 方針、人間の指示 (2026-09-18)
  「Conflux は WebUI と Tela のオーバーレイ UI の両方を持つ。まずは WebUI 対応。スマホにも対応。」

## 目的

PC でもスマホでも、対象プロジェクトと流れを見失わずに、コンセプト・ルール差分・コメント/評価・試遊成果物を確認し、
作業依頼・合流判断へ進めるようにする。業務状態は既存 7 ドメインが持ち、Web は共通の use case / 読み取りモデルを使う
表示・入力 adapter とする。Tela オーバーレイ (ホスト接続・overlay 本体) は後続として範囲外にする。

## 完了条件

- C-15 projectViewHref(projectCode, state, patch): Web の表示切替・タブ・拡大率・流れ一覧のリンクは選択中の亜流 id を保持し、同じプロジェクトから出ない (CF-WEB-001)
- spec/ux/product.md・spec/architecture/overview.md・spec/feature/web-ui.md に Web/Tela 方針、画面構成、URL 状態、受入基準案 (未確認) を記載している。
- platform-foundation の membership と specRefs に spec/feature/web-ui.md を登録している (src/tests は既存の `src/adapters/**` / `tests/adapters/**` に所属)。
- PC (960px 以上) はグラフと詳細を並べ、960px 未満は選択 id を保ったまま「グラフ / 詳細」を切り替えられる。
- 詳細はコンセプト / ルール差分 / 対話 / 成果物 / 作業依頼 / 合流判断のタブで、POST 後は同じ亜流・操作したタブへ戻る。
- グラフに全体表示・拡大・縮小・等倍 (JS 無しで動くリンク) と移動ボタン (補助スクリプト) があり、内部スクロールとキーボードでも操作できる。流れ一覧も同じ選択へ遷移する。
- 全入力に label、フォーカス表示、44px の操作領域、16px の入力文字を持つ。長い名前・多数ノード・空状態・存在しない選択・送信失敗・オフラインを表示で扱う。
- 技術設定 (Cf Flow の Cc 報告・本流命名・再照会) は折りたたみに置き、Cf Flow を有効と表示しない。権限判定は UI で行わない。
- テストコード (tests/adapters/web-ui.test.ts) を同じ変更で記述し、静的型検査と Anatomia verify を行っている。

## 未確認・残件

- テスト実行とレイアウト実測は後続 run 93f63b06 で実施 (`2026-09-18-conflux-web-ui-verification.md`)。Augur 契約集計は未了。
- フォーカス順、スクリーンリーダー、実機タッチ操作は未評価。
- Tela ホスト接続・オーバーレイ表示は後続 (`src/adapters/tela/**` 予定)。
- Cf のリモート設定と Revisor 登録は未了 (repository_not_registered)。
