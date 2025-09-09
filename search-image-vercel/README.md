# Search Image MCP Server for vercel

Unsplash APIを使用した画像検索機能を提供するHTTP版MCPサーバーです。
Vercelにデプロイして、Claude DesktopからHTTP経由でアクセスできます。

## プロジェクト概要

- **名前**: search-image-vercel
- **通信方式**: HTTP/HTTPS
- **プラットフォーム**: Vercel
- **機能**: Unsplash API経由での画像検索
- **MCPライブラリ**: mcp-handler

## ディレクトリ構成

```
search-image-vercel/
├── src/
│   └── app/
│       └── mcp/
│           └── route.ts              # MCP API エンドポイント
├── .env.local                        # 環境変数（ローカル開発用）
├── vercel.json                       # Vercel デプロイ設定
├── package.json                      # 依存関係とスクリプト
├── next.config.mjs                   # Next.js 設定
├── tsconfig.json                     # TypeScript 設定
└── README.md                         # このファイル
```

## セットアップ

### 1. 依存関係のインストール

```bash
cd search-image-vercel
npm install
```

### 2. Unsplash API キーの取得

1. [Unsplash Developers](https://unsplash.com/developers) にアクセス
2. アカウント作成/ログイン
3. 新しいアプリケーションを作成
4. Access Key をコピー

### 3. 環境変数の設定

`.env.local` ファイルを編集：

```env
UNSPLASH_ACCESS_KEY=your_actual_unsplash_access_key_here
```

## ローカル開発

```bash

npm run dev
```

開発サーバーが `http://localhost:3000` で起動します。

### ローカルでのテスト

```bash
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/list",
    "id": 1
  }'
```

画像検索のテスト:

```bash
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
      "name": "search_images",
      "arguments": {
        "query": "nature",
        "per_page": 5
      }
    },
    "id": 2
  }'
```

## Vercel デプロイ

### 1. Vercel CLI のインストール

```bash
npm i -g vercel
```

### 2. Vercelプロジェクトの初期化

```bash
vercel
```

初回実行時は以下の設定を選択：
- Set up and deploy? → Yes
- Which scope? → 個人アカウントを選択
- Link to existing project? → No
- Project name → search-image-mcp-http（またはお好みの名前）
- Directory → ./
- Override settings? → No

### 3. 環境変数の設定

Vercelダッシュボードまたはコマンドラインで環境変数を設定：

```bash
vercel env add UNSPLASH_ACCESS_KEY
# プロンプトでアクセスキーを入力
```

### 4. 本番環境へのデプロイ

```bash
vercel --prod
```

デプロイ完了後、URLが表示されます（例: `https://your-project-name.vercel.app`）

## Claude Desktop 設定

設定→コネクタ→カスタムコネクタを追加
VercelデプロイURL入力

[接続について](https://vercel.com/docs/mcp/vercel-mcp)

**重要**: エンドポイントは `/mcp` です。

## 使用方法

Claude Desktopで以下のようなプロンプトを試してください：

```
自然の美しい風景の画像を5枚検索して
```

```
猫の画像を検索して、3枚表示して
```

## API仕様

### エンドポイント

- **URL**: `/mcp`
- **Method**: GET, POST
- **Content-Type**: application/json
- **Accept**: application/json, text/event-stream

### ツール: search_images

**パラメータ**:
- `query` (string, 必須): 検索キーワード
- `page` (number, オプション): ページ番号（デフォルト: 1）
- `per_page` (number, オプション): 1ページあたりの件数（デフォルト: 10, 最大: 30）

**レスポンス例**:
```json
{
  "query": "nature",
  "total": 1500,
  "total_pages": 150,
  "page": 1,
  "results": [
    {
      "id": "abc123",
      "description": "Beautiful landscape",
      "urls": {
        "small": "https://...",
        "regular": "https://...",
        "full": "https://..."
      },
      "photographer": {
        "name": "John Doe",
        "username": "johndoe"
      },
      "link": "https://unsplash.com/photos/abc123"
    }
  ]
}
```

## トラブルシューティング

### よくある問題

1. **環境変数が設定されていない**
   - `.env.local`（ローカル）やVercelの環境変数設定を確認

2. **401 Unauthorized エラー**
   - Unsplash API キーが正しく設定されているか確認

3. **Claude Desktopで認識されない**
   - 設定ファイルの JSON 構文が正しいか確認
   - Claude Desktopを再起動

### ログの確認

Vercelのログを確認：
```bash
vercel logs
```

## ライセンス

MIT License

## 参考リンク

- [Unsplash API Documentation](https://unsplash.com/documentation)
- [Vercel Documentation](https://vercel.com/docs)
- [Model Context Protocol](https://modelcontextprotocol.io/)
- [mcp-handler](https://www.npmjs.com/package/mcp-handler)
- [Vercel MCP Support](https://vercel.com/changelog/mcp-server-support-on-vercel)
- [Next.js MCP Template](https://vercel.com/templates/next.js/model-context-protocol-mcp-with-next-js)
- [Mcp Handler](https://github.com/vercel/mcp-handler)