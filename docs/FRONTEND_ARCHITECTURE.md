# MiniChat 前端架构文档

## 1. 总体架构概览

前端应用基于 Next.js 14 构建，采用 React Hooks 模式将业务逻辑与 UI 分离。核心通信层由 WebSocket 信令服务和 WebRTC 媒体传输层组成。

应用主要分为两大核心业务板块：
*   **IoT 对讲 (IoT Intercom)**：位于 `/iot`，侧重于设备管理、单向监控流（上呼）和邀请设备入会（下呼）。
*   **用户 P2P 对讲 (User P2P)**：位于 `/room/[id]`，侧重于用户间的双向视频通话，基于房间模型。

---

## 2. 核心板块详解

### 2.1 IoT 对讲上呼下呼 (IoT Intercom)

此模块用于监控中心与边缘设备（如可视门铃、监控摄像头）的交互。分为"查看监控（上呼）"和"发起通话（下呼）"。

**核心设计思想**：
*   **上呼 (Request Stream)**：由浏览器发起单向 `recvonly` 的 WebRTC 请求，只拉流不推流。此模式下，浏览器作为 Offer 端的 Viewer。
*   **下呼 (Invite Call)**：创建一个标准通话房间，并通过信令邀请设备加入该房间，升级为双向通话。

**关键流程步骤：**

#### A. 查看监控 (Monitor / Request Stream)
1.  **发现设备**：通过 Socket 监听设备上线/下线事件。
    *   `useStationMonitor` 初始化时调用 `signaling.getOnlineStations()`。
    *   监听 `station-connected` / `station-disconnected` 事件更新列表。
2.  **建立连接**：用户点击播放，浏览器创建 PeerConnection。
    *   **关键方法**: `requestStream` (useStationMonitor.ts)
    *   创建 `recvonly` 的 PC：`pc.addTransceiver('video', { direction: 'recvonly' })`。
    *   生成 Offer 并等待 ICE 收集完成 (Vanilla ICE)，以简化信令交互次数。
3.  **信令交换**：设备收到 Offer 后回复 Answer。
    *   `socket.emit('iot-offer')`: 发送携带 `stationId` 和 `cameraId` 的请求。
    *   `socket.on('iot-answer')`: 接收设备回复的 SDP，调用 `pc.setRemoteDescription`。
4.  **画面渲染**：收到远端流后绑定到 Video 标签。
    *   **组件**: `MonitorPlayer` (iot/page.tsx) - 负责处理流的自动播放状态与错误展示。

#### B. 发起呼叫 (Call Station)
1.  **创建房间**：将当前的监控会话升级为房间通话。
    *   **关键方法**: `createRoom` (useStationMonitor.ts) - 调用信令服务创建一个新的房间 ID。
2.  **发出邀请**：告诉设备"请断开当前监控，加入这个房间ID"。
    *   **关键方法**: `inviteStation` (useStationMonitor.ts) - 发送 `iot-invite` 信令，携带 `roomId`。
3.  **进入通话**：前端跳转至 P2P 通话页面，等待设备加入。
    *   **逻辑**: `handleCall` (iot/page.tsx) 编排创建房间和邀请的流程，然后路由跳转。

---

### 2.2 用户 P2P 对讲 (User P2P Video Chat)

此模块用于普通用户之间或用户与设备在房间内的双向视频通话。

**核心设计思想**：
*   **房间模型**：所有参与者基于 `roomId` 聚合。
*   **自动协商**：新成员加入时，触发 Offer/Answer 流程。
*   **Mesh 架构**：多人通话时，每两个用户之间建立独立的 P2P 连接（仅适用于小规模通话）。

**关键流程步骤：**

1.  **加入/创建房间**：
    *   **入口**: `RoomContent` (room/[id]/page.tsx) 负责校验房间有效性。
    *   **动作**: `joinRoom` (VideoChatContext.tsx) 初始化上下文状态，连接 Socket。
2.  **本地媒体获取**：
    *   **关键方法**: `startLocalStream` (useWebRTC.ts)
    *   调用 `navigator.mediaDevices.getUserMedia`。
    *   **降级策略**: 优先尝试 音频+视频，失败则尝试 仅音频，再次失败则使用 空流（仅接收模式）。
3.  **发现对端 (Peer Discovery)**：
    *   `signaling.onPeerJoined`: 监听到有人加入房间，触发由本端发起连接流程。
4.  **WebRTC 握手 (Handshake)**：
    *   **工厂方法**: `createPeerConnection` (useWebRTC.ts) 创建标准 PC，注入 STUN/TURN 配置。
    *   **协商流程** (`useVideoChat`):
        *   **Offer 端**: `pc.createOffer()` -> `setLocalDescription` -> `signaling.sendOffer`。
        *   **Answer 端**: 收到 Offer -> `setRemoteDescription` -> `pc.createAnswer()` -> `signaling.sendAnswer`。
5.  **ICE 穿透**：
    *   `pc.onicecandidate`: 收集本地网络候选路径 (Host/Srflx/Relay)。
    *   `signaling.sendIce`: 通过信令服务器交换候选路径，打通 P2P 通道。

---

## 3. 关键方法与类概览

### 3.1 核心 Hooks (`apps/web/src/app/hooks/`)

| 方法/Hook | 一句话概括 |
| :--- | :--- |
| **`useStationMonitor`** | **IoT 总指挥**：管理监控墙业务，维护在线设备列表 (`onlineStations`)，管理多路监控流 (`streams`) 的生命周期。 |
| **`useVideoChat`** | **通话导演**：P2P 通话的主控 Hook，协调 `useWebRTC` (媒体) 和 `useSocketSignaling` (信令) 进行连接建立。 |
| **`useWebRTC`** | **底层工兵**：封装原生 WebRTC API，负责 `RTCPeerConnection` 的创建、ICE 服务器配置、媒体流获取与轨道绑定。 |
| **`useSocketSignaling`** | **信令传声筒**：Socket.IO 的强类型封装，定义了所有信令事件（如 `offer`, `answer`, `ice-candidate`, `iot-invite`）。 |
| **`useDataChannel`** | **数据通道管理**：管理 WebRTC DataChannel，用于在视频流之外传输控制指令（如分辨率切换）或文本消息。 |

### 3.2 关键数据结构与组件

| 名称 | 类型 | 一句话概括 |
| :--- | :--- | :--- |
| **`VideoChatContext`** | Context | **全局状态容器**：存储当前通话状态 (`idle`/`calling`/`connected`)，供 UI 组件消费。 |
| **`MonitorStream`** | Interface | **监控流模型**：定义单个监控窗口的状态，包含 `stationId`、当前状态 (`playing`/`loading`) 和 `MediaStream` 对象。 |
| **`ControlPanel`** | Component | **控制栏组件**：通话界面底部的操作栏，通过 Context 控制麦克风、摄像头开关及挂断操作。 |
| **`HUDVideoModal`** | Component | **悬浮窗组件**：用于 IoT 页面中显示大图监控或临时的视频交互窗口。 |
