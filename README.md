# Conflux (Cf)

CDGD (チャット・ドリブン・ゲーム・デベロップメント) のための流れワークスペース。
プロジェクトを開くと潮流 (tide)・亜流 (variant)・本流 (mainline) と分岐/合流をグラフで表示し、
コメント・ゲーム内デバッグからの評価・Cc への作業依頼・試遊成果物・合流 (正式ルール採否) を一か所で扱う。

- UX と価値 ID: [spec/ux/product.md](spec/ux/product.md)
- 構成と境界: [spec/architecture/overview.md](spec/architecture/overview.md), [spec/architecture/cc-integration.md](spec/architecture/cc-integration.md)
- ドメイン: [spec/domains/](spec/domains/) と [spec/feature/](spec/feature/)

## 実行 (Excubitor 管理)

Node 24 以上。実行時依存なし。サービスコード `conflux` として Excubitor が本体 checkout
(`${ARS_ROOT}/Conflux`) から `node src/main.ts` で起動する。定義の正本は
[excubitor.catalog.yaml](excubitor.catalog.yaml) (ポート・データ保存先・health URL)。
worktree や `npm start` の直接起動はしない。運用の詳細は
[spec/architecture/service-operation.md](spec/architecture/service-operation.md) (CF-OPS-001)。

| 環境変数 | 必須 | 意味 |
|---|---|---|
| `CONFLUX_DATA_DIR` | ✓ | 状態 JSON の保存先 (catalog では `${ARS_ROOT}/Conflux/data`、`.gitignore` 済み) |
| `CONFLUX_HOST` / `CONFLUX_PORT` | ✓ | 待受。loopback (`127.0.0.1` / `::1` / `localhost`) 以外は起動エラー。ポートの正本は catalog |
| `CONFLUX_CC_URL` | (✓) | Concordia の URL。未設定なら Excubitor が注入する `CONCORDIA_URL` を使う。どちらも無ければ起動エラー |
| `CONFLUX_CC_TIMEOUT_MS` | ✓ | Cc 呼び出しのタイムアウト |
| `CONFLUX_CC_SPAWN_PATH` / `CONFLUX_CC_SPAWN_LOOKUP_PATH` | | Cc の Cf spawn / 照会経路 (Cc 側未定義。未設定なら未接続) |
| `CONFLUX_CC_BUILD_PATH` | | Cc のビルド要求経路 (同上) |
| `CONFLUX_CC_IDENTITY_PATH` | | Cc の本人/役職照会経路 (未設定ならデプロイ不可) |
| `CONFLUX_HOOK_TOKEN` | | Cc フックの共有鍵 (32 文字以上。secret なので catalog に置かない。未設定ならフック受信を 503) |
| `LUDIARS_ALLOWED_HOSTS` | | Excubitor 共通の追加許可 Host (先頭ドットで親ドメインとサブドメイン) |
| `CONFLUX_VIEWER_ORIGINS` | | 追加で許可する Origin の完全一致リスト (既定は空) |

```sh
npm run typecheck   # tsc --noEmit
npm test            # node --test (実行は別途許可のうえで)
```
