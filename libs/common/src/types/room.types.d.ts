export interface Room {
    id: string;
    creatorId: string;
    peers: string[];
    createdAt: Date;
}
export interface SignalingMessage {
    type: 'offer' | 'answer' | 'ice-candidate';
    from: string;
    to: string;
    payload: any;
}
export interface JoinRoomResponse {
    roomId: string;
    peers: string[];
}
