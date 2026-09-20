# 試遊成果物と配布 (playable-results)

対応仕様: CF-ARTIFACT-001 / CF-BUILD-001 / CF-DEPLOY-001。価値: CF-UX-2。

## 所有

ビルド記録 (契機・同一性キー・状態・ログ参照)、成果物参照 (平台・DL/デプロイ種別・URI)、デプロイ履歴。
ビルドの実行は Cc フック、成果物本体の保管は Cf の外。

## 不変条件

- 同じ亜流・同じコミットのフロー契機は 1 件のビルド記録にまとまり、重複フックで再起動しない (C-12)。再実行は失敗/未接続の最新試行に対する人間の明示操作だけ。
- フックイベントは連番で適用し、古い/重複イベントは無視、終端状態 (成功/失敗) から戻らない。対象の project/亜流/コミットが違うイベントは拒否。
- 結果の完了は「対象版が成功し成果物がある」場合だけ。成功でも成果物が無ければ未完了。対象版が失敗したとき過去の成果物は「過去の版」として別表示し、最新成功と表示しない (C-11)。
- デプロイは毎回 Cc で本人/役職を照会し、`managerRoles` に該当する場合だけ許可する。UI と API の両方で同じ判定 (C-13)。
- デプロイは確認入力 (成果物 id と環境の再入力) を必須とし、自動ビルド成功だけでは実行しない。結果不明を成功と表示しない。

## 実装

`src/playable-results/domain/{model,build-requests,build-events,result-status,deploy-authorization}.ts`、
`ports.ts`、`application/{build-use-cases,deploy-use-cases,flow-trigger}.ts`。
フック受信: `POST /api/hooks/build-events` (Bearer `CONFLUX_HOOK_TOKEN` 必須、未設定なら 503)。
テスト: `tests/playable-results/*.test.ts`。

## 未決・未配備

- ビルド契機は `variant-mainline-updated` (本流ブランチへのコミット付き改修) を実装。`work-branch-submitted` は設定値のみで起動経路は未実装。
- 対応平台は 2026-09-20 に web と確定した (DL 無しで違いを遊び比べられるのが CF-UX-2 への最短路)。
  成果物は Cf が保管せず Cc が報告した URI を参照するだけで、保持は報告元に従う。値はプロジェクト
  設定のままで、未指定のときにこの既定が入る。
- Cc 側のビルド要求 API・フック配線・役職照会 API は未実装 (`CONFLUX_CC_BUILD_PATH` / `CONFLUX_CC_IDENTITY_PATH` 未設定の間は未接続)。
- デプロイ環境は 2026-09-20 に「試遊」1 つと確定した。**デプロイを許す Cc 役職名は未確定のまま**で、
  Cc に役職語彙も照会 API も無い。`managerRoles` が空である間デプロイは拒否され、実行手段としても
  `UnconfiguredDeployGateway` が常に「未接続 (未実行)」を返す。
