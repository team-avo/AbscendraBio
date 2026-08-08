/* Create a ready-to-use Lineará TEST customer so an end-to-end order can be placed without fighting
 * the signup gates. The account is created already emailVerified + isApproved + active, tagged
 * brand:"lineara" (so its password-reset email is Lineará-branded), and linked User<->Customer with a
 * customerId (required by the ordering flow).
 *
 * PASSWORD: a random, unknowable value is set — this script never provisions a usable credential.
 * The tester sets their own password via "Forgot password" on lineara.co (which now sends a proper
 * Lineará-branded reset email). That doubles as a live test of the brand-aware reset path.
 *
 * Run:  TEST_CUSTOMER_EMAIL=peter+lineara@example.com node prisma/seed-test-customer.js
 *   or  node prisma/seed-test-customer.js peter+lineara@example.com
 * Optional: TEST_CUSTOMER_FIRST, TEST_CUSTOMER_LAST.
 */

const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const prisma = require("./client");

const EMAIL = (process.env.TEST_CUSTOMER_EMAIL || process.argv[2] || "").trim().toLowerCase();
const FIRST = process.env.TEST_CUSTOMER_FIRST || "Lineara";
const LAST = process.env.TEST_CUSTOMER_LAST || "Tester";

async function main() {
  if (!EMAIL || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(EMAIL)) {
    console.error("Provide a valid email: TEST_CUSTOMER_EMAIL=you@example.com node prisma/seed-test-customer.js");
    process.exitCode = 1;
    return;
  }

  const existing = await prisma.user.findUnique({ where: { email: EMAIL } });
  if (existing) {
    console.error(`A user already exists with ${EMAIL}. Pick a fresh email (one not already registered).`);
    process.exitCode = 1;
    return;
  }

  // Random, un-logged password — the tester resets it themselves via Forgot password.
  const hashed = await bcrypt.hash(crypto.randomBytes(24).toString("hex"), 12);

  const { customer, user } = await prisma.$transaction(async (tx) => {
    const customer = await tx.customer.create({
      data: {
        firstName: FIRST,
        lastName: LAST,
        email: EMAIL,
        companyName: "Lineara Test Lab",
        licenseNumber: "1234567890", // dummy 10-digit NPI/license so 503A-gated items are testable
        customerType: "B2C",
        isActive: true,
        isApproved: true,
        approvalStatus: "APPROVED",
        emailVerified: true,
      },
    });
    const user = await tx.user.create({
      data: {
        email: EMAIL,
        password: hashed,
        firstName: FIRST,
        lastName: LAST,
        role: "CUSTOMER",
        isActive: true,
        brand: "lineara",
        customerId: customer.id,
      },
    });
    return { customer, user };
  });

  console.log("\nLineará test customer created:");
  console.log("  email      :", user.email);
  console.log("  customerId :", customer.id);
  console.log("  status     : emailVerified + approved + active, brand=lineara");
  console.log("\nNext: on lineara.co use 'Forgot password' with this email to set a password, then sign in and place an order.");
}

main()
  .catch((e) => {
    console.error("Test customer seed failed:", e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
