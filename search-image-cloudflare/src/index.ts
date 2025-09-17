import { SearchImageMCP } from './searchImage.js';

// Durable Objects のエクスポート
export { SearchImageMCP };

export default {
	fetch(request: Request, env: Env, ctx: ExecutionContext) {
		const url = new URL(request.url);

		// /sse エンドポイントの場合は SSE で応答する
		if (url.pathname === '/sse' || url.pathname === '/sse/message') {
			// @ts-ignore
			return SearchImageMCP.serveSSE('/sse').fetch(request, env, ctx);
		}

		// /mcp エンドポイントの場合は Streamable HTTP で応答する
		if (url.pathname === '/mcp') {
			// @ts-ignore
			return SearchImageMCP.serve('/mcp').fetch(request, env, ctx);
		}

		return new Response('Not found', { status: 404 });
	},
};
