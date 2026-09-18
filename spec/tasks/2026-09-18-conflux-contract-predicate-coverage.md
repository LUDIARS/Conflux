---
task: "conflux-contract-predicate-coverage"
project: "Cf"
kind: "実装"
created: "2026-09-18"
run: "2b2d4437-6da5-4e48-b72d-5758a5aa7d9b"
---
# Conflux の Augur 契約述語 C-1〜C-15 をすべてテストから検証する

## 目的
前 run の残作業「Augur 契約集計 (C-1〜C-15)」のうち、外部権限なしで進められる部分を片付ける。
これまでテストから述語を直接呼んでいたのは C-1/C-10/C-13/C-14/C-15 の 5 件だけだった。
残り 10 件 (C-2〜C-9, C-11, C-12) も、実際のルール関数の結果と、わざと作った違反結果の両方で評価する。
これにより、述語が常に真を返すだけの「空振り」でないことをテスト側で担保する。

## 完了条件
- C-1 〜 C-15 のすべての契約述語が、少なくとも 1 つのテストで実ルールの結果に対して評価され、true を返すことをテストで表明している。
- C-2〜C-9, C-11, C-12 の各述語は、捏造した違反結果に対して文字列 (違反理由) を返すことをテストで表明している。
- 静的型検査 (tsc) が通る。
- テストは未実行 (実行許可なし)。Augur contract-wrap の注入と `contracts report` の集計も未実施。

## 未実施・後続 (権限待ち)
- `@ludiars/log-weaver` 依存の導入方針 (file: 参照か GitHub Packages か) と Lapilli のビルド許可。これが決まるまで contract-wrap 注入と集計はできない。
- テスト実行の許可。
- 実機・支援技術での Web UI 評価 (CF-UX-1〜4 の達成と、人間による詳細設計の承認は未確認)。
- Conflux の remote 設定と Revisor 登録 (現在 repository_not_registered)。
- Tela オーバーレイ UI (ホストの接続方式が未確定。確定後に `src/adapters/tela/**` を追加する)。

## スコープ (編集可ディレクトリ)
- tests/shared
- spec/tasks
