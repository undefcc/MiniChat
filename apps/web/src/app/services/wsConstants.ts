export const WS_EVENTS = {
  CORE: {
    DISCONNECT: 'disconnect',
  },
  ROOM: {
    JOIN_ROOM: 'join-room',
    PEER_JOINED: 'peer-joined',
    OFFER: 'offer',
    ANSWER: 'answer',
    ICE_CANDIDATE: 'ice-candidate',
    PEER_DISCONNECTED: 'peer-disconnected',
  },
  STATION: {
    REGISTER: 'register-station',
    INVITE: 'invite-station',
    REQUEST_STATUS: 'request-station-status',
    CONNECTED: 'station-connected',
    DISCONNECTED: 'station-disconnected',
    CMD_REQUEST_STREAM: 'cmd-request-stream',
    STREAM_READY: 'stream-ready',
    INCOMING_CALL: 'incoming-call',
    STATUS_UPDATE: 'station-status-update',
    BATCH_STATUS_UPDATE: 'batch-station-status-update',
    CMD_JOIN_ROOM: 'cmd-station-join-room',
    CALL_CENTER: 'station-call-center',
  },
} as const
