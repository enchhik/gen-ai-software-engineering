const express = require("express");
const storage = require("../storage");
const { ACCOUNT_REGEX } = require("../validators/schema");

const router = express.Router();

const validateAccountId = (id, res) => {
  if (!ACCOUNT_REGEX.test(id)) {
    res.status(400).json({
      error: "Validation failed",
      details: [
        {
          field: "accountId",
          message: "Account must match format ACC-XXXXX (5 alphanumeric)",
        },
      ],
    });
    return false;
  }
  return true;
};

const computeBalanceByCurrency = (accountId) => {
  const balance = {};
  for (const t of storage.list()) {
    if (t.status !== "completed") continue;
    const ccy = t.currency;
    balance[ccy] ??= 0;
    if (t.type === "deposit" && t.toAccount === accountId) {
      balance[ccy] += t.amount;
    } else if (t.type === "withdrawal" && t.fromAccount === accountId) {
      balance[ccy] -= t.amount;
    } else if (t.type === "transfer") {
      if (t.fromAccount === accountId) balance[ccy] -= t.amount;
      if (t.toAccount === accountId) balance[ccy] += t.amount;
    }
  }
  for (const k of Object.keys(balance)) {
    balance[k] = Math.round(balance[k] * 100) / 100;
  }
  return balance;
};

router.get("/:accountId/balance", (req, res) => {
  const { accountId } = req.params;
  if (!validateAccountId(accountId, res)) return;
  res.status(200).json({ accountId, balance: computeBalanceByCurrency(accountId) });
});

router.get("/:accountId/summary", (req, res) => {
  const { accountId } = req.params;
  if (!validateAccountId(accountId, res)) return;

  const related = storage
    .list()
    .filter(
      (t) => t.fromAccount === accountId || t.toAccount === accountId,
    );

  const totalDeposits = {};
  const totalWithdrawals = {};
  let mostRecent = null;

  for (const t of related) {
    if (t.status !== "completed") continue;
    const ccy = t.currency;

    if (t.type === "deposit" && t.toAccount === accountId) {
      totalDeposits[ccy] = (totalDeposits[ccy] ?? 0) + t.amount;
    }
    if (t.type === "withdrawal" && t.fromAccount === accountId) {
      totalWithdrawals[ccy] = (totalWithdrawals[ccy] ?? 0) + t.amount;
    }
    if (t.type === "transfer") {
      if (t.toAccount === accountId) {
        totalDeposits[ccy] = (totalDeposits[ccy] ?? 0) + t.amount;
      }
      if (t.fromAccount === accountId) {
        totalWithdrawals[ccy] = (totalWithdrawals[ccy] ?? 0) + t.amount;
      }
    }

    if (!mostRecent || t.timestamp > mostRecent) {
      mostRecent = t.timestamp;
    }
  }

  for (const obj of [totalDeposits, totalWithdrawals]) {
    for (const k of Object.keys(obj)) {
      obj[k] = Math.round(obj[k] * 100) / 100;
    }
  }

  res.status(200).json({
    accountId,
    totalDeposits,
    totalWithdrawals,
    transactionCount: related.length,
    mostRecentTransactionAt: mostRecent,
  });
});

module.exports = router;