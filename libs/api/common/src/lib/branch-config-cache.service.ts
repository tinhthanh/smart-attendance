import { Inject, Injectable, Logger } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { PrismaService } from './prisma.service';

export interface CachedGeofence {
  centerLat: number;
  centerLng: number;
  radiusMeters: number;
  isActive: boolean;
}

export interface CachedWifi {
  ssid: string;
  bssid: string | null;
  isActive: boolean;
}

export interface CachedBranchConfig {
  branchStatus: 'active' | 'inactive';
  timezone: string;
  geofences: CachedGeofence[];
  wifiConfigs: CachedWifi[];
}

const TTL_MS = 300_000;

@Injectable()
export class BranchConfigCacheService {
  private readonly logger = new Logger(BranchConfigCacheService.name);

  constructor(
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
    private readonly prisma: PrismaService
  ) {}

  private key(branchId: string): string {
    return `branch:${branchId}:config`;
  }

  async get(branchId: string): Promise<CachedBranchConfig> {
    const k = this.key(branchId);
    const hit = await this.cache.get<CachedBranchConfig>(k);
    if (hit) {
      this.logger.debug(`Cache HIT ${k}`);
      return hit;
    }
    this.logger.debug(`Cache MISS ${k}`);
    const branch = await this.prisma.branch.findUniqueOrThrow({
      where: { id: branchId },
      select: { status: true, timezone: true },
    });
    const [geofences, wifiConfigs] = await Promise.all([
      this.prisma.branchGeofence.findMany({
        where: { branchId, isActive: true },
      }),
      this.prisma.branchWifiConfig.findMany({
        where: { branchId, isActive: true },
      }),
    ]);
    const value: CachedBranchConfig = {
      branchStatus: branch.status,
      timezone: branch.timezone,
      geofences: geofences.map((g) => ({
        centerLat: g.centerLat.toNumber(),
        centerLng: g.centerLng.toNumber(),
        radiusMeters: g.radiusMeters,
        isActive: g.isActive,
      })),
      wifiConfigs: wifiConfigs.map((w) => ({
        ssid: w.ssid,
        bssid: w.bssid,
        isActive: w.isActive,
      })),
    };
    await this.cache.set(k, value, TTL_MS);
    return value;
  }

  async invalidate(branchId: string): Promise<void> {
    await this.cache.del(this.key(branchId));
    this.logger.debug(`Cache INVALIDATE ${this.key(branchId)}`);
  }
}
