# Conflux アーキテクチャ

## 採用観点

- 言語: TypeScript (strict)。Node 24 の型除去で実行し、実行時依存は持たない (標準 `node:http` / `node:fs` / `fetch`)。
- 業務判断は純関数 (`src/<domain>/domain/*.ts`)、I/O は adapter (`src/adapters/**`)、
  手順は use case (`src/<domain>/application/*.ts`)。use case は port (interface) だけに依存する。
- 時刻と ID は `Clock` / `IdGenerator` を注入する (テスト決定性)。
- 外部処理 (spawn / ビルド / デプロイ / Cc harness 選択) は `requested` / `succeeded` / `failed` /
  `unknown` / `not_connected` を区別する。`unknown` は照合なしに再送しない。
  `not_connected` は「送っていない」ことが確定している状態で、成功扱いしない。

## レイヤ依存

```
src/main.ts (composition root)
  └ src/adapters/http   (router, HTML 描画, request 解析)
       └ src/<domain>/application (use case)
            ├ src/<domain>/domain (純関数・型)
            └ src/<domain>/ports.ts (interface)
  └ src/adapters/storage, src/adapters/cc, src/adapters/deploy (port 実装)
src/shared (Result, Clock, IdGenerator, 状態ドキュメント型)
```

下層 (domain) は上層 (application / adapters) を import しない。ドメイン間参照は domain 型の
読み取りのみ許し、状態変更は各ドメインの use case を経由する。

## ドメインとディレクトリの所属

| ドメイン | src | tests | 仕様 |
|---|---|---|---|
| evolution-streams | `src/evolution-streams/**` | `tests/evolution-streams/**` | CF-FLOW-001, CF-GRAPH-001 |
| play-feedback | `src/play-feedback/**` | `tests/play-feedback/**` | CF-COMMENT-001, CF-DEBUG-001 |
| adoption-decisions | `src/adoption-decisions/**` | `tests/adoption-decisions/**` | CF-MERGE-001 |
| project-workspaces | `src/project-workspaces/**` | `tests/project-workspaces/**` | CF-PROJECT-001 |
| implementation-requests | `src/implementation-requests/**` | `tests/implementation-requests/**` | CF-SPAWN-001 |
| playable-results | `src/playable-results/**` | `tests/playable-results/**` | CF-ARTIFACT-001, CF-BUILD-001, CF-DEPLOY-001 |
| flow-isolation | `src/flow-isolation/**` | `tests/flow-isolation/**` | CF-HARNESS-001 (Cf 側の選択と照合のみ) |
| platform-foundation | `src/shared/*`, `src/adapters/**`, `src/main.ts`, `contracts/*` | `tests/shared/*`, `tests/adapters/**`, `tests/support/*` | CF-DESIGN-001 |

正本の membership は `spec/domains/<domain>.domain.json`。

## 状態

`ConfluxState` (src/shared/state.ts) を 1 つの JSON ドキュメントとして保存する。
保存 adapter は一時ファイル書込み → rename で置き換え、読込時に `version` を照合する。
保存先は `CONFLUX_DATA_DIR` で必須指定 (未設定は起動時エラー)。成果物本体は保存しない。

## 不変条件 (全体)

- I-1 別プロジェクトの潮流・亜流・コメント・成果物を相互に参照しない (全 use case が projectCode を照合)。
- I-2 Cc 由来の事実 (conflux_flow、役職、統合完了、spawn 結果) は Cc/Rv/GitHub の応答でのみ更新する。
- I-3 外部処理の結果不明を成功として表示しない。
- I-4 Cf Flow 設定は Rv/GitHub ワークフロー設定を読み書きしない (Cf は参照値も保持しない)。
