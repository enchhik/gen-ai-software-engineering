const transactions = [];

const add = (transaction) => {
  transactions.push(transaction);
  return transaction;
};

const list = () => transactions.slice();

const findById = (id) => transactions.find((t) => t.id === id) ?? null;

const reset = () => {
  transactions.length = 0;
};

module.exports = { add, list, findById, reset };