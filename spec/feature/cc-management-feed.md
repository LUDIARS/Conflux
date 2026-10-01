# Cc マネジメント変更列への通知

2026-10-01 neco 指示 (Cc の CDGD マネジメント層の後続 1)。Cc 側の契約は Cc
`spec/feature/cdgd-management.md` CC-MGMT-02 (Cc PR #2218 で配備済み)。

dots は Cc の変更列を読んで CDGD の次の作業を判断する。Cf に投稿された意見・評価を
その変更列へ届けるのがこのドメインの役割。意見そのものの正本と採否は
play-feedback / adoption-decisions が持ち、ここは通知だけを所有する。

## 契約 CF-MGMT-01

- 保存できたコメント・返信・AI 要約・評価 (Cf UI とデバッグ画面の両方) を 1 件ずつ outbox
  (`signals` コレクション) に積む。キーは `cf:comment:<id>` / `cf:rating:<id>` で、同じ記録は 1 回だけ積む。
- outbox 積みは投稿の保存後に行い、失敗しても投稿を取り消さない (ログに残す)。
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
- `src/cc-management-feed/application/signal-use-cases.ts`: 積む / 送る use case。
- `src/cc-management-feed/application/signal-delivery-loop.ts`: 送信間隔と停止。
- `src/adapters/cc/cc-management-events-gateway.ts`: Cc HTTP。
- `src/adapters/http/api/feedback-api.ts`: 保存成功後に積む。

## 未対応

- 返信の配送 (Cc 側の依頼セッションが Cf へ AI 返信を書く経路) は Cf の既存 comments API を使う。
  そのときは `authorKind=ai-summary` で投稿し、ここで origin=ai として Cc へ戻る。
- 採否・ビルド・試遊結果の通知は後続。
