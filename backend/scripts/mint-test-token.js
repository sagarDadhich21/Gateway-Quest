// Mints a short-lived GQ session JWT for manual API testing (curl/Postman), without
// needing real EQ/AQ login credentials. Signs with the real GQ_JWT_SECRET from .env,
// so the token is accepted by authenticate.ts exactly like a real login response.
//
// Run from gq/backend:
//   node scripts/mint-test-token.js <propertyId> [bqUserId]
//
// Example:
//   node scripts/mint-test-token.js 1
//   node scripts/mint-test-token.js 1 42

// quiet: true - dotenv v17 prints a promotional banner to stdout by default, which
// would otherwise pollute this script's one-line token output when captured via
// `TOKEN=$(node scripts/mint-test-token.js ...)`.
require("dotenv").config({ quiet: true });
const jwt = require("jsonwebtoken");

const propertyId = Number(process.argv[2]);
const bqUserId = Number(process.argv[3] ?? 1);

if (!Number.isInteger(propertyId) || propertyId <= 0) {
  console.error("Usage: node scripts/mint-test-token.js <propertyId> [bqUserId]");
  process.exit(1);
}

const token = jwt.sign(
  // "Super_Admin" matches BQ's real role name (bq/backend/.../contract.py:
  // `role_name == "Super_Admin"`) - roles here pass straight through unmodified from
  // BQ's own login response, so this must match what BQ actually issues.
  { sub: "00000000-0000-0000-0000-000000000001", bqUserId, propertyId, roles: ["Super_Admin"] },
  process.env.GQ_JWT_SECRET,
  { expiresIn: "60m" }
);

console.log(token);
