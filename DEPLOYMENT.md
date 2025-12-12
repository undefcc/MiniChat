# MiniChat 部署指南

## 部署架构

MiniChat 是一个 Monorepo 项目，包含 3 个服务：
- **Web 前端** (Next.js) - 端口 3100
- **Gateway 服务** (NestJS) - 端口 4000 (可选)
- **Signaling 服务** (NestJS) - 端口 3101

## 部署选项

### 方案一：Vercel 部署（推荐 - 最简单）

**适合场景**：快速上线，免费额度，自动 CI/CD

#### 1. 部署前端到 Vercel

```bash
# 安装 Vercel CLI
npm i -g vercel

# 在项目根目录
cd miniChat
vercel login
vercel
```

**配置 Vercel 项目设置：**
- Root Directory: `apps/web`
- Framework Preset: Next.js
- Build Command: `pnpm build`
- Output Directory: `.next`
- Install Command: `pnpm install`

**环境变量（在 Vercel Dashboard 设置）：**
```
NEXT_PUBLIC_SOCKET_URL=https://your-signaling-service.com
```

#### 2. 部署 Signaling 服务

**选项 A：使用 Railway**
```bash
# 在 apps/signaling 目录
cd apps/signaling

# 创建 Procfile
echo "web: node dist/main.js" > Procfile

# 推送到 Railway
railway login
railway init
railway up
```

**选项 B：使用 Render**
- 连接 GitHub 仓库
- Root Directory: `apps/signaling`
- Build Command: `pnpm install && pnpm build`
- Start Command: `node dist/main.js`
- 端口: 3101

---

### 方案二：Docker 部署（完整控制）

**适合场景**：自己的服务器，完整控制，生产环境

#### 1. 构建 Docker 镜像

在项目根目录创建 `Dockerfile.web`:

```dockerfile
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
COPY . .
WORKDIR /app/apps/web
RUN pnpm build

# 生产运行阶段
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/public ./apps/web/public

EXPOSE 3100
ENV PORT=3100

CMD ["node", "apps/web/server.js"]
```

创建 `Dockerfile.signaling`:

```dockerfile
FROM node:20-alpine AS base
RUN npm install -g pnpm

FROM base AS deps
WORKDIR /app
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY apps/signaling/package.json ./apps/signaling/
RUN pnpm install --frozen-lockfile

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/signaling/node_modules ./apps/signaling/node_modules
COPY . .
WORKDIR /app/apps/signaling
RUN pnpm build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/apps/signaling/dist ./dist
COPY --from=builder /app/apps/signaling/node_modules ./node_modules
COPY --from=builder /app/apps/signaling/package.json ./

EXPOSE 3101
ENV PORT=3101

CMD ["node", "dist/main.js"]
```

#### 2. 使用 docker-compose 编排

更新 `docker-compose.yml`:

```yaml
version: '3.8'

services:
  web:
    build:
      context: .
      dockerfile: Dockerfile.web
    ports:
      - "3100:3100"
    environment:
      - NEXT_PUBLIC_SOCKET_URL=http://signaling:3101
    depends_on:
      - signaling

  signaling:
    build:
      context: .
      dockerfile: Dockerfile.signaling
    ports:
      - "3101:3101"
    environment:
      - CORS_ORIGIN=http://localhost:3100

  # 可选：Gateway 服务
  # gateway:
  #   build:
  #     context: .
  #     dockerfile: Dockerfile.gateway
  #   ports:
  #     - "4000:4000"
```

#### 3. 部署到服务器

```bash
# 构建并启动
docker-compose up -d --build

# 查看日志
docker-compose logs -f

# 停止服务
docker-compose down
```

---

### 方案三：传统服务器部署

**适合场景**：已有 VPS/云服务器

#### 1. 服务器准备

```bash
# 安装 Node.js 20+
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# 安装 pnpm
npm install -g pnpm

# 安装 PM2
npm install -g pm2
```

#### 2. 部署代码

```bash
# 克隆代码
git clone https://github.com/your-username/miniChat.git
cd miniChat

# 安装依赖
pnpm install

# 构建所有服务
pnpm build
```

#### 3. 使用 PM2 运行

创建 `ecosystem.config.js`（已存在）并运行：

```bash
# 启动所有服务
pm2 start ecosystem.config.js

# 查看状态
pm2 status

# 查看日志
pm2 logs

# 保存配置（服务器重启后自动启动）
pm2 save
pm2 startup
```

#### 4. 配置 Nginx 反向代理

创建 `/etc/nginx/sites-available/minichat`:

```nginx
# Web 前端
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3100;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}

# Signaling 服务
server {
    listen 80;
    server_name signaling.your-domain.com;

    location / {
        proxy_pass http://localhost:3101;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        
        # WebSocket 支持
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

```bash
# 启用配置
sudo ln -s /etc/nginx/sites-available/minichat /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

#### 5. 配置 HTTPS（推荐）

```bash
# 安装 Certbot
sudo apt install certbot python3-certbot-nginx

# 申请证书
sudo certbot --nginx -d your-domain.com -d signaling.your-domain.com

# 自动续期
sudo certbot renew --dry-run
```

---

## 环境变量配置

### Web 前端 (.env.local)
```env
NEXT_PUBLIC_SOCKET_URL=https://signaling.your-domain.com
```

### Signaling 服务 (.env)
```env
PORT=3101
CORS_ORIGIN=https://your-domain.com
```

### Gateway 服务 (.env) - 可选
```env
PORT=4000
DATABASE_URL=postgresql://user:pass@localhost:5432/minichat
JWT_SECRET=your-secret-key
CORS_ORIGIN=https://your-domain.com
```

---

## 性能优化

### 1. Next.js 优化

在 `apps/web/next.config.js` 中启用：

```javascript
module.exports = {
  output: 'standalone',
  compress: true,
  poweredByHeader: false,
}
```

### 2. WebSocket 连接优化

确保 Signaling 服务配置：
- 启用 WebSocket sticky session（负载均衡时）
- 配置合理的 heartbeat 间隔
- 设置连接超时时间

### 3. CDN 加速

- 静态资源托管到 CDN（如 Cloudflare）
- 配置合适的缓存策略

---

## 监控和日志

### 使用 PM2 监控

```bash
# 实时监控
pm2 monit

# 查看详细信息
pm2 show web
pm2 show signaling

# 查看日志
pm2 logs web --lines 100
pm2 logs signaling --lines 100
```

### 错误追踪

推荐集成：
- Sentry (错误监控)
- LogRocket (用户行为)
- Google Analytics (访问统计)

---

## 常见问题

### 1. WebSocket 连接失败
- 检查防火墙是否开放 3101 端口
- 确认 Nginx 配置了正确的 WebSocket 代理头
- 验证 CORS_ORIGIN 配置正确

### 2. 视频无法连接
- 确认 STUN/TURN 服务器配置正确
- 检查浏览器权限（摄像头/麦克风）
- 测试网络连通性

### 3. 性能问题
- 使用 PM2 cluster 模式
- 配置负载均衡
- 优化数据库查询

---

## 推荐部署组合

**小型项目（免费）：**
- 前端: Vercel
- Signaling: Railway/Render
- 数据库: Supabase (可选)

**中型项目：**
- 所有服务: Docker + VPS
- 反向代理: Nginx
- 证书: Let's Encrypt

**大型项目：**
- 容器编排: Kubernetes
- 负载均衡: AWS ALB / Cloudflare
- 监控: Prometheus + Grafana

---

## 下一步

1. 选择适合的部署方案
2. 配置域名和 DNS
3. 设置环境变量
4. 部署并测试
5. 配置 HTTPS
6. 设置监控和备份

需要具体某个平台的详细部署步骤，请告诉我！
