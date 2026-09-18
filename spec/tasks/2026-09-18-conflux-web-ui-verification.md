# Conflux (Cf) Web UI のテストを実行し、4 幅のレイアウトを実測して見つかった操作領域の不足を直す

- 日付: 2026-09-18
- ブランチ: `feature/conflux-foundation` (ローカル `main` 起点、リモート未設定)
- 委託: Concordia delegation run `93f63b06-49cf-4982-ad4d-853546a38d28` / Memoria task 2743
- 前提: 前 run `c82e9586-bb9c-41ab-a3ad-3e5fc42a8c7b` の残作業 (テスト実行と Augur 集計、レスポンシブ評価、Revisor 登録、Tela) を人間の指示で引き継いだ。

## 目的

CF-WEB-001 の Web UI について、記述だけで未実行だったテストを実行し、幅 320 / 390 / 768 / 1280px の
レイアウトをブラウザで実測して、受入基準案 W-1〜W-5 のうち確認できた範囲と未確認の範囲を仕様に記録する。
実測で見つかった不足は同じ変更で直す。

## 完了条件

- `node --test "tests/**/*.test.ts"` が 108 件すべて通る。空状態のテストがインラインスクリプト中のセレクタ文字列に誤一致していた箇所は、要素そのものを判定するように直している。
- 12 画面 (一覧・グラフ等倍/全体表示・詳細 6 タブ・空状態・存在しない選択) × 4 幅で、文書全体の横はみ出しと入力欄 16px 未満がともに 0 件。
- 成果物タブの試遊成果物リンクは 44px の操作領域 (`button-link`) を持ち、回帰テストで確認している。
- spec/feature/web-ui.md の W-1〜W-5 に実測方法・結果・未確認の範囲を記載している。
- Anatomia verify が PASS。

## 未確認・残件

- Augur 契約集計 (C-1〜C-15): `augur contracts lint` は findings 0。ただし `contract-wrap` を注入するには、Conflux に `augur.inject.json` と `@ludiars/log-weaver` 依存が必要。log-weaver は `Lapilli/packages/log-weaver` にあるが dist が未ビルドで、この worktree の外なので、注入と集計は行っていない。C-1〜C-15 は Augur 上は uncovered (not-injected)。テストで述語モジュールを直接呼んで通過しているのは C-1 / C-10 / C-13 / C-14 / C-15 の 5 件だけ。残り 10 件は対応する業務ルールの単体テストは通るが、述語自体は未実行。
- 実機タッチでのグラフ移動・拡大縮小、スクリーンリーダー、フォーカス順の目視、実ブラウザでの補助スクリプト動作、通信失敗時の表示は未評価。UX 達成は未確認。
- Chrome 拡張が未接続のため、実測はヘッドレス Edge での静的 HTML 読み込み (サーバー未起動) で行った。
- Cf のリモート設定と Revisor 登録は未了 (repository_not_registered)。
- Tela オーバーレイ UI は Tela ホストの接続方式が未確定のため未着手 (`src/adapters/tela/**` 予定)。
