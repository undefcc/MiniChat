# MiniChat 系统架构文档 (v2.0)

## 1. 系统概览

MiniChat 是一个基于 **NestJS Monorepo** 微服务架构的实时视频平台。系统支持两种核心业务模式：
1.  **社交模式 (Social)**: 浏览器点对点 (P2P) 视频通话。
2.  **物联网模式 (IoT)**: 远程车场/站点监控与指令控制（云边协同架构）。

## 2. 技术栈

| 领域 | 技术选型 | 备注 |
| :--- | :--- | :--- |
| **前端** | Next.js 14, React, TypeScript | 使用 TailwindCSS, Shadcn/UI |
| **后端** | NestJS, Socket.IO | 微服务架构 |
| **数据库** | MongoDB, Redis | 用户数据存 MongoDB，信令状态存 Redis |
| **实时通信** | WebRTC, WebSocket (Socket.IO) | 信令与媒体分层 |
| **流媒体** | WebRTC (P2P), FFmpeg/MediaMTX (IoT) | 支持 VP8/H.264 协商 |
| **DevOps** | Docker, Docker Compose, pnpm | Monorepo 管理 |

---

## 3. 组件架构

系统分为三个物理层级：**云端 (Cloud)**、**边缘端 (Edge)**、**客户端 (Client)**。

### 3.1 云端服务 (Cloud Services)

部署在公网服务器，负责核心业务逻辑与信令路由。

*   **Gateway Service (`apps/gateway`)**
    *   **职责**: API 网关，统一入口。
    *   **功能**: JWT 身份认证、HTTP 请求转发、用户管理。
    
*   **Signaling Service (`apps/signaling`)**
    *   **职责**: 实时信令交换中心。
    *   **核心模块**:
        *   `RoomService`: 管理 P2P 房间状态，以及**边缘站点注册表 (Station Registry)**。
        *   `SignalingGateway`: Socket.IO 网关，处理 Offer/Answer 转发及控制指令路由。
        *   `StationService`: 站点注册与在线列表存储在 Redis（`stationId`/`socketId` 双向映射、元信息、在线集合）。
    *   **新特性**: 支持基于 `stationId` 的定向路由（Client -> Cloud -> Generic Edge Node）。

*   **Media Server (可选/第三方)**
    *   **职责**: 接收边缘推流，提供流媒体分发能力 (WHEP/RTMP)。
    *   **选型**: MediaMTX, SRS 或 go2rtc。

### 3.2 边缘端服务 (Edge / Total Control)

部署在车场/站点的本地服务器（总控）。

*   **Edge Agent (本地总控)**
    *   **职责**: 
        1.  保持与云端 `Signaling Service` 的 WebSocket 长连接。
        2.  执行云端指令（如 `cmd-request-stream`）。
        3.  管理本地硬件设备（IPC 相机、道闸）。
    *   **媒体能力**: 调用本地 FFmpeg 或启动 go2rtc，将 RTSP 流转换为 WebRTC/RTMP 推送给云端或客户端。

### 3.3 客户端 (Web Client)

*   **Web App (`apps/web`)**
    *   **P2P 模块**: `useVideoChat` + `useWebRTC`，支持画质动态调整。
    *   **IoT 模块**: 发送控制指令，播放来自边缘的流（支持 WHEP 或 H.264 Canvas 渲染）。

---

## 4. 核心工作流

### 4.1 社交 P2P 通话流程 (Browser-to-Browser)

1.  **加入**: User A 和 User B 连接 `Signaling Service` 加入同一 Room。
2.  **协商**: 交换 SDP (Offer/Answer) 和 ICE Candidate。
3.  **连接**: 浏览器建立 P2P 连接（尝试直连 -> 尝试 STUN -> 尝试 TURN 中继）。
4.  **通话**: 音视频流直接传输，不经过业务服务器。
    *   *功能支持*: 动态分辨率调整 (720p/480p/240p)。

### 4.2 IoT 远程监控流程 (Client-to-Edge)

此流程为 **“云端信令路由 + 边缘按需推流”** 模式。

1.  **注册 (Register)**: 
    *   车场总控启动，向云端发送 `register-station { stationId: 'bj_01' }`。
    *   `Signaling Service` 记录映射关系: `'bj_01' -> SocketID_X`。
2.  **请求 (Request)**:
    *   管理员在 Web 点击“查看北京车场相机”。
    *   Web 发送 `cmd-request-stream { stationId: 'bj_01', cameraId: 'cam_1' }`。
3.  **路由 (Route)**:
    *   云端查找 `'bj_01'` 对应的 `SocketID_X`。
    *   云端向总控发送 `station-cmd-start-stream`。
4.  **推流 (Stream)**:
    *   总控收到指令，启动 FFmpeg 拉取本地 RTSP 流。
    *   总控将流转码并推送到流媒体服务器（或建立 P2P WebRTC）。
5.  **播放 (Play)**:
    *   总控回复 `stream-ready { url: '...' }`。
    *   Web 收到 URL，开始播放视频。

---

## 5. 项目结构映射

```
/
├── apps/
│   ├── web/             # Next.js 前端 (管理台 + 视频通话)
│   ├── signaling/       # NestJS 信令服务 (含 Station 管理)
│   ├── gateway/         # NestJS API 网关 (Auth)
│   └── edge-mock/       # (计划中) 模拟边缘总控的脚本
├── libs/
│   └── common/          # 共享类型定义 (Socket事件类型等)
└── docker-compose.yml   # 编排文件
```
