import { Injectable } from '@nestjs/common';
import { RoomService } from '../room/room.service';
import * as os from 'os';
import * as si from 'systeminformation';

export interface RoomInfo {
  roomId: string;
  users: string[];
  createdAt: number;
  userCount: number;
}

export interface SystemStats {
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
  cpu: {
    usage: number;
    cores: number;
  };
  disk: {
    readPerSec: number;
    writePerSec: number;
    activePercent: number;
  };
  uptime: number;
}

@Injectable()
export class MonitorService {
  constructor(private readonly roomService: RoomService) {}

  /**
   * 获取所有房间信息
   */
  async getAllRooms(): Promise<RoomInfo[]> {
    const rooms = this.roomService.getAllRooms();
    return Object.entries(rooms).map(([roomId, users]) => ({
      roomId,
      users: users as string[],
      userCount: (users as string[]).length,
      createdAt: Date.now(), // 简化版：使用当前时间
    }));
  }

  /**
   * 获取系统统计信息
   */
  async getSystemStats(): Promise<SystemStats> {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;

    // 获取 CPU 使用率
    const cpuLoad = await si.currentLoad();
    
    // 获取磁盘 I/O 统计（可能在某些系统上不可用）
    let diskIO;
    try {
      diskIO = await si.disksIO();
    } catch (error) {
      console.warn('[Monitor] Failed to get disk I/O:', error.message);
      diskIO = null;
    }

    return {
      memory: {
        used: usedMem,
        total: totalMem,
        percentage: (usedMem / totalMem) * 100,
      },
      cpu: {
        usage: cpuLoad.currentLoad,
        cores: os.cpus().length,
      },
      disk: {
        readPerSec: diskIO?.rIO_sec || 0,
        writePerSec: diskIO?.wIO_sec || 0,
        activePercent: diskIO?.tIO_sec || 0,
      },
      uptime: process.uptime(),
    };
  }

  /**
   * 获取在线用户数
   */
  async getOnlineUserCount(): Promise<number> {
    const rooms = await this.getAllRooms();
    const uniqueUsers = new Set<string>();
    
    rooms.forEach(room => {
      room.users.forEach(user => uniqueUsers.add(user));
    });
    
    return uniqueUsers.size;
  }
}
