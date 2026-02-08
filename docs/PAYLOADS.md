# WS/HTTP 数据流总览

更新日期：2026-02-08

## 范围与约定

- 仅描述应用层 WS/HTTP 的 payload 与数据流，不覆盖 WebRTC 媒体流本身。
- WS ack（emitWithAck）直接返回 handler 的原始返回值，不做统一包装。
- HTTP Controller 返回什么就是什么，异常使用 Nest 默认格式。

## 系统数据流概览

### HTTP 侧

- 主要用于网关与管理类接口（鉴权、配置、普通 CRUD）。
- 响应格式：
	- 成功：Controller 原始返回值
	- 失败：{ statusCode, message, error }

### WS 侧

- 主要用于实时信令、站点状态、房间管理、监控广播等。
- 事件类型：
	- client -> server（ack）
	- server -> client（push）
- 典型参与方：
	- web 端页面与 hooks
	- signaling 服务的多个 gateway

## WS ack（emitWithAck 返回值）

### StationGateway

- station-register -> { stationId }
- get-online-stations -> { stations }
- station-invite -> undefined
- station-call-center -> undefined
- station-cmd-request-stream -> { status: "request-sent" }
- station-cmd-stream-response -> 无返回（仅转发）

### StatusGateway

- station-request-status -> { via: "mqtt" } | { via: "websocket" }

### RoomGateway

- create-room -> { roomId }
- check-room -> { exists }
- join-room -> { roomId, peers }
- leave-room -> undefined
- ping -> { pong: true, ts }

### SignalingGateway

- offer -> 无返回（仅转发）
- answer -> 无返回（仅转发）
- ice-candidate -> 无返回（仅转发）

### AdminGateway

- monitor-update 仅服务端推送（无 ack）

## WS 事件推送 payload

- station-connected -> { stationId }
- station-disconnected -> { stationId }
- station-incoming-call -> { stationId, timestamp }
- station-cmd-join-room -> { roomId, inviterId }
- station-cmd-start-stream -> { requesterId, cameraId, offer }
- station-stream-ready -> { stationId, requesterId, status, url?, answer?, error? }
- batch-station-status-update -> StationStatusPayload[]
- peer-joined -> { peerId }
- peer-disconnected -> { peerId }
- offer -> { from, offer }
- answer -> { from, answer }
- ice-candidate -> { from, candidate }
- monitor-update -> { timestamp, rooms, stats, onlineUsers, roomCount }

## WS 错误 / 异常

WS 错误为纯字符串，例如：

- "UNAUTHORIZED: Unauthorized"
- "ROOM_NOT_FOUND: Room not found"

来源：

- WsException（业务或鉴权）
- connect_error（握手失败）

客户端处理：

- wsBus 若 message 包含 unauthorized/jwt/401，则视为未授权

## 前端页面与事件对应

### Edge 页面

文件：apps/web/src/app/edge/page.tsx

- 发送（ack）
	- station-register
	- station-call-center
- 监听（push）
	- station-cmd-join-room
	- disconnect

### IoT 总控页面

文件：apps/web/src/app/iot/page.tsx

- 发送（ack）
	- station-invite
- 监听（push）
	- station-connected
	- station-disconnected
	- station-incoming-call
	- batch-station-status-update
	- station-status-update

### 站点监控 Hook

文件：apps/web/src/app/hooks/useStationMonitor.ts

- 发送（ack）
	- station-cmd-request-stream
	- station-request-status
- 监听（push）
	- station-connected
	- station-disconnected
	- station-stream-ready
	- station-incoming-call
	- batch-station-status-update
	- station-status-update

### 视频通话 Hook

文件：apps/web/src/app/hooks/useVideoChat.ts

- 发送（ack）
	- join-room
- 发送（push）
	- offer
	- ice-candidate
- 监听（push）
	- peer-joined
	- answer
	- ice-candidate
	- peer-disconnected

## 参考文件

- apps/signaling/src/station/station.gateway.ts
- apps/signaling/src/station/status.gateway.ts
- apps/signaling/src/room/room.gateway.ts
- apps/signaling/src/room/signaling.gateway.ts
- apps/signaling/src/admin/admin.gateway.ts
- apps/signaling/src/common/ws-errors.ts
- apps/signaling/src/auth/ws-jwt-auth.guard.ts
- apps/signaling/src/auth/ws-auth.middleware.ts
- apps/web/src/app/services/wsBus.ts
