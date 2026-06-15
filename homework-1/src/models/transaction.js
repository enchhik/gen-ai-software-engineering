const { v4: uuidv4 } = require("uuid");

const createTransaction = (input) => ({
  id: uuidv4(),
  fromAccount: input.fromAccount ?? null,
  toAccount: input.toAccount ?? null,
  amount: input.amount,
  currency: input.currency.toUpperCase(),
  type: input.type,
  timestamp: new Date().toISOString(),
  status: "completed",
});

module.exports = { createTransaction };