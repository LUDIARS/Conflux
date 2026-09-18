# Cc (Concordia) との境界

Cc はセッション・フック・所属/配送・役職の正本。Rv/GitHub はレビュー/コード統合の正本。
Cf はゲームの流れ・意見・採否・成果物への到達を扱う。Cf から Cc の共通保護
(通常フローの main 起点、PR 後二重チェック) を解除する経路は持たない。

## 確定済みの契約 (Cc 側 PR #1893、審査待ち・未配備)

| 用途 | Cc API | Cf adapter |
|---|---|---|
| Cf Flow 有効/無効 | `GET /v1/project-codes` の各要素 `conflux_flow: boolean` | `src/adapters/cc/cc-project-registry.ts` |
| 作業ブランチ選択 | `POST /v1/harness/conflux/select` `{session_id, selection:{projectCode, tide, variant, baseBranch, workBranch}}` | `src/adapters/cc/cc-harness-gateway.ts` |

- `baseBranch` は `evolution/<潮流>/<亜流>` または末尾 `/main` をプロジェクト設定 `branchNaming.mainline` で明示する。
- `workBranch` は `feature/<潮流>/<亜流>/<task>`。
- `conflux_flow` フィールドが無い応答 (未配備の Cc) は `not_connected`、接続不可は `not_connected`、
  5xx/タイムアウトは `unknown`。`true` を受け取った場合だけ「有効」と表示する。
- `select` が 404/405 を返す、または接続できない場合は `not_connected` (送信は成立していない)。

## 未定義の経路 (残件: Cc 側に追加が必要)

Cf はこれらの経路を port として定義し、HTTP adapter は Cc 側のパスが設定されるまで
`not_connected` を返す。パスを推測で埋めない。

| 用途 | 必要な Cc API (提案) | Cf の受け口/設定 |
|---|---|---|
| Cf からの spawn | 宛先 (子会社/Discord/Slack) と文脈を受け取り session を起動し、`idempotencyKey` で重複を照合する API。応答は `{accepted, session_id, run_id}` | `CONFLUX_CC_SPAWN_PATH` / `CONFLUX_CC_SPAWN_LOOKUP_PATH` |
| spawn 結果照会 | `idempotencyKey` から session/run を引く API (結果不明の照合用) | 同上 |
| ビルド要求 | Cf Flow の契機 (亜流本流の commit 更新など) で Cc フックがビルドを起動する API。`dedupeKey` で重複抑止 | `CONFLUX_CC_BUILD_PATH` |
| ビルドイベント通知 | Cc フック → Cf `POST /api/hooks/build-events` (Cf 側は実装済み)。Cc 側から呼ぶ配線と共有鍵の発行が必要 | `CONFLUX_HOOK_TOKEN` |
| 役職照会 | 本人/所属/役職を返す API (デプロイ時の管理職以上判定) | `CONFLUX_CC_IDENTITY_PATH` |
| 統合完了通知 | Rv/GitHub のマージ事実を Cc が Cf `POST /api/hooks/integration` へ通知 | `CONFLUX_HOOK_TOKEN` |

デプロイ先 (環境) とデプロイ実行手段は未確定のため、デプロイ gateway は常に `not_connected` を返す
実装だけを持つ (`src/adapters/deploy/unconfigured-deploy-gateway.ts`)。権限判定と履歴は実装済み。

## 認証

- Cf の人間向け操作は Cc の本人照会で得た actor を使う。照会経路が未配備の間は
  役職を必要とする操作 (デプロイ) を拒否し、その他の操作は入力された名前を記録する
  (設計上の仮定: 表示名は自己申告。正本の本人確認は Cc 配備後)。
- Cc フックからの受信 (`/api/hooks/*`) は `CONFLUX_HOOK_TOKEN` の Bearer 一致を必須とする。
  未設定なら受信を 503 で拒否する。
