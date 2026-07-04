# Ascendra backend (Express + Prisma). Runs migrations then starts the API.
FROM node:22-slim

WORKDIR /app

# openssl + ca-certificates are needed by Prisma at runtime
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# Install all deps (Prisma CLI is needed at runtime for migrate deploy)
COPY package*.json ./
RUN npm ci || npm install

# Generate the Prisma client
COPY prisma ./prisma
RUN npx prisma generate

# App source
COPY . .

ENV NODE_ENV=production
EXPOSE 5001

COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh
ENTRYPOINT ["/docker-entrypoint.sh"]
