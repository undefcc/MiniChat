import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { createRemoteJWKSet, importSPKI, jwtVerify, KeyLike } from 'jose'

@Injectable()
export class JwtVerifierService {
  private readonly issuer?: string
  private readonly audience?: string | string[]
  private readonly clockTolerance: number
  private readonly algorithms: string[]
  private readonly jwks?: ReturnType<typeof createRemoteJWKSet>
  private readonly publicKey?: string
  private readonly sharedSecret?: Uint8Array
  private readonly keyAlgorithm: string
  private keyPromise: Promise<KeyLike> | null = null

  constructor(private readonly config: ConfigService) {
    this.issuer = this.normalize(config.get<string>('JWT_ISSUER'))
    this.audience = this.parseAudience(config.get<string>('JWT_AUDIENCE'))
    this.clockTolerance = this.parseNumber(config.get<string>('JWT_CLOCK_SKEW'), 30)
    const sharedSecretValue = this.normalize(
      config.get<string>('JWT_SHARED_SECRET') || config.get<string>('JWT_SECRET'),
    )
    this.sharedSecret = sharedSecretValue ? new TextEncoder().encode(sharedSecretValue) : undefined
    this.algorithms = this.parseAlgorithms(config.get<string>('JWT_ALGORITHMS'), this.sharedSecret)
    this.publicKey = this.normalize(config.get<string>('JWT_PUBLIC_KEY'))
    this.keyAlgorithm = this.normalize(config.get<string>('JWT_KEY_ALG')) || 'RS256'

    const jwksUrl = this.normalize(config.get<string>('JWT_JWKS_URL'))
    if (jwksUrl) {
      this.jwks = createRemoteJWKSet(new URL(jwksUrl))
    }
  }

  async verifyToken(token: string) {
    const keyOrJwks = await this.getKey()
    
    // If it's a JWKS set, pass it as a getKey function
    if (typeof keyOrJwks === 'function') {
      const { payload } = await jwtVerify(token, keyOrJwks, {
        issuer: this.issuer,
        audience: this.audience,
        clockTolerance: this.clockTolerance,
        algorithms: this.algorithms,
      })
      return payload
    }

    // Otherwise, pass it as a key
    const { payload } = await jwtVerify(token, keyOrJwks, {
      issuer: this.issuer,
      audience: this.audience,
      clockTolerance: this.clockTolerance,
      algorithms: this.algorithms,
    })

    return payload
  }

  private async getKey(): Promise<KeyLike | ReturnType<typeof createRemoteJWKSet> | Uint8Array> {
    if (this.jwks) {
      return this.jwks
    }

    if (this.publicKey) {
      if (!this.keyPromise) {
        this.keyPromise = importSPKI(this.publicKey, this.keyAlgorithm)
      }
      return this.keyPromise
    }

    if (this.sharedSecret) {
      return this.sharedSecret
    }

    throw new Error('JWT verification key is not configured')
  }

  private parseAlgorithms(value: string | undefined, sharedSecret?: Uint8Array): string[] {
    if (!value) {
      return sharedSecret ? ['HS256'] : ['RS256', 'ES256']
    }

    const parsed = value
      .split(',')
      .map(item => item.trim())
      .filter(Boolean)

    return parsed.length ? parsed : sharedSecret ? ['HS256'] : ['RS256', 'ES256']
  }

  private parseAudience(value: string | undefined): string | string[] | undefined {
    const normalized = this.normalize(value)
    if (!normalized) {
      return undefined
    }

    if (normalized.startsWith('[')) {
      try {
        const parsed = JSON.parse(normalized)
        if (Array.isArray(parsed)) {
          const items = parsed.map(item => String(item).trim()).filter(Boolean)
          return items.length ? items : undefined
        }

        if (typeof parsed === 'string') {
          return parsed
        }
      } catch {
        // Fall through to comma parsing.
      }
    }

    if (normalized.includes(',')) {
      const items = normalized.split(',').map(item => item.trim()).filter(Boolean)
      return items.length ? items : undefined
    }

    return normalized
  }

  private parseNumber(value: string | undefined, fallback: number): number {
    if (!value) {
      return fallback
    }

    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : fallback
  }

  private normalize(value: string | undefined): string | undefined {
    if (!value) {
      return undefined
    }

    const trimmed = value.trim()
    return trimmed.length ? trimmed : undefined
  }
}
