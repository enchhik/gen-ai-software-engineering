const express = require("express");
const storage = require("../storage");
const { createTransaction } = require("../models/transaction");
const {
  createTransactionSchema,
  formatZodErrors,
} = require("../validators/schema");

const router = express.Router();

const parseDateBoundary = (value, endOfDay) => {
  if (!value) return null;
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
  const iso = dateOnly
    ? `${value}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}Z`
    : value;
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? NaN : ms;
};

const toCsv = (rows) => {
  const headers = [
    "id",
    "fromAccount",
    "toAccount",
    "amount",
    "currency",
    "type",
    "timestamp",
    "status",
  ];
  const escape = (val) => {
    if (val === null || val === undefined) return "";
    const str = String(val);
    return /[",\n\r]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
  };
  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(headers.map((h) => escape(row[h])).join(","));
  }
  return lines.join("\n");
};

router.post("/", (req, res) => {
  const parsed = createTransactionSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: "Validation failed",
      details: formatZodErrors(parsed.error),
    });
  }
  const transaction = createTransaction(parsed.data);
  storage.add(transaction);
  res.status(201).json(transaction);
});

router.get("/export", (req, res) => {
  const format = (req.query.format ?? "csv").toString().toLowerCase();
  if (format !== "csv") {
    return res.status(400).json({
      error: "Unsupported export format",
      details: [{ field: "format", message: "Only 'csv' is supported" }],
    });
  }
  const csv = toCsv(storage.list());
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader(
    "Content-Disposition",
    'attachment; filename="transactions.csv"',
  );
  res.status(200).send(csv);
});

router.get("/", (req, res) => {
  const { accountId, type, from, to } = req.query;

  const fromMs = parseDateBoundary(from, false);
  const toMs = parseDateBoundary(to, true);

  if (Number.isNaN(fromMs)) {
    return res.status(400).json({
      error: "Validation failed",
      details: [{ field: "from", message: "Invalid date" }],
    });
  }
  if (Number.isNaN(toMs)) {
    return res.status(400).json({
      error: "Validation failed",
      details: [{ field: "to", message: "Invalid date" }],
    });
  }

  let result = storage.list();

  if (accountId) {
    result = result.filter(
      (t) => t.fromAccount === accountId || t.toAccount === accountId,
    );
  }
  if (type) {
    result = result.filter((t) => t.type === type);
  }
  if (fromMs !== null) {
    result = result.filter((t) => Date.parse(t.timestamp) >= fromMs);
  }
  if (toMs !== null) {
    result = result.filter((t) => Date.parse(t.timestamp) <= toMs);
  }

  res.status(200).json(result);
});

router.get("/:id", (req, res) => {
  const transaction = storage.findById(req.params.id);
  if (!transaction) {
    return res
      .status(404)
      .json({ error: "Transaction not found", id: req.params.id });
  }
  res.status(200).json(transaction);
});

module.exports = router;