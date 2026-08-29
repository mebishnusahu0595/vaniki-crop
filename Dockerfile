FROM node:20-alpine AS builder

WORKDIR /app

RUN npm install -g pnpm@9.15.4

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY . .

RUN pnpm install --no-frozen-lockfile
RUN pnpm build

FROM node:20-alpine AS runner

WORKDIR /app

RUN npm install -g pnpm@9.15.4

COPY --from=builder /app/package.json /app/pnpm-lock.yaml /app/pnpm-workspace.yaml ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/apps ./apps

EXPOSE 5000

ENV NODE_ENV=production
ENV PORT=5000

CMD ["node", "packages/api/dist/server.js"]
