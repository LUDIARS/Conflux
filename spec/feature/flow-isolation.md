# 流れごとの作業分離 (flow-isolation)

対応仕様: CF-HARNESS-001 (Cf 側)。価値: CF-UX-4。

## 所有

Cf で選んだ project/潮流/亜流から Cc harness へ渡す選択 `{projectCode, tide, variant, baseBranch, workBranch}` の組み立てと、
その登録結果の履歴。実ブランチの照合・警告・切替は Cc フック (PR #1893) の責務で、Cf は重複実装しない。
通常フローの main 起点/PR 後二重チェックは Cc の共通基盤で、Cf から解除しない。

## 不変条件

- `baseBranch` は亜流の本流 (命名方式はプロジェクト設定で明示)、`workBranch` は `feature/<潮流>/<亜流>/<task>`。命名未設定なら選択を作らない。
- `projectCode` は Cc 側のプロジェクトコードを渡す。
- Cc の応答を記録どおりに残す: 404/405/接続不可 = 未接続、5xx/タイムアウト = 結果不明、4xx = 拒否。
- 表示用の事前判定 `assessCheckout` は、未コミット変更があるとき切替可能と判定しない (C-14)。

## 実装

`src/flow-isolation/domain/{selection,selection-record}.ts`、`ports.ts`、`application/selection-use-cases.ts`、
Cc adapter `src/adapters/cc/cc-harness-gateway.ts`。API: `POST /api/projects/:code/selections`。
テスト: `tests/flow-isolation/selection.test.ts`, `tests/adapters/cc-gateways.test.ts`。

## 作業の起点 (2026-09-26 確定)

Cf フローの作業起点は**選択した亜流の本流**であり、repository main ではない。
要件 9「通常フローでも起点は main」に対する明示的な例外で、通常フローの規則は変えない。

潮流は「ルールを変えて試す枝」なので、亜流の本流こそがその試行の現在地にあたる。repository main から
切り直せば試した変更が毎回消え、亜流を並行させる意味そのものが無くなる。

Cf は `baseBranch` に亜流の本流を入れて Cc へ渡すだけで、履歴の付け替え (rebase・切り直し) はしない。
repository main に居るときは「流れ外」と判定し、未コミット変更が無ければ作業ブランチへ切り替える。
