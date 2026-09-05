# claude-auto-yes

Claude Code の確認プロンプト(`Do you want to proceed?` / フォルダ信頼確認など)を、
自前の PTY ラッパー経由で自動的に「Yes」応答するツール。

## これは何をするか / 何をしないか

- `claude` を直接起動する代わりに、擬似端末(PTY)を自前で持つラッパー経由で起動します。
- 画面に表示される確認プロンプトを検知し、肯定側の選択肢を自動で選びます。
- **完全自動承認です。** `rm -rf` や `git push --force` のような危険な操作を含め、
  選別なしに全ての確認プロンプトが自動でYesになります。

### ⚠️ 重要なリスク(必ず読んでください)

確認プロンプトは、取り返しのつかない操作に対する最後の人間の関門です。
このツールはその関門を意図的に無効化します。組織のポリシーでこのプロンプトが
無効化できないようになっている場合、本ツールで自動化すること自体が
社内規程に抵触する可能性があります。**利用可否は自己責任で判断してください。**

緩和策として以下を実装しています:

- **監査ログ**: 何を自動承認したか(実行されるコマンド本文を含む)を全て記録します。
- **即時キルスイッチ**: `claude-auto-yes off` で実行中の全セッションを即座に停止できます。
- **`--dry-run`**: 検知はするが送信はしないモード。導入時・アップグレード後の確認用。
- **`enabledCwdPatterns`**: 特定ディレクトリ配下だけで有効化する設定(既定は全許可)。

## セットアップ(新しいPCでも共通の手順)

### 前提条件

- Windows 10 (1809+) / Windows 11
- [Node.js](https://nodejs.org/) 20 以上(`node -v` で確認)
- [Claude Code](https://code.claude.com/) がインストール済みで、`claude` コマンドとして使える状態
- Git と PowerShell(Windows PowerShell 5.1 / PowerShell 7 どちらでも可)
- GitHubのプライベートリポジトリなので、`git clone` にはこのリポジトリへのアクセス権が必要です

### 手順

```powershell
git clone https://github.com/MasatoshiSano/claude-auto-yes.git
cd claude-auto-yes
npm install
npm run build
npm link
```

`npm link` で `claude-auto-yes` / `cly` コマンドがグローバルに使えるようになります
(`npm install` は `node-pty` の prebuilt バイナリをそのマシンの Node バージョン向けに
取得するので、初回は数十秒かかることがあります)。

続けて PowerShell プロファイルに自動導線を追加します:

```powershell
claude-auto-yes install
```

これは **実際にそのマシンで使われている `$PROFILE`** を Windows PowerShell / PowerShell 7
それぞれに問い合わせて解決するので、手動でパスを指定する必要はありません
(Windows PowerShell 5.1 の `Documents\WindowsPowerShell\...` と、PowerShell 7 の
`Documents\PowerShell\...` の違い、OneDriveでリダイレクトされたドキュメントフォルダ
なども自動で吸収します)。両方インストールされていれば両方に追記されます。

`$PROFILE` に以下が追記されます(冪等。再実行しても重複しません。既存の内容はそのまま残ります):

```powershell
# --- claude-auto-yes ---
function claude {
    claude-auto-yes @args
}
# --- /claude-auto-yes ---
```

**新しい** Windows Terminal タブや VS Code 統合ターミナルを開くと、`claude` コマンドが
自動的にラッパー経由になります(`install` した時点で既に開いていたタブには反映されません。
`Get-Command claude` を実行して `CommandType: Function` と出れば有効になっている証拠です)。

### 動作確認

導入直後は、いきなり本番で使う前に一度確認することを推奨します。

```powershell
claude-auto-yes off
mkdir C:\path\to\somewhere\cly-test   # 一度も claude で開いたことのない新規フォルダ
cd C:\path\to\somewhere\cly-test
claude --dry-run
```

「フォルダを信頼しますか」という確認が出た状態でキーが送信されず止まっていれば、
検知は正しく動いています。`claude-auto-yes log` で `dry_run` イベントが記録されている
ことを確認したら `claude-auto-yes on` で有効化してください。

### アンインストール

```powershell
claude-auto-yes uninstall
```

## 使い方

インストール後は普段どおり `claude` と打つだけです。体験は素の Claude Code と同じで、
矢印キー・Ctrl+C・色付き表示などは全て透過的に中継されます。

### コマンド

| コマンド | 効果 |
|---|---|
| `claude-auto-yes off` | 実行中の全セッションを含め、自動承認を即座に無効化 |
| `claude-auto-yes on` | 自動承認を再度有効化 |
| `claude-auto-yes status` | 現在の有効状態・設定ファイル・ログの場所を表示 |
| `claude-auto-yes log` | 自動承認の履歴を表示(`--since 7d` / `--raw` オプションあり) |
| `claude <args>` (エイリアス経由) | `--dry-run` / `--verbose` / `--no-auto` を付けて起動可能 |

### 導入直後の推奨手順

```powershell
claude-auto-yes off   # まず自動送信を止めておく
claude --dry-run       # 実際に何が自動承認されそうかログだけで確認する
claude-auto-yes log
claude-auto-yes on     # 問題なければ有効化
```

## 設定ファイル

`%APPDATA%\claude-auto-yes\config.json`(存在しなければ既定値で動作)。
検知パターン・タイミング・ログ保持期間などを変更できます。詳細はソースの
`src/config/defaults.ts` の `DEFAULT_CONFIG` を参照してください。

## ログ

`%LOCALAPPDATA%\claude-auto-yes\logs\YYYY-MM-DD.jsonl` に JSON Lines 形式で記録されます。
既定で30日を超えたログは自動削除されます。

## 既知の限界

- Claude Code の表示形式が将来変わった場合、検知が効かなくなることがあります
  (暴走ではなく「何もしない」側に倒れる設計です。手動で応答してください)。
- 選択肢が10件を超えるような特殊なダイアログには未対応です。
- `node-pty` は Node のメジャーバージョンが変わるとネイティブモジュールの
  再ビルドが必要になることがあります(`npm rebuild node-pty`)。
