#!/usr/bin/env node
/* eslint-disable no-console */
// One-off helper to mint a Gmail API refresh token for the supplier auto-import.
//
// Setup:
//   1. Google Cloud Console -> create project -> enable Gmail API
//   2. OAuth consent screen -> Internal (or External + add yourself as test user)
//   3. Credentials -> Create OAuth client ID -> "Desktop app"
//   4. Copy the client ID + secret into .env (GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET)
//   5. Run: node scripts/gmail-auth.js
//   6. Open the printed URL, sign in as the mailbox owner, grant the gmail.modify
//      scope, copy the resulting code back to this terminal.
//   7. Paste the printed refresh_token into .env as GMAIL_REFRESH_TOKEN.
//
// The refresh token is long-lived; you only need to run this once per mailbox.

require("dotenv").config();
const readline = require("readline");
const { google } = require("googleapis");

const SCOPES = ["https://www.googleapis.com/auth/gmail.modify"];

async function main() {
  const clientId = process.env.GMAIL_CLIENT_ID;
  const clientSecret = process.env.GMAIL_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.error(
      "ERROR: GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET must be set in .env",
    );
    process.exit(1);
  }

  const oauth2 = new google.auth.OAuth2(
    clientId,
    clientSecret,
    "urn:ietf:wg:oauth:2.0:oob",
  );

  const authUrl = oauth2.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: SCOPES,
  });

  console.log("\nOpen this URL in your browser and sign in as the mailbox owner:\n");
  console.log(authUrl);
  console.log("\nAfter approving, Google will display a code. Paste it below.\n");

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  const code = await new Promise((resolve) =>
    rl.question("Code: ", (answer) => {
      rl.close();
      resolve(answer.trim());
    }),
  );

  const { tokens } = await oauth2.getToken(code);

  if (!tokens.refresh_token) {
    console.error(
      "\nNo refresh_token returned. This usually means you've already authorized this client before.",
    );
    console.error(
      "Either revoke the previous grant at https://myaccount.google.com/permissions and rerun,",
    );
    console.error("or rerun with a different OAuth client.");
    process.exit(1);
  }

  console.log("\n✅ Success. Add the following to your .env:\n");
  console.log(`GMAIL_REFRESH_TOKEN=${tokens.refresh_token}`);
  console.log(`# (access token also returned, but it expires; only the refresh token matters)`);
}

main().catch((err) => {
  console.error("Failed:", err.message);
  process.exit(1);
});
