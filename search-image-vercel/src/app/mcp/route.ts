import { createMcpHandler } from 'mcp-handler';
import { z } from 'zod';
import axios from 'axios';

// Unsplash APIのベースURLとアクセスキーの設定
const UNSPLASH_API_BASE = 'https://api.unsplash.com';
const UNSPLASH_ACCESS_KEY = process.env.UNSPLASH_ACCESS_KEY;

// Unsplash APIから返される写真データの型定義
interface UnsplashPhoto {
  id: string;
  description: string | null;
  alt_description: string | null;
  urls: {
    raw: string;
    full: string;
    regular: string;
    small: string;
    thumb: string;
  };
  links: {
    self: string;
    html: string;
    download: string;
  };
  user: {
    name: string;
    username: string;
  };
}

// Unsplash検索APIのレスポンス型定義
interface UnsplashSearchResponse {
  total: number;
  total_pages: number;
  results: UnsplashPhoto[];
}

const handler = createMcpHandler((server) => {
  server.tool(
    'search_images',
    'Search for images on Unsplash',
    {
      query: z.string().describe('Search query for images'),
      page: z.number().int().min(1).default(1).describe('Page number (default: 1)'),
      per_page: z.number().int().min(1).max(30).default(10).describe('Number of items per page (default: 10, max: 30)'),
    },
    async ({ query, page, per_page }) => {
      // 環境変数からアクセスキーが取得できない場合はエラー
      if (!UNSPLASH_ACCESS_KEY) {
        return {
          content: [
            {
              type: 'text',
              text: 'Error: UNSPLASH_ACCESS_KEY environment variable is not set',
            },
          ],
        };
      }

      try {
        // Unsplash APIにHTTPリクエストを送信
        const response = await axios.get<UnsplashSearchResponse>(
          `${UNSPLASH_API_BASE}/search/photos`,
          {
            headers: {
              // 認証ヘッダーにアクセスキーを設定
              Authorization: `Client-ID ${UNSPLASH_ACCESS_KEY}`,
            },
            params: {
              query,
              page,
              per_page: Math.min(per_page, 30), // 最大30件に制限
            },
          }
        );

        const { total, total_pages, results } = response.data;

        // 検索結果が0件の場合
        if (results.length === 0) {
          return {
            content: [
              {
                type: 'text',
                text: `No images found for query: "${query}"`,
              },
            ],
          };
        }

        // 結果を整形して必要な情報のみを抽出
        const formattedResults = results.map((photo) => ({
          id: photo.id,
          description: photo.description || photo.alt_description || 'No description',
          urls: {
            small: photo.urls.small,
            regular: photo.urls.regular,
            full: photo.urls.full,
          },
          photographer: {
            name: photo.user.name,
            username: photo.user.username,
          },
          link: photo.links.html,
        }));

        // 整形した結果をJSON形式で返す
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  query,
                  total,
                  total_pages,
                  page,
                  results: formattedResults,
                },
                null,
                2 // インデント幅2で整形
              ),
            },
          ],
        };
      } catch (error) {
        // エラーハンドリング
        if (axios.isAxiosError(error)) {
          // 401エラー（認証エラー）の場合
          if (error.response?.status === 401) {
            return {
              content: [
                {
                  type: 'text',
                  text: 'Invalid Unsplash access key. Please check your UNSPLASH_ACCESS_KEY environment variable.',
                },
              ],
            };
          }
          // その他のAPIエラー
          return {
            content: [
              {
                type: 'text',
                text: `Unsplash API error: ${error.response?.data?.errors?.join(', ') || error.message}`,
              },
            ],
          };
        }
        // 予期しないエラー
        return {
          content: [
            {
              type: 'text',
              text: `Failed to search images: ${error}`,
            },
          ],
        };
      }
    }
  );
});

export { handler as GET, handler as POST };