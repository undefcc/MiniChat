# MiniChat - 视频对讲平台

基于 NestJS Monorepo 架构的微服务视频对讲平台，支持实时 WebRTC 通信、访客模式和用户认证，采用可扩展的服务设计。

## 🏗️ 架构

```
minichat/
├── apps/
│   ├── gateway/       # API 网关，提供 JWT 认证
│   ├── signaling/     # Socket.IO WebRTC 信令服务
│   └── web/          # Next.js 前端应用
├── libs/
│   └── common/       # 共享类型和工具库
├── docker-compose.yml
└── pnpm-workspace.yaml
```

## 🚀 功能特性

- **实时视频对讲**：WebRTC 点对点视频通信
- **访客模式**：无需注册即可快速接入
- **用户注册**：完整的账号系统和 JWT 认证
- **房间管理**：创建和加入视频对讲房间
- **微服务架构**：可扩展的服务设计
- **类型安全**：跨服务共享 TypeScript 类型定义

## 🛠️ 技术栈

### 后端
- **NestJS** - 渐进式 Node.js 框架
- **Socket.IO** - 实时双向通信
- **JWT** - 基于令牌的认证
- **MongoDB** - 主数据库
- **Redis** - 会话和房间状态管理

### 前端
- **Next.js 14** - React 框架，使用 App Router
- **TypeScript** - 类型安全开发
- **Socket.IO Client** - 实时连接

### 运维
- **Docker Compose** - 多容器编排
- **pnpm** - 快速、节省磁盘空间的包管理器

## 📦 快速开始

### 环境要求

- Node.js >= 18
- pnpm >= 8
- Docker & Docker Compose（用于数据库服务）

### 安装步骤

1. 克隆仓库：
```bash
git clone <repository-url>
cd minichat
```

2. 安装依赖：
```bash
pnpm install
```

3. 复制环境变量配置：
```bash
cp .env.example .env
```

4. 使用 Docker 启动数据库：
```bash
pnpm docker:up
```

5. 启动所有服务（开发模式）：
```bash
pnpm dev
```

服务访问地址：
- 前端：http://localhost:3100
- Gateway API：http://localhost:4000
- 信令服务：http://localhost:3101

### 本地 HTTPS 配置（用于局域网访问）

如需在局域网内通过 HTTPS 访问（如手机测试），需要配置本地 SSL 证书：

#### 1. 安装 mkcert（首次配置）

```bash
# macOS
brew install mkcert

# Windows（使用 winget）
winget install FiloSottile.mkcert

# 或手动从 https://github.com/FiloSottile/mkcert/releases 下载
```

#### 2. 生成包含局域网 IP 的证书

```bash
cd apps/web
mkcert -install                                    # 安装根 CA（自动生成 rootCA.pem）
mkcert localhost 127.0.0.1 192.168.0.101 ::1     # 生成证书（替换 IP）
```

这会在当前目录生成两个文件：
- `localhost+3.pem` - 证书
- `localhost+3-key.pem` - 私钥

> **注意**：`mkcert -install` 会自动在系统目录创建根 CA，包括 `rootCA.pem` 文件。

#### 2b. 复制根证书到项目（供移动设备下载）

```bash
# 查找系统中 rootCA.pem 的位置
mkcert -CAROOT

# 复制根证书到项目（macOS/Linux）
cp "$(mkcert -CAROOT)/rootCA.pem" public/rootCA.pem

# 复制根证书到项目（Windows PowerShell）
Copy-Item "$(mkcert -CAROOT)\rootCA.pem" public/rootCA.pem
```

这样移动设备可以通过页面直接下载 `public/rootCA.pem` 来安装证书。

#### 3. 在移动设备上安装根证书

**iOS/Safari：**
1. 下载根证书：`public/rootCA.pem`（访问页面时可直接下载）
2. 打开证书文件安装
3. **关键步骤**：设置 → 通用 → 关于本机 → 证书信任设置 → 启用 mkcert 完全信任
4. 重启浏览器/微信

**Android：**
1. 下载根证书：`public/rootCA.pem`
2. 设置 → 安全 → 加密与凭据 → 从存储设备安装
3. 为证书命名并确认安装

#### 4. 启动服务

```bash
cd apps/web
pnpm dev
```

然后在浏览器访问：`https://192.168.0.101:3100`（替换为你的局域网 IP）

#### 5. 诊断连接

如遇连接问题，访问诊断页面：`https://192.168.0.101:3100/check`

## 🔧 开发指南

### 项目结构

- **apps/gateway**：REST API 网关，处理认证和用户管理
- **apps/signaling**：WebSocket 服务，用于 WebRTC 信令
- **apps/web**：Next.js 前端应用
- **libs/common**：共享的 TypeScript 类型和工具

### 可用脚本

```bash
# 开发模式
pnpm dev              # 启动所有服务（监听模式）
pnpm dev --filter @minichat/gateway  # 启动指定服务

# 构建
pnpm build            # 构建所有服务

# 生产模式
pnpm start            # 启动所有服务（生产模式）

# 代码检查
pnpm lint             # 检查所有服务

# 测试
pnpm test             # 运行测试

# Docker
pnpm docker:up        # 启动 MongoDB 和 Redis
pnpm docker:down      # 停止所有容器
```

## 🔐 认证

### 访客模式
创建临时访客会话：
```bash
POST http://localhost:4000/auth/guest
Content-Type: application/json

{
  "nickname": "访客123"
}
```

### 用户注册
```bash
POST http://localhost:4000/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123",
  "nickname": "张三"
}
```

### 登录
```bash
POST http://localhost:4000/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123"
}
```

### 信令服务鉴权与诊断

信令服务的 Socket.IO 需要携带 JWT：
- 连接时通过 `auth.token` 传递，或使用 `Authorization: Bearer <token>`
- 事件默认需要鉴权（已启用 Guard）

本地可用环境变量覆盖（示例）：
```
JWT_ISSUER=http://localhost:9000
JWT_AUDIENCE=local.chat
JWT_SECRET=dev-secret
```

快速验证 token（signaling 端口 3101）：
```bash
GET http://localhost:3101/auth/diagnostics
Authorization: Bearer <token>
```

## 🎯 API 端点

### Gateway 服务（端口 4000）

- `GET /` - 健康检查
- `GET /health` - 服务健康状态
- `POST /auth/guest` - 创建访客会话
- `POST /auth/register` - 注册新用户
- `POST /auth/login` - 用户登录
- `GET /auth/profile` - 获取用户信息（需要认证）

### 信令服务（端口 3101）

Socket.IO 事件：
- `create-room` - 创建视频对讲房间
- `join-room` - 加入现有房间
- `offer` - 发送 WebRTC offer
- `answer` - 发送 WebRTC answer
- `ice-candidate` - 交换 ICE 候选
- `leave-room` - 离开当前房间

## 🐳 Docker 部署

使用 Docker Compose 构建和运行所有服务：

```bash
docker-compose up --build
```

所有服务将自动编排，包含健康检查和依赖管理。

## 📝 环境变量

查看 `.env.example` 了解所有可用配置选项。

关键变量：
- `JWT_SECRET` - JWT 令牌密钥
 - `MONGODB_URI` - MongoDB 连接字符串
- `REDIS_URL` - Redis 连接字符串
- `CORS_ORIGIN` - 允许的 CORS 来源
- `NEXT_PUBLIC_API_URL` - 前端使用的 Gateway API 地址
- `NEXT_PUBLIC_SIGNALING_URL` - 前端使用的信令服务地址

### HTTPS 开发环境配置

如配置了本地 HTTPS（见上文），需要更新环境变量：

```env
# 局域网 HTTPS 访问时的配置
CORS_ORIGIN=https://localhost:3100,https://192.168.0.101:3100
NEXT_PUBLIC_SIGNALING_URL=https://192.168.0.101:3101

# 注意：
# - 替换 192.168.0.101 为你的实际局域网 IP
# - 信令服务自动检测证书并启用 HTTPS（无需额外配置）
```

## 🤝 贡献

欢迎贡献代码！请随时提交 Pull Request。

## 📄 许可证

本项目采用 MIT 许可证。

## 🔗 相关文档

- [NestJS 文档](https://docs.nestjs.com)
- [Next.js 文档](https://nextjs.org/docs)
- [Socket.IO 文档](https://socket.io/docs)
- [WebRTC 文档](https://webrtc.org)
