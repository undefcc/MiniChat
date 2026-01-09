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

# .env.production 由 GitHub Actions 生成，包含所有 NEXT_PUBLIC_* 变量
# Next.js 构建时会自动读取并内联到代码中
RUN pnpm build

# 运行阶段（环境变量已内联到构建产物）
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3100 \
    HOSTNAME="0.0.0.0"

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# 不使用 standalone，直接复制构建产物和依赖
COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/package.json ./package.json
COPY --from=builder --chown=nextjs:nodejs /app/apps/web ./apps/web

# 复制启动脚本
COPY --chown=nextjs:nodejs apps/web/docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh

USER nextjs

WORKDIR /app/apps/web

EXPOSE 3100

# 使用启动脚本
ENTRYPOINT ["/app/docker-entrypoint.sh"]
