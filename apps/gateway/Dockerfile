FROM node:20-alpine AS base
RUN npm install -g pnpm

# 依赖安装阶段
FROM base AS deps
WORKDIR /app
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY apps/gateway/package.json ./apps/gateway/
COPY libs/common/package.json ./libs/common/
RUN pnpm install --frozen-lockfile

# 构建阶段
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/gateway/node_modules ./apps/gateway/node_modules
COPY --from=deps /app/libs/common ./libs/common
COPY . .
WORKDIR /app/apps/gateway
RUN pnpm build

# 生产运行阶段
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/apps/gateway/dist ./dist
COPY --from=builder /app/apps/gateway/node_modules ./node_modules
COPY --from=builder /app/apps/gateway/package.json ./

EXPOSE 4000
ENV PORT=4000

CMD ["node", "dist/main.js"]
