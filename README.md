# Comfortable Gakujo for Safari

![version](https://img.shields.io/badge/version-1.11.4-green)

静岡大学の学情を使いやすくするユーザースクリプトです．
woody-1227さんの [Comfortable-Gakujo](https://github.com/woody-1227/Comfortable-Gakujo) を，Safariでも使えるようにしました．実行には [Userscripts](https://github.com/quoid/userscripts) を使っています．

## 使い方

1. [Userscripts](https://apps.apple.com/app/userscripts/id1463298887) をインストールし，一度アプリを開きます．
2. Safariの設定でUserscriptsを有効にします．
   - macOS：「Safari」→「設定」→「機能拡張」
   - iOS・iPadOS：「設定」→「アプリ」→「Safari」→「機能拡張」（旧OSでは「設定」→「Safari」）
3. Safariで [スクリプト](https://raw.githubusercontent.com/meidon-jp/comfortable-gakujo-safari/main/src/Comfortable_Gakujo.user.js) を開き，Userscriptsのポップアップから登録します．
4. 学情を開き，Userscriptsによる `gakujo.shizuoka.ac.jp` へのアクセスを「常に許可」にします．SSOの自動同意を使う場合は `idp.shizuoka.ac.jp` も許可してください．
5. Userscriptsの `Enable Injection` と `Comfortable Gakujo (Safari Userscripts)` をONにし，ページを再読み込みします．

登録できない場合は，[.user.js](src/Comfortable_Gakujo.user.js) をUserscriptsの保存先へ**コピー**してください．コピー後はポップアップを一度開いてから，学情を再読み込みします．元版を登録済みの場合は，重複しないようOFFにしてください．

## 機能

- 課題の締め切り順ソート，残り時間の表示，提出済み課題の色分け・非表示
- 成績更新通知，年度・学期での絞り込み，授業の曜日・コマ順表示
- サイドバー，添付ファイルのプレビュー，ヘッダー画像の変更など

詳しくは [機能一覧](docs/features.md) を参照してください．

## 更新

Userscriptsの `Available Updates` から更新します．macOSではエディタの `Update` ボタンも使えます．
手動で更新する場合は，[スクリプト](https://raw.githubusercontent.com/meidon-jp/comfortable-gakujo-safari/main/src/Comfortable_Gakujo.user.js) をもう一度開いて登録してください．更新後は学情を再読み込みします．

更新先はこのリポジトリです．移植元の更新は自動では取り込みません．[更新履歴](docs/changelog.md)

## 注意事項

- 非公式です．学情の画面変更などで動かなくなることがあります．無保証での提供です．
- 生成AIによって生成されたソースコードを含みます．
- SSOの自動同意を有効にすると，既定の属性のまま同意ボタンを押します．
- 設定や非表示課題はCookie，背景画像はlocalStorage，提出取消後の復帰先はsessionStorageに保存します．端末間では同期しません．
- 締め切りまで3日未満はオレンジ，1日未満は赤の警告背景を優先します．その間，選んだ背景画像は表示されません．
- macOSで基本動作を確認しています．iOS・iPadOSは未確認です．各機能の確認状況やテスト方法は [検証メモ](docs/compatibility.md) にまとめています．

## ライセンス

このスクリプトは，woody-1227さんがMITライセンスで公開されている [Comfortable-Gakujo](https://github.com/woody-1227/Comfortable-Gakujo) を元にしています．元作者の著作権表示とライセンスを引き継ぎ，この移植版も [MITライセンス](LICENSE) で公開しています．

Copyright (c) 2026 woody-1227
