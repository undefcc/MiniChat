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

# 复制 standalone 输出
COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/public ./apps/web/public

EXPOSE 3100

# standalone 会生成完整的服务器文件
CMD ["node", "apps/web/server.js"]
