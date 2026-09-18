# Conflux のサービス運用 (CF-OPS-001)

Conflux を Excubitor (Ex) 管理のサービスとして起動できる状態にするための約束事。
起動・停止・再起動の実施そのものはこの仕様の範囲外で、`cc-test` の claim/release と
Ex HTTP control を使って、別途許可を得たうえで行う。

## 起動定義

- 正本はサービス所有の `excubitor.catalog.yaml` (code `conflux`、project_code `Cf`)。
- `cwd: ${ARS_ROOT}/Conflux` (本体 checkout)、`command: node src/main.ts` (Node 24 の型除去で TS を直接実行)。
- `autostart: false`、`restart_policy: "no"`。起動は人が Ex から明示的に行う。
- ポート `4350`。2026-09-18 に `GET /api/v1/services` で既存サービスの port・health URL に
  4350 が無いことを確認して選んだ (4340 は既存サービスが使用中)。ポート番号は catalog にだけ書き、
  コードや README には固定値を持たない (port-source-rule)。
- 永続データは `CONFLUX_DATA_DIR=${ARS_ROOT}/Conflux/data`。`data/` は `.gitignore` 済み。
- ログは `${ARS_ROOT}/logs/conflux`。
- Web 入口は `frontend_url: http://127.0.0.1:4350/` (loopback)。Ex の一覧から開ける。
- `repo` は記載しない。origin 未設定で、GitHub 上のリポジトリ実在も未確認 (未登録)。
  Ex が所有 catalog を読むには LUDIARS origin か `EXCUBITOR_TRUSTED_FRAGMENT_REPOS` への登録が要り、現状は未登録。
- worktree・複製フォルダからは起動しない。

## Concordia への接続

- Cc の URL は Conflux の catalog に書かない。Concordia 所有 catalog の `provides: CONCORDIA_URL`
  を Ex が topology env として全サービスに注入するので、それを使う。
- `resolveCcBaseUrl` の優先順位: `CONFLUX_CC_URL` (明示値) → `CONCORDIA_URL` (Ex 注入)。
  どちらも無い、または http(s) でない場合は起動時に `ConfigError` で停止する。
- Cc 側で未定義の経路 (`CONFLUX_CC_SPAWN_PATH` ほか) は catalog に設定しない。未設定の機能は
  従来どおり「未接続」を返し、経路を推測しない。
- `CONFLUX_HOOK_TOKEN` は secret なので catalog に置かない。未設定の間、`/api/hooks/*` は 503。

## Web 入口の制限

`web-bootstrap` の方針に合わせる。公開トンネル・Ex Viewer・`*_PUBLIC_URL` は設定しない。

- 待受は loopback に限る。`CONFLUX_HOST` が `127.0.0.1` / `::1` / `localhost` 以外なら起動エラー。
- Host: 自身の `127.0.0.1:<port>` / `localhost:<port>` / `[::1]:<port>` と、Ex 共通の
  `LUDIARS_ALLOWED_HOSTS` (カンマ区切り、trim・小文字化、先頭ドットは親ドメインとサブドメイン) だけを許可する。
  `.example.test` は `badexample.test` や `example.test.evil.test` に一致しない。
  URL・userinfo・パス・`*` を含む値は起動エラーにする (許可を広げない)。
- Origin: 送られてきた場合は完全一致の集合に含まれる必要がある。集合は自身の loopback origin と
  `CONFLUX_VIEWER_ORIGINS` (完全一致の http(s) origin) だけ。Host のドメイン許可を Origin 許可へ広げない。
  Origin の無い要求 (Ex health、Cc フック等のサーバ間呼び出し) は Host 検査だけを受ける。
- 検査は `createNodeServer` で本文の読み込みとルーティングの前に行い、拒否は 403
  (`host_not_allowed` / `origin_not_allowed`)。

## health

- `GET /health` は Ex の health check 用。応答 `status: "alive"` は「プロセスが HTTP を返せる」ことだけを示す。
- Cc への到達性は調べず `cc.reachability: "not_checked"` と返す。生存と Cc 接続を混同しない。
- `capabilities` は各外部機能の経路が設定済みかどうか (`configured` / `not_connected`) を返す。
  デプロイは実行手段が未確定 (CF-DEPLOY-001) なので常に `not_connected`。
- Cc の URL や共有鍵は応答に含めない。

## 受入条件

- C-16 resolveCcBaseUrl(env): CONFLUX_CC_URL の明示値を優先し、無ければ Excubitor が注入する CONCORDIA_URL を使い、どちらも無ければ起動を失敗させる
- C-17 admitWebRequest(headers, access): 許可外の Host、または完全一致集合に無い Origin の要求を 403 で拒否し、許可された要求は拒否しない
- C-18 describeHealth(config, startedAt): health は生存だけを示し、Cc 到達性を未確認とし、未設定の Cc 経路・デプロイを未接続として返す

テストは `tests/adapters/service-operation.test.ts`。

## 未確認

- Ex 経由での実起動、health の実応答、Ex の `required_env` 検査と `${ARS_ROOT}` 展開の実挙動は未確認
  (本体 checkout への反映と起動許可が前提)。
- Ex Viewer から開く場合は、Viewer の Origin を `CONFLUX_VIEWER_ORIGINS` に、Viewer の Host を
  `LUDIARS_ALLOWED_HOSTS` に入れる必要がある。今回は Viewer を有効にしていない。
- Web UI のリンクとフォームはルート相対 (`/projects/...`) で、絶対 URL は持たない。path prefix を付ける
  Viewer 経由で配信する場合は prefix の反映が別途必要になる。スマホ対応 (CF-WEB-001) の表示部分はこの変更で触っていない。
