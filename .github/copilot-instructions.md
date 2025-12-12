# MiniChat Project - Video Chat Platform

## Project Overview
A microservices-based video chat platform built with NestJS monorepo architecture.

## Architecture
- **Monorepo Structure**: Using pnpm workspace
- **Services**:
  - Gateway: API gateway with authentication
  - User Service: User management with registered users and guest mode
  - Signaling Service: Socket.IO WebRTC signaling and room management
  - Web: Next.js frontend
- **Shared Libraries**: Common types, utilities, database models
- **Databases**: PostgreSQL (user data), Redis (sessions, room state)

## Tech Stack
- Backend: NestJS, TypeScript
- Frontend: Next.js 14, React, TypeScript
- Real-time: Socket.IO
- Databases: PostgreSQL, Redis
- DevOps: Docker, Docker Compose

## Development Guidelines
- Use TypeScript strict mode
- Follow NestJS best practices
- Implement proper error handling
- Use environment variables for configuration
- Write clean, maintainable code
