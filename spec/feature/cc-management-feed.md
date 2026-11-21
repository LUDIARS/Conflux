# Cc マネジメント変更列への通知

2026-10-01 neco 指示 (Cc の CDGD マネジメント層の後続 1)。Cc 側の契約は Cc
`spec/feature/cdgd-management.md` CC-MGMT-02 (Cc PR #2218 で配備済み)。

dots は Cc の変更列を読んで CDGD の次の作業を判断する。Cf に保存された意見・評価・採否・
ビルド結果・試遊結果をその変更列へ届ける。各記録の正本は play-feedback、adoption-decisions、
playable-results が持つ。Gen5 Step2 は Actio `actio:3363b4c3-d670-4f25-8c70-137cbdf84c8c`。

## 契約 CF-MGMT-01

- 保存できたコメント・返信・AI 要約・評価 (Cf UI とデバッグ画面の両方) を 1 件ずつ outbox
  (`signals` コレクション) に積む。キーは `cf:comment:<id>` / `cf:rating:<id>` で、同じ記録は 1 回だけ積む。
- 採否は `kind=adoption`、`cf:adoption:<decisionId>`、現行の人間判断は `origin=human`。
  REST API と Web フォームの双方で、判断・理由・判断者と対象コミット（指定時）を伝え、判断時刻を使う。
  [自動採否](autonomous-adoption.md) は同じ契約を使い、`origin=system` で採用・保留・棄却を通知する。
- 終端ビルドは `kind=build`、`cf:build:<buildId>`、`origin=system`。成功・失敗と対象コミット、
  失敗概要（報告時）を伝え、保存した終端状態の更新時刻を使う。進行中や古いイベントは通知対象から外す。
- 試遊結果は `kind=playtest`、`cf:playtest:<resultId>`。報告の `human` / `ai` / `system`、
  ビルドの ID とコミット、試遊の要約、観測時刻を伝える。受信契約は [playable-results](playable-results.md#試遊結果の受信) を参照。
- 各通知は元の記録の保存後に積む。ビルドは成果物参照の保存も完了してから積む。outbox への書き込みが
  失敗しても元の保存は有効で、失敗はログに記録する。試遊結果の同一再送では不足している通知を補える。
- Cc 向けの `summary` は空白を正規化し、UTF-16 で 2000 文字以内に収める。
- 10 秒ごとに期限の来た entry を古い順に 1 件ずつ送り、結果を保存してから次へ進む。
- Cc は event_key で冪等なので、未接続・結果不明・5xx は同じキーで再送する
  (15 秒から倍々、上限 30 分)。2xx は delivered、4xx は refused で止める。
- AI 要約は `origin=ai`、人間のコメント・評価は `origin=human` で送る。Cc は根拠が AI 由来だけの
  依頼を拒否する (CC-MGMT-INV-06)。
- `project_code` は Cf のプロジェクトコード (ゲーム側。例: KD)、`target_key` は `variant/<variantId>`。
  dots の任務の対象プロジェクトはこのコードで指定する。
- 送り先は `CONFLUX_CC_MANAGEMENT_EVENTS_PATH` (既定 `/v1/management/events`)。`off` で送信を止める
  (outbox には積み続け、再開時に送る)。

## 実装

- `src/cc-management-feed/domain/signal-rules.ts`: 記録 → 通知の写像と送信後の状態遷移 (純関数)。
- `src/cc-management-feed/domain/outcome-signals.ts`: 採否・ビルド・試遊結果の通知の生成 (C-19〜C-21)。
- `src/cc-management-feed/application/signal-use-cases.ts`: 積む / 送る use case。
- `src/cc-management-feed/application/signal-delivery-loop.ts`: 送信間隔と停止。
- `src/adapters/cc/cc-management-events-gateway.ts`: Cc HTTP。
- `src/adapters/http/api/feedback-api.ts`: 保存成功後に積む。
- `src/adoption-decisions/application/decision-use-cases.ts` と `src/playable-results/application/` の
  各保存ユースケースが採否・ビルド・試遊結果の通知を積む。

## 未対応

- 返信の配送 (Cc 側の依頼セッションが Cf へ AI 返信を書く経路) は Cf の既存 comments API を使う。
  そのときは `authorKind=ai-summary` で投稿し、ここで origin=ai として Cc へ戻る。
- 試遊の実行元から Cf の試遊結果フックを呼ぶ配線は各報告元が管理する。
