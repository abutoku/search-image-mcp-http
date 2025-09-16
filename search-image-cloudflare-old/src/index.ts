import { z } from 'zod';

export interface Env {
  UNSPLASH_ACCESS_KEY: string;
}

interface MCPRequest {
  jsonrpc: string;
  method: string;
  params?: any;
  id: number | string;
}

interface MCPResponse {
  jsonrpc: string;
  id: number | string;
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}

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

interface UnsplashSearchResponse {
  total: number;
  total_pages: number;
  results: UnsplashPhoto[];
}

const searchImagesSchema = z.object({
  query: z.string().describe('Search query for images'),
  page: z.number().default(1).describe('Page number (default: 1)'),
  per_page: z.number().default(10).describe('Number of items per page (default: 10, max: 30)')
});

async function searchImages(env: Env, params: z.infer<typeof searchImagesSchema>) {
  const { query, page = 1, per_page = 10 } = params;
  
  const response = await fetch('https://api.unsplash.com/search/photos?' + new URLSearchParams({
    query,
    page: page.toString(),
    per_page: Math.min(per_page, 30).toString()
  }), {
    headers: {
      'Authorization': `Client-ID ${env.UNSPLASH_ACCESS_KEY}`,
      'Accept-Version': 'v1'
    }
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('Invalid Unsplash access key');
    }
    throw new Error(`Unsplash API error: ${response.statusText}`);
  }

  const data = await response.json() as UnsplashSearchResponse;
  const { total, total_pages, results } = data;

  if (results.length === 0) {
    return {
      query,
      message: `No images found for query: "${query}"`,
      total: 0,
      results: []
    };
  }

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

  return {
    query,
    total,
    total_pages,
    page,
    results: formattedResults,
  };
}

async function handleMCPRequest(request: MCPRequest, env: Env): Promise<MCPResponse> {
  const { jsonrpc = '2.0', method, params, id } = request;

  try {
    switch (method) {
      case 'initialize':
        return {
          jsonrpc,
          id,
          result: {
            protocolVersion: '2024-11-05',
            capabilities: {
              tools: {}
            },
            serverInfo: {
              name: 'search-image-mcp-cloudflare',
              version: '1.0.0'
            }
          }
        };

      case 'tools/list':
        return {
          jsonrpc,
          id,
          result: {
            tools: [{
              name: 'search_images',
              description: 'Search for images on Unsplash',
              inputSchema: {
                type: 'object',
                properties: {
                  query: {
                    type: 'string',
                    description: 'Search query for images'
                  },
                  page: {
                    type: 'number',
                    description: 'Page number (default: 1)',
                    default: 1
                  },
                  per_page: {
                    type: 'number',
                    description: 'Number of items per page (default: 10, max: 30)',
                    default: 10
                  }
                },
                required: ['query']
              }
            }]
          }
        };

      case 'tools/call':
        const toolName = params?.name;
        const args = params?.arguments || {};

        if (toolName === 'search_images') {
          try {
            const validatedParams = searchImagesSchema.parse(args);
            const result = await searchImages(env, validatedParams);
            
            return {
              jsonrpc,
              id,
              result: {
                content: [{
                  type: 'text',
                  text: JSON.stringify(result, null, 2)
                }]
              }
            };
          } catch (error: any) {
            return {
              jsonrpc,
              id,
              error: {
                code: -32603,
                message: error.message || 'Internal error'
              }
            };
          }
        } else {
          return {
            jsonrpc,
            id,
            error: {
              code: -32601,
              message: `Unknown tool: ${toolName}`
            }
          };
        }

      default:
        return {
          jsonrpc,
          id,
          error: {
            code: -32601,
            message: `Method not found: ${method}`
          }
        };
    }
  } catch (error: any) {
    return {
      jsonrpc,
      id,
      error: {
        code: -32603,
        message: error.message || 'Internal server error'
      }
    };
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    
    if (!env.UNSPLASH_ACCESS_KEY) {
      return new Response('UNSPLASH_ACCESS_KEY is not configured', { status: 500 });
    }

    // CORSヘッダー
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    };

    // OPTIONSリクエストの処理
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    // StreamableHttp/SSEエンドポイント
    if (url.pathname === '/sse') {
      // SSE (Server-Sent Events) の処理
      if (request.headers.get('accept') === 'text/event-stream') {
        const { readable, writable } = new TransformStream();
        const writer = writable.getWriter();
        const encoder = new TextEncoder();

        const headers = {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          ...corsHeaders
        };

        // クライアントに即座にレスポンスを返す
        setTimeout(async () => {
          try {
            // SSEの接続確立メッセージ
            await writer.write(encoder.encode(':ok\n\n'));
            
            // リクエストボディがある場合は処理
            if (request.method === 'POST') {
              const text = await request.text();
              if (text) {
                const requestData = JSON.parse(text) as MCPRequest;
                const response = await handleMCPRequest(requestData, env);
                await writer.write(encoder.encode(`data: ${JSON.stringify(response)}\n\n`));
              }
            }
          } catch (error) {
            console.error('SSE error:', error);
          } finally {
            await writer.close();
          }
        }, 0);

        return new Response(readable, { headers });
      }
      
      // 通常のHTTP POSTリクエスト (StreamableHttp)
      if (request.method === 'POST') {
        try {
          const requestData = await request.json() as MCPRequest;
          const response = await handleMCPRequest(requestData, env);
          
          return new Response(JSON.stringify(response), {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
              ...corsHeaders
            }
          });
        } catch (error: any) {
          return new Response(JSON.stringify({
            jsonrpc: '2.0',
            id: null,
            error: {
              code: -32700,
              message: 'Parse error',
              data: error.message
            }
          }), {
            status: 400,
            headers: {
              'Content-Type': 'application/json',
              ...corsHeaders
            }
          });
        }
      }
    }

    return new Response('MCP Server - Use /sse endpoint', { 
      status: 200,
      headers: {
        'Content-Type': 'text/plain',
        ...corsHeaders
      }
    });
  },
};