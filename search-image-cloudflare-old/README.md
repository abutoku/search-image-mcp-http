# Search Image MCP Server for Cloudflare Workers

Unsplash画像検索機能を提供するMCP（Model Context Protocol）サーバーのCloudflare Workers実装です。

## ディレクトリ構成

```
search-image-cloudflare/
├── src/
│   └── index.ts         # メインのWorkerハンドラー
├── package.json         # 依存関係と設定
├── wrangler.toml        # Cloudflare Workers設定
├── tsconfig.json        # TypeScript設定
├── .gitignore          # Git除外設定
├── .dev.vars           # ローカル開発用環境変数（作成が必要）
└── README.md           # このファイル
```

## 機能

- Unsplash APIを使用した画像検索
- MCP対応のSSEエンドポイント（`/sse`）
- 認証なしでのアクセス（第1フェーズ）

### 提供ツール

- `search_images`: Unsplashで画像を検索
  - `query` (必須): 検索キーワード
  - `page` (オプション): ページ番号（デフォルト: 1）
  - `per_page` (オプション): 1ページあたりの件数（デフォルト: 10、最大: 30）

## セットアップ

### 1. 依存関係のインストール

```bash
cd search-image-cloudflare
npm install
```

### 2. Unsplash API キーの取得

1. [Unsplash Developers](https://unsplash.com/developers)でアカウントを作成
2. 新しいアプリケーションを作成
3. Access Keyを取得

### 3. 環境変数の設定

#### ローカル開発用

`.dev.vars`ファイルを作成：

```bash
echo 'UNSPLASH_ACCESS_KEY="your-unsplash-access-key"' > .dev.vars
```

#### 本番環境用

Wrangler CLIを使用してシークレットを設定：

```bash
npx wrangler secret put UNSPLASH_ACCESS_KEY
# プロンプトが表示されたらUnsplashのAccess Keyを入力
```

## ローカル開発

### 開発サーバーの起動

```bash
npm run dev
# または
npm start
```

サーバーは `http://localhost:8787/sse` で起動します。

### テスト方法

#### 1. MCP Inspectorを使用

別のターミナルでMCP Inspectorを起動：

```bash
npx @modelcontextprotocol/inspector@latest
```

ブラウザで `http://localhost:5173` を開き、`http://localhost:8787/sse` に接続します。

#### 2. curlでテスト

```bash
# SSEエンドポイントの確認
curl -N http://localhost:8787/sse

# POSTリクエストでツール呼び出し
curl -X POST http://localhost:8787/sse \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
      "name": "search_images",
      "arguments": {
        "query": "mountain"
      }
    },
    "id": 1
  }'
```

## デプロイ

### 1. Cloudflareアカウントの準備

1. [Cloudflare](https://dash.cloudflare.com/)でアカウントを作成
2. Wrangler CLIでログイン：

```bash
npx wrangler login
```

### 2. デプロイ実行

```bash
npm run deploy
```

デプロイ後、以下のようなURLが表示されます：
```
https://search-image-mcp-cloudflare.<your-subdomain>.workers.dev
```

### 3. 本番環境の確認

デプロイ後のURLに `/sse` を追加してアクセス：
```
https://search-image-mcp-cloudflare.<your-subdomain>.workers.dev/sse
```

## Claude Desktopでの使用

### mcp-remoteプロキシ経由での接続

Claude Desktopの設定ファイル（`claude_desktop_config.json`）を編集：

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "search-image": {
      "command": "npx",
      "args": [
        "mcp-remote",
        "https://search-image-mcp-cloudflare.<your-subdomain>.workers.dev/sse"
      ]
    }
  }
}
```

設定後、Claude Desktopを再起動します。

[Claud Desktopのカスタムコネクタには対応できていない](https://github.com/cloudflare/ai/tree/main/demos/remote-mcp-authless)

## トラブルシューティング

### UNSPLASH_ACCESS_KEYエラー

```
UNSPLASH_ACCESS_KEY is not configured
```

このエラーが表示される場合：

1. ローカル開発: `.dev.vars`ファイルが正しく設定されているか確認
2. 本番環境: `wrangler secret put UNSPLASH_ACCESS_KEY`でシークレットを設定

### CORSエラー

ブラウザからアクセスする際にCORSエラーが発生する場合、`src/index.ts`のCORSヘッダー設定を確認してください。

### ログの確認

デプロイ後のログを確認：

```bash
npm run tail
```

## 今後の拡張予定

- 第2フェーズ: OAuth認証の実装
- レート制限の追加
- キャッシュ機能の実装
- カスタムドメインの設定

## ライセンス

MIT

## コマンド

```
npm install -g wrangler
```
```
wrangler login
```
```
wrangler logout
```
```
wrangler whoami
```