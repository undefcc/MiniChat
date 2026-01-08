FROM node:20-alpine AS base
RUN npm install -g pnpm

# 依赖安装阶段
FROM base AS deps
WORKDIR /app
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY apps/web/package.json ./apps/web/
RUN pnpm install --frozen-lockfile

# 构建阶段
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/web/node_modules ./apps/web/node_modules
COPY pnpm-workspace.yaml package.json tsconfig.json ./
COPY apps/web ./apps/web

WORKDIR /app/apps/web
RUN pnpm build

# 运行阶段
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3100
ENV HOSTNAME="0.0.0.0"

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# 不使用 standalone，直接复制构建产物和依赖
COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/package.json ./package.json
COPY --from=builder --chown=nextjs:nodejs /app/apps/web ./apps/web

USER nextjs

WORKDIR /app/apps/web

EXPOSE 3100

# 使用 next start 而不是 standalone
CMD ["node_modules/.bin/next", "start", "-p", "3100"]
