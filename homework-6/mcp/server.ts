import * as path from 'path';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { getTransactionStatus, listPipelineResults, getSummary } from './handlers';

const SHARED = path.join(__dirname, '..', 'shared');

const server = new McpServer({ name: 'pipeline-status', version: '1.0.0' });

server.registerTool(
  'get_transaction_status',
  {
    description: 'Get current status of a transaction from shared/results/',
    inputSchema: { transaction_id: z.string() },
  },
  async ({ transaction_id }) => {
    const r = getTransactionStatus(SHARED, transaction_id);
    return { content: [{ type: 'text' as const, text: r ? JSON.stringify(r, null, 2) : 'not found' }] };
  },
);

server.registerTool(
  'list_pipeline_results',
  { description: 'Summary of all processed transactions', inputSchema: {} },
  async () => ({
    content: [{ type: 'text' as const, text: JSON.stringify(listPipelineResults(SHARED), null, 2) }],
  }),
);

server.registerResource(
  'pipeline-summary',
  'pipeline://summary',
  { description: 'Latest pipeline run summary', mimeType: 'text/plain' },
  async (uri) => ({ contents: [{ uri: uri.href, text: getSummary(SHARED) }] }),
);

async function main(): Promise<void> {
  await server.connect(new StdioServerTransport());
}
main();
