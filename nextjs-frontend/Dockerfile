# Ascendra frontend (Next.js 15, standalone output for a lean runtime image).
FROM node:22-slim AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci || npm install

COPY . .

# The public API base is baked at build time (used by the browser).
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV BUILD_STANDALONE=true
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# --- runtime image ---
FROM node:22-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

EXPOSE 3000
ENV PORT=3000
CMD ["node", "server.js"]
