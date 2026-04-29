const express = require("express");
const transactionsRouter = require("./routes/transactions");
const accountsRouter = require("./routes/accounts");

const buildApp = () => {
  const app = express();

  app.use(express.json());

  app.get("/health", (_req, res) => {
    res.status(200).json({ status: "ok" });
  });

  app.use("/transactions", transactionsRouter);
  app.use("/accounts", accountsRouter);

  app.use((_req, res) => {
    res.status(404).json({ error: "Not found" });
  });

  app.use((err, _req, res, _next) => {
    if (err.type === "entity.parse.failed") {
      return res.status(400).json({
        error: "Invalid JSON body",
        details: [{ field: "body", message: err.message }],
      });
    }
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  });

  return app;
};

if (require.main === module) {
  const port = Number(process.env.PORT) || 3000;
  buildApp().listen(port, () => {
    console.log(`Banking Transactions API listening on http://localhost:${port}`);
  });
}

module.exports = { buildApp };