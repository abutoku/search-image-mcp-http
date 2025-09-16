# Search Image MCP Server for Cloudflare Workers

Unsplash画像検索機能を提供するMCP（Model Context Protocol）サーバーのCloudflare Workers実装です。

```
npm create cloudflare@latest app-name
```

```
╭ Create an application with Cloudflare Step 1 of 3
│
├ In which directory do you want to create your application?
│ dir ./my-mcp-server
│
├ What would you like to start with?
│ category Hello World example
│
├ Which template would you like to use?
│ type Worker + Durable Objects
│
├ Which language do you want to use?
│ lang TypeScript
│
├ Copying template files
│ files copied to project directory
│
├ Updating name in `package.json`
│ updated `package.json`
│
┴ Installing dependencies
```

```
npm install agents @modelcontextprotocol/sdk zod
```

```
wrangler dev
```

```
wrangler deploy
```

```
wrangler secret put UNSPLASH_ACCESS_KEY
```


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
