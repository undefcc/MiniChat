FROM node:20-alpine

WORKDIR /app

# 安装 pnpm
RUN npm install -g pnpm

# 复制 workspace 配置
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY apps/signaling/package.json ./apps/signaling/

# 安装依赖
RUN pnpm install --frozen-lockfile

# 复制源代码
COPY apps/signaling ./apps/signaling

# 构建
WORKDIR /app/apps/signaling
RUN pnpm build

# 设置环境变量
ENV NODE_ENV=production
ENV PORT=3101

EXPOSE 3101

# 运行（使用 pnpm 确保所有依赖都能找到）
CMD ["node", "dist/main.js"]
