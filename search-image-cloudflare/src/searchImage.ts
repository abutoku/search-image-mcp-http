import { McpAgent } from 'agents/mcp';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

export class SearchImageMCP extends McpAgent {
	server = new McpServer({
		name: 'SearchImageMCP Server',
		version: '0.1.0',
	});

	async init() {
		this.server.tool(
			// ツールの名前
			'search_image',
			// ツールの説明
			'Unsplash APIを使用して画像を検索します',
			// ツールの引数のスキーマ
			{
				query: z.string().min(1).describe('検索クエリ'),
				per_page: z.number().min(1).max(30).default(10).describe('取得する画像の数'),
				page: z.number().min(1).default(1).describe('ページ番号'),
			},
			// ツールの実行関数
			async ({ query, per_page, page }) => {
				try {
					// Unsplash API のアクセスキー
					const accessKey = process.env.UNSPLASH_ACCESS_KEY;

					if (!accessKey) {
						throw new Error('Unsplash API access key not configured');
					}

					// Unsplash Search API エンドポイント
					const url = new URL('https://api.unsplash.com/search/photos');
					url.searchParams.append('query', query);
					url.searchParams.append('per_page', per_page.toString());
					url.searchParams.append('page', page.toString());

					const response = await fetch(url.toString(), {
						headers: {
							'Authorization': `Client-ID ${accessKey}`,
						},
					});

					if (!response.ok) {
						throw new Error(`Unsplash API error: ${response.statusText}`);
					}

					const data = await response.json();
					const photos = data.results || [];

					// 画像結果をフォーマット
					const formattedResults = photos.map((photo: any) => ({
						id: photo.id,
						description: photo.description || photo.alt_description,
						urls: {
							raw: photo.urls.raw,
							full: photo.urls.full,
							regular: photo.urls.regular,
							small: photo.urls.small,
							thumb: photo.urls.thumb,
						},
						width: photo.width,
						height: photo.height,
						color: photo.color,
						user: {
							name: photo.user.name,
							username: photo.user.username,
							profile_url: photo.user.links.html,
						},
						download_link: photo.links.download,
						html_link: photo.links.html,
					}));

					return {
						content: [
							{
								type: 'text',
								text: JSON.stringify({
									query,
									total: data.total,
									total_pages: data.total_pages,
									page,
									per_page,
									results: formattedResults,
								}, null, 2),
							},
						],
					};
				} catch (error) {
					return {
						content: [
							{
								type: 'text',
								text: `Error searching images: ${error.message}`,
							},
						],
						isError: true,
					};
				}
			}
		);
	}
}
