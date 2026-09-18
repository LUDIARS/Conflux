# 進化の流れ (evolution-streams)

対応仕様: CF-FLOW-001 潮流・亜流・本流と改修履歴 / CF-GRAPH-001 進化方向性のグラフビュー。価値: CF-UX-2, CF-UX-4。

## 所有

潮流 (Tide)・亜流 (Variant)・改修 (Revision)・分岐関係・コンセプト・ルール変更の意味。
Git ブランチの物理操作と PR 審査は所有しない。グラフは状態の投影 (`projectFlowGraph`)。

## 不変条件

- 潮流の識別名はプロジェクト内で一意、亜流の識別名は潮流内で一意。`main` は予約語 (C-1)。
- 改修は 1 つの亜流にだけ追記される。ルール変更は変更前の内容が現在と一致する場合だけ適用する (C-2)。
- 分岐元はプロジェクト内の亜流に限る。潮流をまたぐ分岐は許す。
- 本流ブランチ名は `BranchNamingPolicy` (プロジェクト設定) から導く。未設定なら表示・選択しない。
- グラフは分岐辺と合流辺を保ち、木に限定しない (C-3)。
- 亜流の「対象版」は最新のコミット付き改修のコミット (`targetCommitOf`)。

## 実装

| 役割 | ファイル |
|---|---|
| 型 | `src/evolution-streams/domain/model.ts` |
| 識別名・ブランチ命名 | `domain/slug.ts`, `domain/branch-naming.ts` |
| 作成・改修規則 | `domain/flow-rules.ts` |
| 比較 | `domain/variant-comparison.ts` |
| グラフ投影と配置 | `domain/flow-graph.ts`, `domain/graph-layout.ts` |
| use case | `application/flow-use-cases.ts`, `application/project-overview.ts` (画面の読み取りモデル) |
| 描画 | `src/adapters/http/html/graph-svg.ts` (亜流ノード → `?variant=<id>`、詳細も同じ id から引く) |

テスト: `tests/evolution-streams/*.test.ts`。

## 未決

本流の物理命名 (`evolution/x/y/main` / `evolution/x/y`) は人間の回答待ち。`mainline` 値で切り替える。
時間軸方向・色・折畳みは実装提案 (列=潮流、行=作成順、合流は上部の正式ルールへ)。
