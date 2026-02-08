# Bugfix 日志

这里记录项目演进过程中遇到的真实线上问题与修复过程。

## 01. WebRTC Answer 设置失败: "Called in wrong state: stable" (2026-02-07)

### 案发现场
局域网环境下视频无法建立，浏览器报错：

```
InvalidStateError: Failed to execute 'setRemoteDescription' on 'RTCPeerConnection': Failed to set remote answer sdp: Called in wrong state: stable
```

现象表现为：
- 呼叫流程偶发中断
- 远端没有画面
- 控制台提示 setRemoteDescription 失败

### 侦探分析
这个错误意味着在一个处于 "stable" 状态的 RTCPeerConnection 上设置了 answer。正常流程应该是：

1. createOffer + setLocalDescription
2. 等待 answer
3. setRemoteDescription(answer)

但实际触发链路出现了错位，原因是信令事件被重复注册，导致同一个 answer 被多个 handler 处理，或是旧的 handler 在新的连接上执行。结果是 answer 到达时，当前 pc 已经不是 "have-local-offer" 状态。

### 修复方案
在前端信令层加入两层防护：

1. 进入 createRoom/joinRoom 前先清理旧的 WebSocket handlers，避免重复注册。
2. 在处理 answer 前校验 signalingState，只在 "have-local-offer" 时执行 setRemoteDescription。

核心改动位于：
- apps/web/src/app/hooks/useVideoChat.ts

### 验证要点
- 多次创建/加入房间不会重复触发 handler
- answer 只会在 have-local-offer 状态被应用
- 控制台不再出现 InvalidStateError

---
*待续：后续将记录关于 ICE 候选缓冲、断线重连与 NAT 环境下的稳定性问题。*

## 02. 未授权 Socket 连接未被拒绝，页面重复做鉴权 (2026-02-07)

### 案发现场
未登录或 token 失效时，Socket 仍然成功建立连接，但业务事件在每个页面里各自做鉴权判断，导致：

- 连接“看起来正常”，但所有操作都失败
- 鉴权逻辑散落在页面和 hook，维护成本高
- 重连时重复触发 UI 提示，体验不稳定

### 侦探分析
之前 WebSocket 只在业务事件层抛出 `UNAUTHORIZED`，没有在握手阶段拒绝连接。
结果是：无 token 也能连接，随后在每个 ack 回包里再判断权限。
这让鉴权处理分散在页面逻辑中，无法统一处理断开连接和登录流程。

### 修复方案
在信令服务端将鉴权前移到握手阶段，并在前端集中处理授权失败：

1. 服务端增加 Socket.IO 中间件，在连接阶段校验 token，无效直接拒绝。
2. 前端 wsBus 统一处理 ack 的 `UNAUTHORIZED`，自动触发登录并断开连接。
3. 页面只保留业务流程，不再写鉴权判断。

核心改动位于：
- apps/signaling/src/auth/ws-auth.middleware.ts
- apps/signaling/src/auth/ws-auth.utils.ts
- apps/signaling/src/**/**.gateway.ts
- apps/web/src/app/services/wsBus.ts

### 验证要点
- 无 token 连接会直接失败，前端收到 connect_error
- 业务页面不再出现重复的鉴权分支
- 授权失效时连接会被主动断开并弹出登录

## 03. 未注册/未清理 WS handlers 导致事件丢失或重复触发 (2026-02-07)

### 案发现场
信令连接后偶发收不到 `peer-joined/answer/ice-candidate`，或同一事件被触发多次，表现为：

- 连接成功但没有远端画面
- answer/ice 候选重复处理，状态异常
- 重连后事件监听失效

### 侦探分析
这里有两类不同的问题，不能混在一起：

1. **连接生命周期**：断线重连后，监听器需要重新挂载，否则事件会“从这一刻开始也收不到”。
2. **业务生命周期**：进入新的房间/新会话时，旧房间的 handler 仍然存在，如果不清理会继续响应新事件，造成重复处理或串房间。

因此“重连自动挂载”和“业务切换前清理”是两件事，缺一都会导致事件丢失或重复触发。

### 修复方案
前端维护 handler 注册表并在连接/重连时统一挂载，同时在业务切换前清理旧 handler：

1. wsBus 统一管理 on/off，连接时重挂载 handlers。
2. createRoom/joinRoom 前清理旧的 room handlers，避免旧会话逻辑继续响应。

核心改动位于：
- apps/web/src/app/services/wsBus.ts
- apps/web/src/app/hooks/useVideoChat.ts

### 验证要点
- 连接前注册的事件在建立连接后可以正常触发
- 重连后事件依旧可用且不会重复触发
- 多次进出房间不会出现 handler 累积

## 04. 挂断过程触发 ICE 重连与重复清理 (2026-02-08)

### 案发现场
用户点击挂断后，偶发出现：

- ICE 失败触发自动重连，通话被“拉回”
- `peer-disconnected` 与挂断清理重复执行，状态抖动

### 侦探分析
挂断是主动结束流程，但此时 ICE 事件可能仍在回调中：

1. `iceconnectionstatechange` 在挂断后仍可能进入 `failed`，默认逻辑会触发 `restartIce()`。
2. 断开事件与挂断清理同时发生，导致重复 close 和状态重置。

### 修复方案
在前端增加两类防护标记：

1. `isHangingUpRef`：挂断中禁止 ICE 重连。
2. `hasCleanedUpRef`：阻止重复清理与重复状态重置。

核心改动位于：
- apps/web/src/app/hooks/useVideoChat.ts

### 验证要点
- 挂断后不会触发 ICE 重连
- `peer-disconnected` 不会重复清理
- 通话状态稳定回到 idle

## 05. WebSocket ack 类型不一致导致构建失败 (2026-02-08)

### 案发现场
Docker 构建在 `pnpm build` 阶段失败，类型报错指向 `wsBus.ts`：

```
Type error: Argument of type 'Awaited<T>' is not assignable to parameter of type 'WsAckError | null | undefined'.
```

### 侦探分析
`emitWithAckChecked<T>` 允许业务传入任意 `T` 作为 ack 响应，但 `buildAckError`/`isAckUnauthorized`
只接受 `WsAckError | null | undefined`，导致泛型结果无法通过类型检查。

这是典型的“外部输入类型不可信”的场景：ACK 可能是成功数据或错误结构，
不应该在函数签名层面强行假设其形状。

### 修复方案
将 ACK 解析函数改为接收 `unknown`，在内部做类型守卫与收窄：

1. 增加 `toAckError` 作为 runtime 检查，将 `unknown` 安全转换为 `WsAckError`。
2. `buildAckError`/`isAckUnauthorized` 改为接收 `unknown`。

核心改动位于：
- apps/web/src/app/utils/wsAck.ts

### 验证要点
- `pnpm build` 不再因泛型 ACK 报错
- ACK 成功/失败路径行为一致
- 未改变业务层调用方式
