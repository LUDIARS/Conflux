# 改善案の作業化 (implementation-requests)

対応仕様: CF-SPAWN-001。価値: CF-UX-1, CF-UX-3。

## 所有

Cf の作業依頼 (題名・改善内容・作業名・元コメント・宛先・流れ選択)、Cc セッション参照、依頼同一性、
結果不明の照合。セッション起動と宛先の所属/配送は Cc に委譲する。

## 状態

`pending` → `requested` (送信直前に保存) → `spawned` / `rejected` / `unknown` / `not_sent`。
`not_sent` は Cc 経路未接続で何も届いていない状態。`unknown` と `requested` は照合 (`lookup`) が先。

## 不変条件

- 宛先はプロジェクトに事前設定したものだけ。元コメントは同じプロジェクトのものだけ。
- 同一性キー `cf-spawn:<project>:<variant>:<task>` が同じ依頼は新規作成せず既存を返す。
- 送った可能性がある依頼 (`requested` / `unknown`) を照合なしに再送しない (C-10)。Cc が不在を確認した場合だけ再送できる。
- spawn 受理後、同じ流れ選択を Cc harness (`POST /v1/harness/conflux/select`) に登録し、その結果も記録する。

## 実装

`src/implementation-requests/domain/{model,request-rules}.ts`、`ports.ts`、`application/request-use-cases.ts`。
Cc adapter: `src/adapters/cc/cc-spawn-gateway.ts`。テスト: `tests/implementation-requests/*.test.ts`。

## 未配備

Cc 側に Cf 用 spawn API と照会 API が無い。`CONFLUX_CC_SPAWN_PATH` / `CONFLUX_CC_SPAWN_LOOKUP_PATH`
が設定されるまで依頼は `not_sent` (未接続) になる。必要 API は spec/architecture/cc-integration.md。
