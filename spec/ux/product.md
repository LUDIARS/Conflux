# Conflux (Cf) — プロダクト UX

UX 原典: [CDGD - チャット・ドリブン・ゲーム・デベロップメント](https://candle-stoplight-544.notion.site/CDGD-3de39cbfbab981b99d2cfdb713d48237)
(原典の更新日時 2026-09-17T13:15:05.042Z)。設計の記録は Pf プロジェクト `01M2RZXD2WVGQP0NKXEE9WRYZ1`
(7 ドメイン・12 仕様 draft)。この文書はその引継ぎ本文を Cf リポの正本として写したもの。
**価値 ID と受入条件は原典を具体化した設計案であり、UX 達成の実測は未実施。**

## 目標体験

遊ぶ → 感想や改善案を話す → AI が困り事・面白かった点・変更案を整理する → チームが次に試す案を選ぶ
→ Cc 経由で実装する → 成果物を遊んで確かめる → 結果を次の議論へ戻す。

実装量や技術的な苦労ではなく、遊びの面白さを育てる機会を増やす。短い感想・非同期の意見も拾う。
採否は人間が判断し、見送った理由・過去の試行も残す。

## 価値 ID

| ID | 価値 | 主な所有ドメイン |
|---|---|---|
| CF-UX-1 | 短い/非同期の意見が埋もれず次の試行に繋がる | play-feedback, implementation-requests |
| CF-UX-2 | 潮流ごとの違いを実際に遊べる成果物で比較できる | evolution-streams, playable-results |
| CF-UX-3 | どの意見から何を変え、どう評価し、なぜ採用/見送りしたか辿れる | play-feedback, adoption-decisions, implementation-requests |
| CF-UX-4 | 試行を混入なく並行でき、採否はディレクターやチームが判断する | flow-isolation, adoption-decisions, project-workspaces |

## 画面の入口

プロジェクトを開くと、そのプロジェクトの潮流・亜流・本流と分岐・合流をグラフで表示する
(`GET /projects/:code`)。グラフのノードを選ぶと、同じ選択対象について
コンセプト・改修履歴・ルール差分・コメント/評価・成果物・作業依頼・合流判断を同じ画面に並べる。
グラフの選択対象と詳細の対象は常に同じ亜流 id から引く (CF-GRAPH-001)。

## 人間が確定した要件 (Pf CF-DESIGN-001「人間が指定した機能」)

1. `evolution/xxxx/yyyy` の xxxx は潮流、yyyy は亜流。全体を流れと呼ぶ。亜流ごとに本流 main を持つ。作業は feature/xxxx 等。
2. 潮流・亜流をグラフビューにし、コンセプト・改修・ルール変更を可視化する。
3. 潮流を正式ルールと決める UI を設け、合流と呼ぶ。
4. Cc に Conflux Flow を独立設定として追加 (Rv/GitHub と並行)。対象は KD と Mp。現行 KD=Rv、Mp=GitHub。**Cf 有効化は未反映**。
5. Cf コメント欄。Cf Flow のゲームのデバッグ画面からコメント投稿・潮流評価。
6. Cf から Cc へ spawn。プロジェクト主軸で子会社/Discord/Slack 等の宛先を事前設定。
7. 各潮流の結果に必ず成果物。ビルド DL またはデプロイ。ビルドはフロー連動で自動化し Cc フックで管理。デプロイは管理職以上のみ。
8. Cc フックは作業開始前に実ブランチと対象潮流を確認し、混入を警告して対象ブランチへ切り替える (Cc 側 PR #1893、未配備)。
9. 通常フローでも起点は main。PR 提出後の別作業は classifier と hook の二重チェック (Cc 所有)。

## 提案・未決事項 (実装ではデータで指定可能にし、推測で確定しない)

| 未決 | Cf 実装での扱い |
|---|---|
| 本流の物理命名 (`evolution/x/y/main` か `evolution/x/y` 自体か) | `BranchNamingPolicy.mainline` をプロジェクト設定で必須指定。未設定なら選択・亜流作成を拒否する |
| 評価の尺度/項目 | `RatingScale` をプロジェクト設定で指定。未設定なら評価投稿を拒否 (コメントは受け付ける) |
| 自動ビルドの契機・平台・保管/保持 | `BuildSettings` に契機/平台を記録。成果物本体は保管せず Cc フックが報告した URI を参照するだけ |
| デプロイ先と Cc 役職の照合方法 | `DeploySettings.environments` / `managerRoles` を設定で指定。未設定・Cc 照合不可ならデプロイ拒否 |
| 亜流 main と repository main の関係 | Cf は選択亜流の本流を baseBranch として Cc に渡すだけ。履歴の付け替えはしない |
| 合流時の役職/承認手順 | 判断者の記録のみ必須。デプロイの管理職要件は転用しない |

## 未配備の表示

- Cc の `project_codes.conflux_flow` と `POST /v1/harness/conflux/select` は Cc 側 PR #1893 で審査待ち・未配備。
  Cf は応答が得られない限り「未接続」と表示し、KD/Mp を有効化済みとして表示しない。
- ビルドイベントの Cc→Cf 通知経路、Cf→Cc spawn 経路、役職照会経路は Cc 側に未定義。
  Cf は各 adapter の設定が無い間「未接続」を返し、架空の成功を作らない (spec/architecture/cc-integration.md)。
