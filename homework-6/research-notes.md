# Research Notes — context7 queries

## Query 1: precise monetary arithmetic in Node
- Search: "precise decimal monetary arithmetic with ROUND_HALF_UP in Node.js" (library: decimal.js)
- context7 library ID: /mikemcl/decimal.js
- Key insight: decimal.js's default rounding mode is already ROUND_HALF_UP (numeric 4). The money
  code configures it explicitly via `Decimal.set({ rounding: Decimal.ROUND_HALF_UP })` and rounds
  with `toDecimalPlaces(2, Decimal.ROUND_HALF_UP)` / `toFixed(2)`. Applied in lib/money.ts so the
  0.5% settlement fee on 9999.99 (= 49.99995) rounds to 50.00. No JS floats are used for amounts.

## Query 2: building an MCP server in TypeScript
- Search: "McpServer registerTool/registerResource over StdioServerTransport" (library: MCP TS SDK)
- context7 library ID: /modelcontextprotocol/typescript-sdk
- Key insight: an McpServer is created with `new McpServer({ name, version })`; tools are registered
  via `registerTool(name, { description, inputSchema }, handler)` returning
  `{ content: [{ type: 'text', text }] }`; resources via `registerResource(name, uri, metadata,
  handler)` returning `{ contents: [{ uri, text }] }`; and served with
  `await server.connect(new StdioServerTransport())`. Applied in mcp/server.ts for
  get_transaction_status, list_pipeline_results, and resource pipeline://summary.
