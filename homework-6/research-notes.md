# Research Notes — context7 queries

These two libraries were looked up via the context7 MCP server during code generation.

## Query 1: precise monetary arithmetic in Node
- Search: "decimal.js money rounding ROUND_HALF_UP, round to 2 decimal places"
- context7 library ID: /mikemcl/decimal.js
- Key insight applied: `ROUND_HALF_UP` is decimal.js's default rounding mode (mode 4). We set it
  explicitly via `Decimal.set({ rounding: Decimal.ROUND_HALF_UP })` and compute settlement fees with
  `amount.times(0.005).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2)`, so 49.99995 → "50.00".
  No JavaScript `number`/float is used for money.

## Query 2: building an MCP server in TypeScript
- Search: "McpServer registerTool registerResource StdioServerTransport zod input schema"
- context7 library ID: /modelcontextprotocol/typescript-sdk
- Key insight applied: with @modelcontextprotocol/sdk v1.29.0 we use `new McpServer({name,version})`,
  `server.registerTool(name, { description, inputSchema }, handler)`, `server.registerResource(name,
  uri, { description, mimeType }, handler)`, and connect over `StdioServerTransport`. Tool handlers
  return `{ content: [{ type: 'text', text }] }`; the resource handler returns
  `{ contents: [{ uri: uri.href, text }] }`.
