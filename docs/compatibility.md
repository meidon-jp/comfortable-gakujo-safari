# 互換性と検証メモ

2026-10-21時点．macOSのSafari＋Userscriptsで基本動作を確認しています．iOS・iPadOSの実機と，ログイン後の各機能の網羅的な確認は未実施です．

自動テストはNode.jsのVM・DOM代替オブジェクトで行っています．Safariでの実機試験とは異なります．

| 確認項目 | 維持した方式・確認結果 | 実機で確認が必要な点 |
| --- | --- | --- |
| 実行タイミング | `@run-at document-start` を維持。`load`後にDOM安定・必要要素を待機。遅い注入では `readyState === "complete"` から開始。読み込み前・途中・完了後から一度だけ初期化するテストが通過。 | Userscriptsの注入時期、実サイトでの描画・画面遷移。 |
| ページ側のjQuery | `@inject-into page`・`@grant none` を維持。既存の `window.jQuery.fn.submit` とネイティブの `submit` を一時的に捕捉して添付を取得。捕捉と復元を代替オブジェクトで確認。外部jQueryは追加しない。 | 実サイトのjQuery・送信関数との連携、CSPによる注入制限。 |
| フォーム送信 | 成績・時間割取得は既存のFormData／URLSearchParamsと同一オリジンの認証情報を使用。CSRFフィールドの引き継ぎをテスト。添付プレビューのGETだけ本文をクエリへ修正し、POSTのFormDataは維持。 | 実際の認証・トークン・ダウンロード処理、単位情報への遷移、提出取消後の復帰、SSO自動同意。 |
| Cookie・ストレージ | Cookieの日本語データの往復と削除、初期化時のsessionStorageの扱いをテスト。保存方式・キーは維持。 | Safariの保存制限・データ削除・プライベートブラウズ、画像の保存と復元。 |
| 添付プレビュー | PDF・テキストはBlob URLをiframeへ、画像はimgへ表示。GET／POST、HTTPエラー表示、MIME選択、画像用URLの解放をテスト。 | iPhone・iPadでのPDFのページ送り・スクロール、文字コード、画像形式、ログイン切れ時の応答。 |

添付のGETフォームに本文を指定するとFetchの仕様上エラーになるため、クエリで送るようにしています。また、HTTP 4xx・5xxをファイル扱いしないようにしています（[Fetch Standard](https://fetch.spec.whatwg.org/#dom-request)）。この2点以外の機能処理は維持しています。

### 保存内容と制約

- Cookie（学情サイト内、`path=/`）: `cg_hidden_*` は非表示課題のタイトル・科目・提出期間・状態など、`cg_grade_save_enabled` は通知設定、`cg_grade` は比較用ハッシュ、`cg_grade_updated` は更新フラグです。保存期限の指定は365日ですが、Safariのポリシーやサイトデータ削除で早く消えることがあります。
- localStorage: `cg-header-image` に切り抜いたヘッダー画像を保存します。ホーム画面で既存画像を読み取り、変更・削除操作時に書き込みます。容量制限や保存禁止では利用できません。
- sessionStorage: `cg_return_to_task` に提出取消後の復帰先となる課題名・科目名を保存します。初期化時には旧処理用の `cg_grade_nav` を削除します。
- これらはUserscriptsの保存フォルダではなく、Safariの学情サイトのデータです。端末間の同期・引き継ぎは実装していません。Cookieをブロックした環境、ストレージへのアクセスが拒否される環境は未対応です。
- ファイルプレビューはSafariのPDF・画像対応とサイトのCSPに依存します。表示できない場合は元の添付リンクから開いてください。外部サイトの添付は通常のCORS制限を受けます。ログイン画面がHTTP 200で返る場合の自動判別は行いません。
- `page` への注入がCSPで拒否される場合は未対応です。`content` に変えるとページ側のjQueryや送信処理にアクセスできなくなるため、このスクリプトでは切り替えを解決策として案内しません（[Userscriptsの実行コンテキスト・CSPの説明](https://github.com/quoid/userscripts#metadata)）。

### ローカル検証

Node.jsは [.mise.toml](../.mise.toml) に固定しています。外部npmパッケージは不要です。リポジトリ直下で実行します。

```sh
mise install
mise exec -- node --check src/Comfortable_Gakujo.user.js
mise exec -- node --test tests/*.test.cjs
git diff --check
```

検証時はNode.js v22.23.2で、既存17件と追加12件の計29件が通過し、構文チェックも通過しました。追加テストでは修正前にGETプレビュー1件・HTTPエラー2件の失敗を再現しています。

実機確認時は、各OSで登録・再読み込み・更新を行い、ホームのカウントダウンと通知、課題の非表示と復元、ヘッダー画像の保存・再読込・削除、成績フィルター、時間割順の選択、SSO、単位情報への遷移、添付のPDF・テキスト・画像表示を確認してください。提出取消の復帰は、実際に取消操作が必要な場合に確認してください。


## 対応環境と保存先

このスクリプトのAPI上の前提は **macOS 12以降かつSafari 15.4以降、またはiOS・iPadOS 15.4以降** です。Userscripts本体はApp Storeに表示される対応OSも確認してください。元コードの `crypto.randomUUID()` は [MDNの互換性データでSafari 15.4以降に対応](https://github.com/mdn/browser-compat-data/blob/main/api/Crypto.json) とされており、それ以前向けの代替実装は追加していません。これらの最低バージョンでの実機試験は未実施です。

iCloud Driveを保存先にする場合、同期が終わっていることを確認してください。対応OSではフォルダを「ダウンロード済みを保持」にすると、ファイルが端末から取り除かれるのを防げます。スクリプトの同期と、後述するCookie・ストレージの保存は別です。

## 参考

- [Userscripts公式README](https://github.com/quoid/userscripts)
- [MacのSafari機能拡張](https://support.apple.com/ja-jp/102343)
- [iPhoneのSafari機能拡張](https://support.apple.com/ja-jp/guide/iphone/iphab0432bf6/ios)
