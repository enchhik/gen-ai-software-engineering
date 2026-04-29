const { z } = require("zod");
const { isValidCurrency } = require("./iso4217");

const ACCOUNT_REGEX = /^ACC-[A-Za-z0-9]{5}$/;
const AMOUNT_REGEX = /^\d+(\.\d{1,2})?$/;

const accountId = z
  .string({ required_error: "Account is required" })
  .regex(ACCOUNT_REGEX, "Account must match format ACC-XXXXX (5 alphanumeric)");

const amount = z
  .union([z.number(), z.string()])
  .transform((val) => (typeof val === "number" ? val : Number(val)))
  .refine((val) => Number.isFinite(val) && val > 0, {
    message: "Amount must be a positive number",
  })
  .refine(
    (val) => {
      const str = String(val);
      return AMOUNT_REGEX.test(str);
    },
    { message: "Amount must have at most 2 decimal places" },
  );

const currency = z
  .string({ required_error: "Currency is required" })
  .refine(isValidCurrency, { message: "Invalid ISO 4217 currency code" });

const type = z.enum(["deposit", "withdrawal", "transfer"], {
  errorMap: () => ({
    message: "Type must be one of: deposit, withdrawal, transfer",
  }),
});

const createTransactionSchema = z
  .object({
    fromAccount: accountId.optional(),
    toAccount: accountId.optional(),
    amount,
    currency,
    type,
  })
  .superRefine((data, ctx) => {
    if (data.type === "deposit" && !data.toAccount) {
      ctx.addIssue({
        path: ["toAccount"],
        code: z.ZodIssueCode.custom,
        message: "toAccount is required for deposit",
      });
    }
    if (data.type === "withdrawal" && !data.fromAccount) {
      ctx.addIssue({
        path: ["fromAccount"],
        code: z.ZodIssueCode.custom,
        message: "fromAccount is required for withdrawal",
      });
    }
    if (data.type === "transfer") {
      if (!data.fromAccount) {
        ctx.addIssue({
          path: ["fromAccount"],
          code: z.ZodIssueCode.custom,
          message: "fromAccount is required for transfer",
        });
      }
      if (!data.toAccount) {
        ctx.addIssue({
          path: ["toAccount"],
          code: z.ZodIssueCode.custom,
          message: "toAccount is required for transfer",
        });
      }
      if (data.fromAccount && data.toAccount && data.fromAccount === data.toAccount) {
        ctx.addIssue({
          path: ["toAccount"],
          code: z.ZodIssueCode.custom,
          message: "fromAccount and toAccount must differ for transfer",
        });
      }
    }
  });

const formatZodErrors = (zodError) =>
  zodError.errors.map((e) => ({
    field: e.path.join(".") || "(root)",
    message: e.message,
  }));

module.exports = {
  ACCOUNT_REGEX,
  AMOUNT_REGEX,
  createTransactionSchema,
  formatZodErrors,
};