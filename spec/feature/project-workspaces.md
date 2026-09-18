# プロジェクト設定 (project-workspaces)

対応仕様: CF-PROJECT-001。価値: CF-UX-4。

## 所有

Cf プロジェクト設定: 名前、Cc プロジェクトコード、本流命名、事前 spawn 先 (子会社/Discord/Slack)、評価尺度、
ビルド契機/平台、デプロイ環境/管理職ロール名、デバッグ投稿の受付可否。
Cf Flow の有効/無効 (`project_codes.conflux_flow`) と役職の正本は Cc。Cf は観測値を保存するだけ。

## 不変条件

- Cf の設定変更は Cc 由来の Cf Flow 観測を変えない。新規プロジェクトは「状態不明」で始まる (C-9)。
- `conflux_flow === true` の報告だけを「有効」とする。フィールドが無い Cc は「未接続 (未配備)」。
- Rv/GitHub のワークフロー選択は Cf の設定に存在せず、Cf から変更できない。
- spawn 先は種別ごとの必須アドレス (subsidiaryId / guildId+channelId / workspaceId+channelId) を持つ。
- KD と Mp の設定・流れ・成果物はプロジェクトコードで分離される (全 RecordStore が projectCode で絞る)。

## 実装

`src/project-workspaces/domain/{model,workspace-rules,flow-observation}.ts`、`ports.ts`、
`application/workspace-use-cases.ts`。設定 API: `PUT /api/projects/:code`、Cc 再照会:
`POST /api/projects/:code/flow-status/refresh`。テスト: `tests/project-workspaces/*.test.ts`。

## 未配備

KD/Mp の Cf 有効化は Cc API (PR #1893) 配備後の残件。現時点で Cf は KD/Mp を有効と表示しない。
KD/Mp のプロジェクト設定値 (spawn 先・評価尺度・環境・役職名) は未提供で、本 PR ではデータ投入しない。
