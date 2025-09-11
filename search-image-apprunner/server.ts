import express from 'express';
import { randomUUID } from 'node:crypto';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const UNSPLASH_ACCESS_KEY = process.env.UNSPLASH_ACCESS_KEY;
const PORT = parseInt(process.env.PORT || '8080', 10);

if (!UNSPLASH_ACCESS_KEY) {
  console.error('Error: UNSPLASH_ACCESS_KEY environment variable is required');
  process.exit(1);
}

interface SearchParams {
  query: string;
  page?: number;
  per_page?: number;
}

interface ImageUrls {
  small: string;
  regular: string;
  full: string;
}

interface Photographer {
  name: string;
  username: string;
}

interface ImageResult {
  id: string;
  description: string;
  urls: ImageUrls;
  photographer: Photographer;
  link: string;
}

interface SearchResult {
  query: string;
  total: number;
  total_pages: number;
  page: number;
  results: ImageResult[];
}

async function searchImages(params: SearchParams): Promise<SearchResult> {
  const { query, page = 1, per_page = 10 } = params;
  
  try {
    const response = await axios.get('https://api.unsplash.com/search/photos', {
      headers: {
        'Authorization': `Client-ID ${UNSPLASH_ACCESS_KEY}`,
        'Accept-Version': 'v1'
      },
      params: {
        query,
        page,
        per_page: Math.min(per_page, 30)
      }
    });

    const data = response.data;
    
    return {
      query,
      total: data.total,
      total_pages: data.total_pages,
      page: data.page || page,
      results: data.results.map((photo: any) => ({
        id: photo.id,
        description: photo.description || photo.alt_description || 'No description',
        urls: {
          small: photo.urls.small,
          regular: photo.urls.regular,
          full: photo.urls.full
        },
        photographer: {
          name: photo.user.name,
          username: photo.user.username
        },
        link: photo.links.html
      }))
    };
  } catch (error: any) {
    if (error.response?.status === 401) {
      throw new Error('Invalid Unsplash API key. Please check your UNSPLASH_ACCESS_KEY environment variable.');
    } else if (error.response?.status === 403) {
      throw new Error('Rate limit exceeded. Please try again later.');
    } else if (error.response) {
      throw new Error(`Unsplash API error: ${error.response.status} - ${error.response.statusText}`);
    } else {
      throw new Error(`Failed to search images: ${error.message}`);
    }
  }
}

const app = express();
app.use(express.json());

// Map to store transports by session ID
const transports: { [sessionId: string]: StreamableHTTPServerTransport } = {};

// Handle POST requests for client-to-server communication
app.post('/mcp/v1/sse', async (req, res) => {
  // Check for existing session ID
  const sessionId = req.headers['mcp-session-id'] as string | undefined;
  let transport: StreamableHTTPServerTransport;

  if (sessionId && transports[sessionId]) {
    // Reuse existing transport
    transport = transports[sessionId];
  } else if (!sessionId && isInitializeRequest(req.body)) {
    // New initialization request
    transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      onsessioninitialized: (sessionId) => {
        // Store the transport by session ID
        transports[sessionId] = transport;
      },
      // Disable DNS rebinding protection for MCP prototype
      enableDnsRebindingProtection: false,
    });

    // Clean up transport when closed
    transport.onclose = () => {
      if (transport.sessionId) {
        delete transports[transport.sessionId];
      }
    };
    
    // Create MCP server
    const server = new McpServer({
      name: 'search-image-mcp-apprunner',
      version: '1.0.0'
    });

    // Register the search_images tool
    server.registerTool(
      'search_images',
      {
        title: 'Search Images',
        description: 'Search for images using Unsplash API',
        inputSchema: {
          query: z.string().describe('Search query for images'),
          page: z.number().optional().describe('Page number for pagination (default: 1)'),
          per_page: z.number().optional().describe('Number of results per page (default: 10, max: 30)')
        }
      },
      async ({ query, page, per_page }) => {
        try {
          const results = await searchImages({ 
            query, 
            page: page ?? 1, 
            per_page: per_page ?? 10 
          });
          
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(results, null, 2)
              }
            ]
          };
        } catch (error: any) {
          return {
            content: [
              {
                type: 'text',
                text: `Error: ${error.message}`
              }
            ]
          };
        }
      }
    );

    // Connect to the MCP server
    await server.connect(transport);
  } else {
    // Invalid request
    res.status(400).json({
      jsonrpc: '2.0',
      error: {
        code: -32000,
        message: 'Bad Request: No valid session ID provided',
      },
      id: null,
    });
    return;
  }

  // Handle the request
  await transport.handleRequest(req, res, req.body);
});

// Reusable handler for GET and DELETE requests
const handleSessionRequest = async (req: express.Request, res: express.Response) => {
  const sessionId = req.headers['mcp-session-id'] as string | undefined;
  
  if (!sessionId || !transports[sessionId]) {
    res.status(400).send('Invalid or missing session ID');
    return;
  }
  
  const transport = transports[sessionId];
  await transport.handleRequest(req, res);
};

// Handle GET requests for server-to-client notifications via SSE
app.get('/mcp/v1/sse', handleSessionRequest);

// Handle DELETE requests for session termination
app.delete('/mcp/v1/sse', handleSessionRequest);

// CORS preflight handler
app.options('/mcp/v1/sse', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, mcp-session-id');
  res.setHeader('Access-Control-Max-Age', '86400');
  res.status(204).send();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'healthy', 
    service: 'search-image-mcp',
    activeSessions: Object.keys(transports).length
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    service: 'search-image-mcp-apprunner',
    version: '1.0.0',
    endpoints: {
      mcp: '/mcp/v1/sse',
      health: '/health'
    }
  });
});

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Express error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Global error handlers
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`MCP Server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`MCP endpoint: http://localhost:${PORT}/mcp/v1/sse`);
}).on('error', (error) => {
  console.error('Server startup error:', error);
  process.exit(1);
});