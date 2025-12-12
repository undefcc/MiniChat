# Quick Start Guide

## Development Setup

1. **Install dependencies**:
```bash
pnpm install
```

2. **Start databases** (PostgreSQL & Redis):
```bash
pnpm docker:up
```

3. **Copy environment variables**:
```bash
cp .env.example .env
```

4. **Start all services**:
```bash
pnpm dev
```

Services will run on:
- Frontend (web): http://localhost:3100
- Gateway API: http://localhost:4000
- Signaling Service: http://localhost:3101

## Project Structure

```
minichat/
├── apps/
│   ├── gateway/       # Authentication & API Gateway (Port 4000)
│   │   └── src/
│   │       ├── auth/  # JWT auth, guest & registered users
│   │       └── main.ts
│   ├── signaling/     # WebRTC signaling via Socket.IO (Port 3101)
│   │   └── src/
│   │       ├── signaling.gateway.ts
│   │       └── room.service.ts
│   └── web/          # Next.js frontend (Port 3000)
│       └── src/app/
│           ├── page.tsx      # Home
│           └── room/page.tsx # Video chat room
└── libs/
    └── common/       # Shared TypeScript types
        └── src/types/
```

## Next Steps

✅ All services are ready to run
✅ Docker Compose configured for databases
✅ Authentication with guest mode implemented
✅ WebRTC signaling service ready

### To start developing:

1. Run `pnpm dev` to start all services
2. Open http://localhost:3100 in your browser
3. Click "Start Video Chat" to test the video room

### Features implemented:

- ✅ Guest mode authentication (no registration required)
- ✅ User registration and login
- ✅ Room creation and joining
- ✅ WebRTC signaling infrastructure
- ✅ Microservices architecture

### What you can add next:

- [ ] Complete WebRTC implementation in frontend
- [ ] Add PostgreSQL integration for user persistence
- [ ] Add Redis for room state management
- [ ] Implement video/audio controls
- [ ] Add chat functionality
- [ ] Deploy to production
