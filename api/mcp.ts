import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createMcpServer } from './_lib/mcp/index.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { verifyMcpToken } from './_lib/mcp/auth.js';

export const maxDuration = 60;
export const config = { api: { bodyParser: false } };

/**
 * Official MuviDB Model Context Protocol (MCP) Remote Serverless Endpoint.
 * OAuth-gated for ChatGPT custom MCP connector, Claude web, and remote AI agents.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Global CORS headers for remote MCP clients (ChatGPT, Claude, IDEs)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, HEAD');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, Accept, x-session-id, x-mcp-version, mcp-session-id'
  );

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  // Handle health check / info query
  if (req.method === 'GET' && !req.headers.accept?.includes('text/event-stream')) {
    return res.status(200).json({
      name: 'muvidb-mcp',
      description: 'The official MuviDB Model Context Protocol (MCP) server for Nollywood and African cinema.',
      version: '1.0.0',
      status: 'online',
      protocol: 'streamable-http',
      endpoint: '/api/mcp',
      authentication: 'OAuth 2.1 / Bearer Token',
      auth_docs: 'https://muvidb.com/dashboard?tab=ai-mcp',
      protected_resource: 'https://muvidb.com/.well-known/oauth-protected-resource',
      tools: [
        'search_films',
        'get_film_details',
        'get_film_credits',
        'get_where_to_watch',
        'search_people',
        'get_person_filmography',
        'get_awards_and_nominations',
        'get_box_office_rankings'
      ]
    });
  }

  // Gate all protocol operations (POST initialize, tool call, SSE streams) with OAuth Bearer Token
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.setHeader(
      'WWW-Authenticate',
      'Bearer realm="muvidb-mcp", resource_metadata="https://muvidb.com/.well-known/oauth-protected-resource"'
    );
    return res.status(401).json({
      jsonrpc: '2.0',
      error: {
        code: -32001,
        message:
          'Unauthorized: MuviDB account required. Connect your account via OAuth or provide an Authorization: Bearer <token> header.'
      },
      id: null
    });
  }

  const token = authHeader.slice(7).trim();
  const session = await verifyMcpToken(token);
  if (!session) {
    res.setHeader(
      'WWW-Authenticate',
      'Bearer error="invalid_token", error_description="The access token is expired or invalid"'
    );
    return res.status(401).json({
      jsonrpc: '2.0',
      error: {
        code: -32001,
        message: 'Unauthorized: Invalid or expired Bearer token. Please re-authenticate your MuviDB account.'
      },
      id: null
    });
  }

  try {
    const server = createMcpServer();
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined // Stateless mode for serverless functions
    });

    await server.connect(transport);
    await transport.handleRequest(req, res);
  } catch (err: any) {
    console.error('[MuviDB MCP Error]', err);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: '2.0',
        error: {
          code: -32603,
          message: err.message || 'Internal MCP server error'
        },
        id: null
      });
    }
  }
}
