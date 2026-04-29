# ▶️ How to Run the application

## 📋 Prerequisites

- **Node.js** ≥ 18 (verified on 24.x)
- **npm** ≥ 9 (verified on 11.x)
- macOS, Linux, or Windows with WSL

Verify your environment:

```bash
node --version
npm --version
```

## 📦 Install

From the `homework-1/` directory:

```bash
cd homework-1
npm install
```

This installs `express`, `zod`, `uuid` and dev tools (`jest`, `supertest`, `nodemon`).

## 🚀 Run the API

### Option 1 — `npm start` (production-like)

```bash
npm start
```

### Option 2 — `npm run dev` (auto-reload via nodemon)

```bash
npm run dev
```

### Option 3 — convenience script

```bash
./demo/run.sh
```

The server listens on **http://localhost:3000** by default. Override with the `PORT` env var:

```bash
PORT=4000 npm start
```

You should see:

```
Banking Transactions API listening on http://localhost:3000
```

Health check: `curl http://localhost:3000/health` → `{"status":"ok"}`

## 🔧 Configuration

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | TCP port the HTTP server listens on |

No `.env` file is required — the application has no external dependencies (storage is in-memory).

## 🧪 Testing

The project ships with 21 Jest + supertest tests covering happy paths, validation, filters, balance math (incl. multi-currency), summary, CSV export (incl. escape edge cases), and 404 fallback.

```bash
npm test
```

Expected output:

```
Test Suites: 1 passed, 1 total
Tests:       21 passed, 21 total
```

## 📡 Quick API smoke test

After `npm start`, in another terminal:

```bash
# Create a deposit
curl -X POST http://localhost:3000/transactions \
  -H "Content-Type: application/json" \
  -d '{"toAccount":"ACC-A0001","amount":1000,"currency":"USD","type":"deposit"}'

# Create a transfer
curl -X POST http://localhost:3000/transactions \
  -H "Content-Type: application/json" \
  -d '{"fromAccount":"ACC-A0001","toAccount":"ACC-B0002","amount":150.50,"currency":"USD","type":"transfer"}'

# Check balance
curl http://localhost:3000/accounts/ACC-A0001/balance
# → {"accountId":"ACC-A0001","balance":{"USD":849.5}}

# Account summary (Bonus A)
curl http://localhost:3000/accounts/ACC-A0001/summary

# Export CSV (Bonus C)
curl "http://localhost:3000/transactions/export?format=csv"
```

A full set of sample requests lives in `demo/sample-requests.http` (works with VS Code REST Client / IntelliJ HTTP Client). Sample request bodies are in `demo/sample-data.json`.

## 🛑 Stopping the server

`Ctrl+C` in the terminal where `npm start` runs. Because storage is in-memory, **all data is lost on restart**.

## ❗ Troubleshooting

| Symptom | Fix |
|---|---|
| `EADDRINUSE: address already in use :::3000` | Port busy. Use `PORT=3001 npm start` or kill the conflicting process: `lsof -ti:3000 \| xargs kill` |
| `Cannot find module 'express'` | Run `npm install` first |
| Tests fail with `ECONNREFUSED` | Tests use supertest in-process — they don't need a running server. If you see this, `npm install` likely didn't finish; re-run it |