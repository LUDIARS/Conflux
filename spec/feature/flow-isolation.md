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

## 未決

選択亜流の本流と repository main の関係 (Cf 潮流作業の起点) は通常フローの main 起点規則と区別して確定する必要がある。
Cf は baseBranch を渡すだけで履歴を付け替えない。
