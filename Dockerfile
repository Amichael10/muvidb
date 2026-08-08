# Production Node image for Fly.io / Railway / Docker hosts.
# Vercel continues to use api/ssr.ts; this is the scale exit ramp.
FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci

FROM deps AS build
WORKDIR /app
COPY . .
# Build needs env for Vite defines; pass at build time in CI as needed.
RUN npm run build

FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/build ./build
COPY --from=build /app/server ./server
EXPOSE 3000
CMD ["node", "server/node-server.mjs"]
