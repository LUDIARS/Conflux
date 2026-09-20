# 正式ルールへの合流判断 (adoption-decisions)

対応仕様: CF-MERGE-001。価値: CF-UX-3, CF-UX-4。

## 所有

合流候補・採用/見送りの判断・対象版 (コミット・ビルド・成果物)・理由・判断材料コメント・判断時の評価要約。
コード統合完了の事実は Cc/Rv/GitHub から受け取るだけで、Cf は Git 統合を実行しない。

## 不変条件

- 採用は対象コミットの成功ビルドに成果物がある場合だけ記録できる (成果物のない結果は合流できない) (C-7)。
- 採用・見送りとも理由と判断者を必須とし、履歴は追記のみ (過去の流れを保存)。
- 採用直後は `awaiting` (採用済み・コード未統合)。同じコミットの統合報告が届くまで統合済みと表示しない (C-8)。
- 見送りは正式ルール系譜 (`officialLineage`) に入らない。

## 実装

`src/adoption-decisions/domain/{model,decision-rules}.ts`、`application/decision-use-cases.ts`。
UI: プロジェクト画面の「合流」フォーム、正式ルール一覧、グラフの合流辺 (未統合は破線)。
統合報告: `POST /api/hooks/integration` (Cc フック用共有トークン必須)。
テスト: `tests/adoption-decisions/decision.test.ts`。

## 未決

合流時の承認手順は 2026-09-20 に確定した。判断者名と理由の記録のみ必須で 1 名で成立し、
デプロイの管理職以上要件は転用しない。合流は「正式ルールにする」判断であって配布権限ではない。
Cc が統合事実を Cf へ通知する経路は Cc 側に未実装 (spec/architecture/cc-integration.md)。
