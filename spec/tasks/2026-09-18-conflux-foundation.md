# Conflux (Cf) 本体の初期実装: 潮流グラフ・対話評価・合流判断・Cc 連携・試遊成果物

- 日付: 2026-09-18
- ブランチ: `feature/conflux-foundation` (ローカル `main` 14ccd00 起点。リモート未設定)
- 委託: Concordia delegation run `b4ffd591-dd68-4a98-ac83-05748cab6808` / Memoria task 2729
- 設計の出典: Pf プロジェクト `01M2RZXD2WVGQP0NKXEE9WRYZ1` (7 ドメイン・12 仕様 draft)、UX 原典 CDGD

## 目的

CDGD (遊ぶ → 話す → 案を選ぶ → Cc で実装 → 成果物で確かめる → 次の対話) を回すための Conflux 本体を、
プロジェクト中心のグラフビューを入口として実装する。潮流/亜流/本流とルール差分、コメントとゲーム内
デバッグ投稿・プレイした版に紐付く評価、合流 (正式ルール採否) の判断、事前設定した宛先への Cc spawn、
Cc フック連動の自動ビルドと成果物 DL、管理職以上に限定したデプロイを、Rv/GitHub ワークフローから独立して扱う。
Cc 側の未配備機能は「未接続」と表示し、架空の成功を作らない。

## 完了条件

- spec/ux/product.md、spec/architecture、spec/domains (8 ドメイン、src/tests 所属付き)、spec/feature (7 ドメイン) に価値 ID・所有者・不変条件を宣言している。
- 7 ドメインの業務判断が純関数、手順が use case、I/O が adapter に分かれている。
- 潮流・亜流・本流・分岐・合流をグラフで表示し、選択した亜流のコンセプト・改修・ルール差分・コメント/評価・成果物・作業依頼・合流判断を同じ id から表示する。
- Cc 連携契約 (`project_codes.conflux_flow`、`POST /v1/harness/conflux/select`) の adapter があり、未配備・接続不可を「未接続」として記録する。KD/Mp を有効化済みと表示しない。
- 本流の物理命名・評価尺度・デプロイ環境/役職名はプロジェクト設定のデータで指定し、未設定なら該当操作を拒否する。
- テストコードと `cc.acceptance.json` / `augur.contracts.json` (C-1〜C-14) の対応がある。
- 静的型検査 (tsc --noEmit) が通り、Anatomia verify の結果を PR に記載している。テスト実行・起動・デプロイ・push は行わない。

## 実装範囲

| ドメイン | 主なファイル |
|---|---|
| evolution-streams | `src/evolution-streams/**` (流れモデル、ブランチ命名、グラフ投影/配置、比較、画面読み取りモデル) |
| play-feedback | `src/play-feedback/**` (コメント/AI 整理/返信、デバッグ投稿受付、評価、意見の追跡) |
| adoption-decisions | `src/adoption-decisions/**` (採否、統合報告) |
| project-workspaces | `src/project-workspaces/**` (設定、Cf Flow 観測) |
| implementation-requests | `src/implementation-requests/**` (spawn 依頼、照合) |
| playable-results | `src/playable-results/**` (ビルド依頼/イベント、結果状態、デプロイ認可) |
| flow-isolation | `src/flow-isolation/**` (Cc harness 選択、切替前の判定) |
| platform-foundation | `src/shared/*`, `src/adapters/**`, `src/main.ts`, `contracts/*` |

## 未配備・残件

- Cc PR #1893 (conflux_flow、harness select) の配備と KD/Mp の Cf 有効化。
- Cc 側に必要な追加 API: Cf からの spawn / spawn 照会 / ビルド要求 / ビルドイベントと統合完了の Cf への通知配線 / 役職照会 (spec/architecture/cc-integration.md)。
- 本流の物理命名、評価尺度、ビルド平台・保持、デプロイ先と役職対応、合流の承認手順 (人間判断待ち)。
- KD/Mp のデバッグ画面からの投稿実装 (各ゲーム側)。
- Revisor への Conflux リポ登録とリモート設定 (新規リポのため)。
- テストの実行 (今回は許可なし)。
