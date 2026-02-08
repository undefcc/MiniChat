import { Injectable } from '@nestjs/common'
import { Server } from 'socket.io'

@Injectable()
export class SocketRegistryService {
  private readonly servers = new Set<Server>()

  register(server: Server) {
    this.servers.add(server)
  }

  getServers(): Server[] {
    return Array.from(this.servers)
  }
}
