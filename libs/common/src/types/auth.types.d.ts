export declare enum UserType {
    GUEST = "guest",
    REGISTERED = "registered"
}
export interface User {
    id: string;
    type: UserType;
    nickname: string;
    email?: string;
}
export interface TokenPayload {
    userId: string;
    type: UserType;
    nickname: string;
}
export interface AuthResponse {
    accessToken: string;
    user: User;
}
