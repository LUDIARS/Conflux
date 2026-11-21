# 改善提案から亜流を作成し、試遊結果で採否を判断する

Actio 参照 `actio:97a673b0-37fa-4712-911a-1e2ead26a936`（Gen5 Step 2、25a07589）

## 提案受付

`POST /api/hooks/proposals` は `proposalId`、`projectCode`、`title`、`summary`、`origin`（`ai`、`system`、`human`）、任意の `targetTide`（潮流の slug）と `evidence`（参照 ID やリンクの文字列配列）を受け取る。対象潮流が無ければ作成する。省略時はプロジェクト内の `proposals` 潮流を使用する。既存の潮流・亜流作成ルールを適用し、提案の出所と根拠を亜流に保存する。

同一プロジェクトで同じ `proposalId` を再送すると、初回の潮流・亜流を返す。初回は 201、再送は 200。判断記録が無い亜流、または保留中の亜流をアクティブとして数える。既存の手動作成分も含む。上限では 409 `variant_capacity_reached` を返し、枠が空いたあと同じ ID で再送できる。上限は提案受付に適用し、既存の手動作成は引き続き利用できる。

## ポリシーと評価

`PUT /api/projects/:code/autonomous-adoption/policy` は次の設定をプロジェクト単位で置き換える。省略フィールドには既定値を適用する。

| 設定 | 既定値 | 意味 |
| --- | --- | --- |
| `enabled` | false | true で評価結果の自動記録を許可 |
| `maxActiveVariants` | 3 | 1 以上のアクティブ亜流上限 |
| `minPlaytests` | 3 | 結果と重大障害有無を報告した試遊の最小件数 |
| `minRatings` | 3 | build と commit が一致する有効な評価の最小件数 |
| `minRatingScore` | 0.75 | 各評価の保存時尺度で 0〜1 に正規化した平均の下限 |
| `maxCriticalBugs` | 0 | 重大障害を報告した試遊の許容件数 |
| `maxFailureRate` | 0.20 | 結果が failed の記録の許容比率 |

`POST /api/projects/:code/variants/:id/auto-evaluate` は亜流の最新記録コミットと、同コミットの最新ビルドを評価する。採用には成功したビルドと試遊できる成果物が必須。ビルド失敗・未確定・成果物なしは再試行できる保留とする。別のビルドから試遊や評価を持ち越さない。

既存の `POST /api/hooks/playtest-results` では、任意の組 `outcome`（`passed` または `failed`）と `criticalBug`（真偽値）を追加できる。組のない既存形式は試遊履歴に残り、未計測として扱う。重大障害件数が上限を超えたら即時に棄却する。最低試遊件数に達した時点で失敗率が上限を超えた場合も棄却する。必要件数が不足すれば保留、必要件数を満たし平均評価が下限を下回れば棄却、各しきい値を満たせば採用する。比較は等号を含む。

自動判定 `adopt`、`hold`、`reject` は採否履歴の `adopted`、`held`、`declined` に対応する。判断は `origin: system`、判断者、対象版、試遊・評価 ID、理由とともに保存し、既存の採否 outbox へ登録する。採用はコード統合待ちとして扱い、統合事実は従来どおり統合報告で反映する。

人間の判断は旧データを含めて常に優先する。自動の採用と棄却は終端判断として再利用し、人間が上書きできる。保留は入力や設定が変わると再評価する。入力が等しい再送は同じ履歴を返し、outbox 登録も既存イベントキーで冪等に行う。無効時は自動記録せず評価口が状態を返す。

## Actio からの照会と認証

`GET /api/projects/:code/autonomous-adoption` は現在のポリシー、アクティブ数、提案から生成した亜流の参照、採否履歴を返す。`auto-evaluate` の応答は `kind`（`automatic`、`manual`、`disabled`）で区別し、判断がある場合は `decision` を含む。

上記の新規 API はすべて既存のフック認証（`Authorization: Bearer <CONFLUX_HOOK_TOKEN>`）を必要とする。トークン未設定は 503、認証不一致は 401。Actio と dots はこの経路で評価を要求できる。

## 受け入れ契約

- C-22 planProposal(input): 登録済み提案の亜流を再利用し、上限到達時に新しい潮流や亜流を作成しない
- C-23 assessAdoption(policy, evidence): 有効なポリシーと対象版の試遊可能ビルド、必要な試遊・評価、安全基準を満たした場合のみ採用する
- C-24 planAutoDecision(variant, evidence, assessment, fingerprint, stamp): 自動判断記録に対象版、判断主体、根拠 ID、理由を保持する
