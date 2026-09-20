# 遊びの対話と評価 (play-feedback)

対応仕様: CF-COMMENT-001 / CF-DEBUG-001。価値: CF-UX-1, CF-UX-3。

## 所有

コメント・返信・AI による整理・潮流評価・プレイした版の参照。Cf 画面の投稿とゲーム内デバッグ画面の投稿は
同じ `Comment` / `Rating` モデルに合流する。意見から自動で正式採用しない (採否は adoption-decisions)。

## 不変条件

- 一言の感想も受け付ける (空文字と 4000 文字超だけ拒否)。
- AI による整理は `author.kind = ai-summary` / `source = ai` で、同じプロジェクトの人間のコメントを 1 件以上参照する (C-4)。
- 返信は親と同じ亜流に限る。プレイ版は同じ亜流の Cf 記録済みビルドに限る。
- デバッグ投稿は、Cc が `conflux_flow = true` と報告し、かつプロジェクトが `debugIntake` を有効にした場合だけ受け付ける。
  申告されたビルド id とコミットが Cf の記録と一致しなければ拒否する (C-5)。
- デバッグ投稿のコメントと評価は両方検証してから保存する (片方だけ保存しない)。
- 評価は版ごとに集計し、最新対象版以外を current と表示しない (C-6)。
- 意見の行き先 (`traceComment`): AI 整理 → 作業依頼 → 合流判断を辿れる。

## 実装

`src/play-feedback/domain/{model,comment-rules,rating-rules,debug-intake,trace}.ts`、
`src/play-feedback/application/feedback-use-cases.ts`。
API: `POST /api/projects/:code/variants/:id/comments|ratings`、デバッグ画面 `POST /api/debug/feedback`。
テスト: `tests/play-feedback/*.test.ts`。

## 未決・仮定

- 評価尺度は 2026-09-20 に「面白さ」1〜5 の一軸 + 自由文コメントと確定した。CF-UX-1 は短い・非同期の
  意見を拾うことで、軸を増やすたびに投稿しない理由が増えるため。プロジェクト設定 `ratingScale` は
  そのままで、未指定のときにこの既定が入る。既定が入る前に保存された記録は従来どおり評価を拒否する
  (コメントは受け付ける)。
- デバッグ投稿の送信元認証は未確定 (設計上の仮定: Cf Flow 有効かつ記録済みビルドの一致で受理)。KD/Mp 側のデバッグ画面実装は本 PR の対象外。
