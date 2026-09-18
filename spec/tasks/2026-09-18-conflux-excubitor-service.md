# Conflux (Cf) を Excubitor 管理のサービスとして起動できる設定を整える

- 日付: 2026-09-18
- ブランチ: `feature/conflux-foundation` (ローカル `main` 起点、リモート未設定)
- 委託: Concordia delegation run `00d26c44-9728-4c86-89c8-df427831c143` / Memoria task 2752
- 仕様: `spec/architecture/service-operation.md` (CF-OPS-001)

## 目的

人間の指示「サービスとして起動できる状態にして」に対して、Conflux 側の起動準備を整える。
Excubitor が本体 checkout から起動・監視できる catalog を所有し、Cc の接続先は Excubitor の注入値から読み、
Web 入口は loopback と許可済みの Host/Origin に限る。本体への反映と信頼登録は親セッションが担当する。

## 完了条件

- `excubitor.catalog.yaml` に code `conflux` を定義している: `cwd: ${ARS_ROOT}/Conflux`、`node src/main.ts`、
  `autostart: false`、`restart_policy: "no"`、未使用ポート 4350、health `http://127.0.0.1:4350/health`、
  データは `${ARS_ROOT}/Conflux/data`、Web 入口 `frontend_url: http://127.0.0.1:4350/`。Cc の URL は書いていない。
  `repo` は実在未確認のため記載せず、未登録と明記している。
- C-16 resolveCcBaseUrl(env): CONFLUX_CC_URL の明示値を優先し、無ければ Excubitor が注入する CONCORDIA_URL を使い、どちらも無ければ起動を失敗させる
- C-17 admitWebRequest(headers, access): 許可外の Host、または完全一致集合に無い Origin の要求を 403 で拒否し、許可された要求は拒否しない
- C-18 describeHealth(config, startedAt): health は生存だけを示し、Cc 到達性を未確認とし、未設定の Cc 経路・デプロイを未接続として返す
- `CONFLUX_HOST` が loopback 以外なら起動エラー。未定義の Cc 経路は引き続き未接続を返す。
- `platform-foundation` の membership に `excubitor.catalog.yaml` を含めている。
- 静的型チェック (tsc) が通り、Anatomia verify の結果を記録している。

## 未実施・残件

- テストは記述のみで未実行 (`tests/adapters/service-operation.test.ts`)。Augur の契約集計 (C-16〜C-18) も未実行。
- サービスの起動・health の実応答確認は未実施 (本体 checkout への反映と cc-test の claim/release を伴う起動許可が前提)。
- Ex Viewer / 公開トンネルは設定していない。必要になれば `CONFLUX_VIEWER_ORIGINS` と `LUDIARS_ALLOWED_HOSTS` を catalog で与える。
- 本体 checkout (main) への反映、origin 設定、Ex の信頼登録 (`EXCUBITOR_TRUSTED_FRAGMENT_REPOS` または LUDIARS origin) は親セッション / 人間の判断待ち。
- `CONFLUX_HOOK_TOKEN` の発行と注入 (Infisical 等) は未定。
