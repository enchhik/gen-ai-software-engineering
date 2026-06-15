const request = require("supertest");
const { buildApp } = require("../src/index");
const storage = require("../src/storage");

describe("Banking Transactions API", () => {
  let app;

  beforeEach(() => {
    storage.reset();
    app = buildApp();
  });

  describe("POST /transactions", () => {
    it("creates a deposit", async () => {
      const res = await request(app)
        .post("/transactions")
        .send({
          toAccount: "ACC-A0001",
          amount: 100.5,
          currency: "USD",
          type: "deposit",
        });
      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({
        toAccount: "ACC-A0001",
        amount: 100.5,
        currency: "USD",
        type: "deposit",
        status: "completed",
      });
      expect(res.body.id).toBeDefined();
      expect(res.body.timestamp).toBeDefined();
    });

    it("rejects invalid account format", async () => {
      const res = await request(app).post("/transactions").send({
        fromAccount: "BAD-1",
        toAccount: "ACC-B0002",
        amount: 10,
        currency: "USD",
        type: "transfer",
      });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe("Validation failed");
      expect(res.body.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ field: "fromAccount" }),
        ]),
      );
    });

    it("rejects negative amount", async () => {
      const res = await request(app).post("/transactions").send({
        toAccount: "ACC-A0001",
        amount: -1,
        currency: "USD",
        type: "deposit",
      });
      expect(res.status).toBe(400);
      expect(res.body.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ field: "amount" }),
        ]),
      );
    });

    it("rejects amount with > 2 decimal places", async () => {
      const res = await request(app).post("/transactions").send({
        toAccount: "ACC-A0001",
        amount: 10.123,
        currency: "USD",
        type: "deposit",
      });
      expect(res.status).toBe(400);
    });

    it("rejects invalid currency", async () => {
      const res = await request(app).post("/transactions").send({
        toAccount: "ACC-A0001",
        amount: 10,
        currency: "ZZZ",
        type: "deposit",
      });
      expect(res.status).toBe(400);
      expect(res.body.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ field: "currency" }),
        ]),
      );
    });

    it("rejects transfer with same from/to account", async () => {
      const res = await request(app).post("/transactions").send({
        fromAccount: "ACC-A0001",
        toAccount: "ACC-A0001",
        amount: 10,
        currency: "USD",
        type: "transfer",
      });
      expect(res.status).toBe(400);
    });

    it("ignores client-supplied id and timestamp", async () => {
      const res = await request(app).post("/transactions").send({
        id: "client-set-id",
        timestamp: "1999-01-01T00:00:00Z",
        toAccount: "ACC-A0001",
        amount: 10,
        currency: "USD",
        type: "deposit",
      });
      expect(res.status).toBe(201);
      expect(res.body.id).not.toBe("client-set-id");
      expect(res.body.timestamp).not.toBe("1999-01-01T00:00:00Z");
    });
  });

  describe("GET /transactions", () => {
    const seed = async () => {
      await request(app).post("/transactions").send({
        toAccount: "ACC-A0001",
        amount: 100,
        currency: "USD",
        type: "deposit",
      });
      await request(app).post("/transactions").send({
        fromAccount: "ACC-A0001",
        toAccount: "ACC-B0002",
        amount: 30,
        currency: "USD",
        type: "transfer",
      });
      await request(app).post("/transactions").send({
        fromAccount: "ACC-B0002",
        amount: 5,
        currency: "USD",
        type: "withdrawal",
      });
    };

    it("lists all transactions", async () => {
      await seed();
      const res = await request(app).get("/transactions");
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(3);
    });

    it("filters by accountId", async () => {
      await seed();
      const res = await request(app).get("/transactions?accountId=ACC-A0001");
      expect(res.body).toHaveLength(2);
    });

    it("filters by type", async () => {
      await seed();
      const res = await request(app).get("/transactions?type=transfer");
      expect(res.body).toHaveLength(1);
    });

    it("combines filters", async () => {
      await seed();
      const res = await request(app).get(
        "/transactions?accountId=ACC-A0001&type=deposit",
      );
      expect(res.body).toHaveLength(1);
    });

    it("filters by date range (inclusive)", async () => {
      await seed();
      const today = new Date().toISOString().slice(0, 10);
      const res = await request(app).get(
        `/transactions?from=${today}&to=${today}`,
      );
      expect(res.body).toHaveLength(3);
    });
  });

  describe("GET /transactions/:id", () => {
    it("returns the transaction", async () => {
      const created = await request(app).post("/transactions").send({
        toAccount: "ACC-A0001",
        amount: 1,
        currency: "USD",
        type: "deposit",
      });
      const res = await request(app).get(`/transactions/${created.body.id}`);
      expect(res.status).toBe(200);
      expect(res.body.id).toBe(created.body.id);
    });

    it("returns 404 for unknown id", async () => {
      const res = await request(app).get("/transactions/does-not-exist");
      expect(res.status).toBe(404);
    });
  });

  describe("Unknown routes", () => {
    it("returns 404 with structured body for unknown path", async () => {
      const res = await request(app).get("/no-such-thing");
      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: "Not found" });
    });
  });

  describe("GET /accounts/:id/balance", () => {
    it("aggregates per currency for multi-currency account", async () => {
      await request(app).post("/transactions").send({
        toAccount: "ACC-A0001",
        amount: 100,
        currency: "USD",
        type: "deposit",
      });
      await request(app).post("/transactions").send({
        toAccount: "ACC-A0001",
        amount: 50,
        currency: "EUR",
        type: "deposit",
      });
      await request(app).post("/transactions").send({
        fromAccount: "ACC-A0001",
        amount: 20,
        currency: "EUR",
        type: "withdrawal",
      });

      const res = await request(app).get("/accounts/ACC-A0001/balance");
      expect(res.body.balance).toEqual({ USD: 100, EUR: 30 });
    });

    it("computes balance from transfers, deposits, withdrawals", async () => {
      await request(app).post("/transactions").send({
        toAccount: "ACC-A0001",
        amount: 1000,
        currency: "USD",
        type: "deposit",
      });
      await request(app).post("/transactions").send({
        fromAccount: "ACC-A0001",
        toAccount: "ACC-B0002",
        amount: 200,
        currency: "USD",
        type: "transfer",
      });
      await request(app).post("/transactions").send({
        fromAccount: "ACC-A0001",
        amount: 50,
        currency: "USD",
        type: "withdrawal",
      });

      const a = await request(app).get("/accounts/ACC-A0001/balance");
      expect(a.body.balance.USD).toBe(750);

      const b = await request(app).get("/accounts/ACC-B0002/balance");
      expect(b.body.balance.USD).toBe(200);
    });

    it("returns 400 for invalid account format", async () => {
      const res = await request(app).get("/accounts/BAD/balance");
      expect(res.status).toBe(400);
    });
  });

  describe("GET /accounts/:id/summary (Bonus A)", () => {
    it("returns deposits, withdrawals, count, most recent", async () => {
      await request(app).post("/transactions").send({
        toAccount: "ACC-A0001",
        amount: 100,
        currency: "USD",
        type: "deposit",
      });
      await request(app).post("/transactions").send({
        fromAccount: "ACC-A0001",
        amount: 30,
        currency: "USD",
        type: "withdrawal",
      });
      const res = await request(app).get("/accounts/ACC-A0001/summary");
      expect(res.status).toBe(200);
      expect(res.body.totalDeposits.USD).toBe(100);
      expect(res.body.totalWithdrawals.USD).toBe(30);
      expect(res.body.transactionCount).toBe(2);
      expect(res.body.mostRecentTransactionAt).toBeDefined();
    });
  });

  describe("GET /transactions/export (Bonus C)", () => {
    it("returns CSV", async () => {
      await request(app).post("/transactions").send({
        toAccount: "ACC-A0001",
        amount: 10,
        currency: "USD",
        type: "deposit",
      });
      const res = await request(app).get("/transactions/export?format=csv");
      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toMatch(/text\/csv/);
      expect(res.text.split("\n")[0]).toBe(
        "id,fromAccount,toAccount,amount,currency,type,timestamp,status",
      );
    });

    it("escapes commas, quotes, newlines, and CR in field values", async () => {
      const created = await request(app).post("/transactions").send({
        toAccount: "ACC-A0001",
        amount: 10,
        currency: "USD",
        type: "deposit",
      });
      // Inject tricky characters via storage to bypass schema validation
      const tricky = storage.findById(created.body.id);
      tricky.toAccount = 'ACC,",\n\rX';

      const res = await request(app).get("/transactions/export");
      const dataLine = res.text.split("\n").slice(1).join("\n");
      expect(dataLine).toContain('"ACC,"",\n\rX"');
    });
  });
});