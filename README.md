# Conflux (Cf)

CDGD (チャット・ドリブン・ゲーム・デベロップメント) のための流れワークスペース。
プロジェクトを開くと潮流 (tide)・亜流 (variant)・本流 (mainline) と分岐/合流をグラフで表示し、
コメント・ゲーム内デバッグからの評価・Cc への作業依頼・試遊成果物・合流 (正式ルール採否) を一か所で扱う。

- UX と価値 ID: [spec/ux/product.md](spec/ux/product.md)
- 構成と境界: [spec/architecture/overview.md](spec/architecture/overview.md), [spec/architecture/cc-integration.md](spec/architecture/cc-integration.md)
- ドメイン: [spec/domains/](spec/domains/) と [spec/feature/](spec/feature/)

## 実行 (未起動)

Node 24 以上。実行時依存なし。起動は Excubitor 管理下で行う (本リポの変更では起動していない)。

| 環境変数 | 必須 | 意味 |
|---|---|---|
| `CONFLUX_DATA_DIR` | ✓ | 状態 JSON の保存先 |
| `CONFLUX_HOST` / `CONFLUX_PORT` | ✓ | 待受 (ポートの正本は Excubitor catalog) |
| `CONFLUX_CC_URL` / `CONFLUX_CC_TIMEOUT_MS` | ✓ | Concordia の URL とタイムアウト |
| `CONFLUX_CC_SPAWN_PATH` / `CONFLUX_CC_SPAWN_LOOKUP_PATH` | | Cc の Cf spawn / 照会経路 (Cc 側未定義。未設定なら未接続) |
| `CONFLUX_CC_BUILD_PATH` | | Cc のビルド要求経路 (同上) |
| `CONFLUX_CC_IDENTITY_PATH` | | Cc の本人/役職照会経路 (未設定ならデプロイ不可) |
| `CONFLUX_HOOK_TOKEN` | | Cc フックの共有鍵 (32 文字以上。未設定ならフック受信を 503) |

```sh
npm run typecheck   # tsc --noEmit
npm test            # node --test (実行は別途許可のうえで)
```
