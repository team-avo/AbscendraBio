# Ascendra — Offshore VPS deployment & migration

Self-hosted stack for the OrangeWebsite (Iceland) VPS. One `docker compose` brings up
the whole app: **Postgres + Redis + MinIO (storage) + backend + frontend + Nginx**.
No US services; everything runs on the one box.

```
deploy/
  docker-compose.yml     # the whole stack
  .env.example           # config template (copy to .env, fill in)
  nginx/default.conf      # reverse proxy: /api -> backend, /media -> MinIO, / -> frontend
nodejs-api/Dockerfile     # backend image (migrate deploy -> node server.js)
nextjs-frontend/Dockerfile# frontend image (Next.js standalone)
```

## What needs Peter (blocked until then)
1. VPS must be **provisioned/active** (payment cleared) — server IP + root login.
2. DNS cutover at Squarespace is the final flip (brief, coordinated).

## What we can do without Peter (done / doable now)
- Build + test the whole stack locally (`deploy/`).
- Back up the current production database from Railway.
- Prepare all config + this runbook.

---

## A. Back up the production database (needs your Railway login)
```bash
railway login                         # opens browser, your action
cd nodejs-api && railway link         # pick the Ascendra project + Postgres service
railway variables | grep DATABASE_URL # confirm the prod DB URL
# dump (custom format, restorable):
railway run 'pg_dump "$DATABASE_URL" -Fc -f /tmp/ascendra.dump' && \
  railway run 'cat /tmp/ascendra.dump' > deploy/backups/ascendra_prod.dump
```
Keep `deploy/backups/` out of git (already in .gitignore).

## B. Test the stack locally
```bash
cd deploy
cp .env.example .env      # (a local .env with test values already exists)
docker compose up -d --build
# frontend: http://localhost:8080   |   MinIO console: http://localhost:9001
docker compose logs -f backend
docker compose down       # (add -v to wipe volumes)
```

## C. Provision the Iceland VPS (once active)
```bash
ssh root@SERVER_IP
apt update && apt -y upgrade
# firewall
ufw allow OpenSSH && ufw allow 80 && ufw allow 443 && ufw --force enable
# fail2ban + docker
apt -y install fail2ban
curl -fsSL https://get.docker.com | sh
# SSH keys only (after adding your key): disable root password login in /etc/ssh/sshd_config
```

## D. Deploy the app on the VPS
```bash
git clone <deploy-repo> /opt/ascendra && cd /opt/ascendra/deploy
cp .env.example .env      # fill: PUBLIC_URL=https://www.ascendrabio.com, strong DB/MinIO
                          # passwords, JWT_SECRET, and all keys from Railway. RUN_SEED=false
docker compose up -d --build
# restore the production database into the in-stack Postgres:
docker compose cp backups/ascendra_prod.dump postgres:/tmp/ascendra.dump
docker compose exec postgres pg_restore -U ascendra -d peptides_db --clean --if-exists /tmp/ascendra.dump
# re-upload existing product images into MinIO (mc), then verify
```

## E. SSL + DNS cutover (coordinated with you)
```bash
# add certbot to nginx (or run certbot standalone) for www.ascendrabio.com + ascendrabio.com
```
Then at **Squarespace DNS**: point `@` and `www` A records to the VPS IP.
Propagation ~ minutes to an hour. Verify HTTPS + the site, then it's live.

## F. After go-live
- Point the frontend image host allowlist (`next.config.js`) at the domain/MinIO for `next/image`.
- BTCPay Server for crypto payments (separate, ~3–4 days).
- Confirm the OrangeWebsite Backup Service is running; add a nightly `pg_dump` cron as a second layer.

## Notes
- `RUN_SEED=true` only for a fresh empty DB. When restoring the prod dump, keep it `false`.
- Memory on 6 GB: Postgres `shared_buffers` tuned modestly, Redis `maxmemory` capped, Next.js
  in production mode. Watch `docker stats` after go-live.
