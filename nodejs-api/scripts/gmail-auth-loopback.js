#!/usr/bin/env node
// Loopback OAuth flow: spins up a tiny HTTP server on a free port,
// prints the auth URL to stdout, waits for Google's redirect with the code,
// exchanges it for a refresh token, prints the refresh token, exits.

require("dotenv").config();
const http = require("http");
const { google } = require("googleapis");

const SCOPES = ["https://www.googleapis.com/auth/gmail.modify"];

const clientId = process.env.GMAIL_CLIENT_ID;
const clientSecret = process.env.GMAIL_CLIENT_SECRET;

if (!clientId || !clientSecret) {
  console.error("ERROR: GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET must be in .env");
  process.exit(1);
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://localhost:${server.address().port}`);
    const code = url.searchParams.get("code");
    const error = url.searchParams.get("error");

    if (error) {
      res.writeHead(400, { "Content-Type": "text/plain" });
      res.end(`OAuth error: ${error}`);
      console.error(`AUTH_ERROR: ${error}`);
      server.close();
      process.exit(1);
    }

    if (!code) {
      res.writeHead(400, { "Content-Type": "text/plain" });
      res.end("Missing ?code");
      return;
    }

    const oauth2 = new google.auth.OAuth2(
      clientId,
      clientSecret,
      `http://localhost:${server.address().port}`,
    );
    const { tokens } = await oauth2.getToken(code);

    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(`<html><body style="font-family:sans-serif"><h2>Success</h2><p>You can close this tab and return to the terminal.</p></body></html>`);

    if (!tokens.refresh_token) {
      console.error("NO_REFRESH_TOKEN — Google didn't return a refresh token. Likely you've already authorized this client before. Revoke it at https://myaccount.google.com/permissions and rerun.");
      server.close();
      process.exit(1);
    }

    console.log(`REFRESH_TOKEN=${tokens.refresh_token}`);
    server.close();
    process.exit(0);
  } catch (err) {
    console.error(`EXCHANGE_FAILED: ${err.message}`);
    res.writeHead(500, { "Content-Type": "text/plain" });
    res.end(`Token exchange failed: ${err.message}`);
    server.close();
    process.exit(1);
  }
});

server.listen(0, () => {
  const port = server.address().port;
  const oauth2 = new google.auth.OAuth2(
    clientId,
    clientSecret,
    `http://localhost:${port}`,
  );
  const authUrl = oauth2.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: SCOPES,
  });
  console.log(`LISTENING_ON_PORT=${port}`);
  console.log(`AUTH_URL=${authUrl}`);
});

// Safety: give up after 5 minutes
setTimeout(() => {
  console.error("TIMEOUT — no callback received within 5 minutes");
  server.close();
  process.exit(2);
}, 300_000);
