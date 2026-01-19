// src/lib/auth/AuthManagerWithBlocker.ts

import type { SupabaseClient, Session } from '@supabase/supabase-js';

type Logger = {
  info: (...args: any[]) => void;
  warn: (...args: any[]) => void;
  error: (...args: any[]) => void;
};

export interface AuthManagerOptions {
  supabase: SupabaseClient;
  minIntervalMs?: number;
  backoffBaseMs?: number;
  backoffMaxMs?: number;
  maxRetries?: number;
  logger?: Logger;
  
  // Blocker settings
  slidingWindowMs?: number;         // window to count attempts (default 60s)
  maxAttemptsInWindow?: number;     // threshold to trigger lockout (default 20 attempts)
  lockoutMs?: number;               // duration to block after threshold exceeded (default 60s)
  lockoutBackoffMultiplier?: number; // multiplier for consecutive lockouts (default 2)
  enableCrossTab?: boolean;         // use BroadcastChannel to coordinate lockouts across tabs
}

type LockoutState = {
  lockedUntil: number; // epoch ms until which refreshes are blocked
  consecutiveLockouts: number;
};

export class AuthManagerWithBlocker {
  private supabase: SupabaseClient;
  private minIntervalMs: number;
  private backoffBaseMs: number;
  private backoffMaxMs: number;
  private maxRetries: number;
  private logger: Logger;
  
  // blocker params
  private slidingWindowMs: number;
  private maxAttemptsInWindow: number;
  private lockoutMs: number;
  private lockoutBackoffMultiplier: number;
  private enableCrossTab: boolean;
  
  // internal state
  private lastRefreshTs = 0;
  private refreshingPromise: Promise<Session | null> | null = null;
  
  // sliding window queue of attempt timestamps (ms)
  private attemptTimestamps: number[] = [];
  
  // lockout state
  private lockoutState: LockoutState = { lockedUntil: 0, consecutiveLockouts: 0 };
  
  // cross-tab channel
  private bc: BroadcastChannel | null = null;

  constructor(opts: AuthManagerOptions) {
    this.supabase = opts.supabase;
    this.minIntervalMs = opts.minIntervalMs ?? 30_000;
    this.backoffBaseMs = opts.backoffBaseMs ?? 1_000;
    this.backoffMaxMs = opts.backoffMaxMs ?? 30_000;
    this.maxRetries = opts.maxRetries ?? 4;
    this.logger = opts.logger ?? console;
    this.slidingWindowMs = opts.slidingWindowMs ?? 60_000;
    this.maxAttemptsInWindow = opts.maxAttemptsInWindow ?? 20;
    this.lockoutMs = opts.lockoutMs ?? 60_000;
    this.lockoutBackoffMultiplier = opts.lockoutBackoffMultiplier ?? 2;
    this.enableCrossTab = !!opts.enableCrossTab;
    
    if (this.enableCrossTab && typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        this.bc = new BroadcastChannel('auth-manager-lockout');
        this.bc.onmessage = (ev) => this.handleBroadcastMsg(ev.data);
      } catch (err) {
        this.logger.warn('[AuthManager] BroadcastChannel unavailable', err);
        this.bc = null;
      }
    }
  }

  /* ---------- Utilities ---------- */

  private now() {
    return Date.now();
  }

  private maskToken(token: string | null | undefined) {
    if (!token) return '<no-refresh-token>';
    if (token.length <= 8) return '****' + token;
    return '****' + token.slice(-8);
  }

  private async wait(ms: number) {
    return new Promise((res) => setTimeout(res, ms));
  }

  private async waitWithJitter(attempt: number) {
    const exp = Math.min(this.backoffBaseMs * 2 ** attempt, this.backoffMaxMs);
    const jitter = Math.random() * exp;
    const wait = Math.floor(jitter);
    this.logger.info('[AuthManager] backoff wait', { attempt, wait });
    return this.wait(wait);
  }

  /* ---------- Sliding window counter + lockout ---------- */

  private recordAttempt() {
    const t = this.now();
    this.attemptTimestamps.push(t);
    
    // prune old timestamps
    const cutoff = t - this.slidingWindowMs;
    while (this.attemptTimestamps.length && this.attemptTimestamps[0] < cutoff) {
      this.attemptTimestamps.shift();
    }
    
    this.logger.info('[AuthManager] attempt recorded', {
      countInWindow: this.attemptTimestamps.length,
      windowMs: this.slidingWindowMs,
    });
    
    // check threshold
    if (this.attemptTimestamps.length >= this.maxAttemptsInWindow) {
      this.triggerLockout();
    }
  }

  private triggerLockout() {
    const now = this.now();
    
    // increase consecutive lockouts
    this.lockoutState.consecutiveLockouts += 1;
    
    const multiplier = this.lockoutBackoffMultiplier ** (this.lockoutState.consecutiveLockouts - 1);
    const effectiveLockoutMs = Math.min(this.lockoutMs * multiplier, 24 * 60 * 60 * 1000); // cap 24h
    
    this.lockoutState.lockedUntil = now + effectiveLockoutMs;
    
    this.logger.warn('[AuthManager] lockout triggered', {
      lockedUntil: this.lockoutState.lockedUntil,
      consecutiveLockouts: this.lockoutState.consecutiveLockouts,
      effectiveLockoutMs,
    });
    
    // broadcast to other tabs
    this.broadcastLockout();
  }

  private clearLockout() {
    this.lockoutState = { lockedUntil: 0, consecutiveLockouts: 0 };
    this.logger.info('[AuthManager] lockout cleared');
    this.broadcastLockout();
  }

  private isLocked() {
    return this.now() < this.lockoutState.lockedUntil;
  }

  /* ---------- Cross-tab handling ---------- */

  private broadcastLockout() {
    if (!this.bc) return;
    
    try {
      this.bc.postMessage({
        type: 'lockout',
        lockedUntil: this.lockoutState.lockedUntil,
        consecutiveLockouts: this.lockoutState.consecutiveLockouts,
      });
    } catch (err) {
      this.logger.warn('[AuthManager] broadcast failed', err);
    }
  }

  private handleBroadcastMsg(msg: any) {
    if (!msg || msg.type !== 'lockout') return;
    
    const incomingLockedUntil = msg.lockedUntil ?? 0;
    const incomingConsecutive = msg.consecutiveLockouts ?? 0;
    
    // adopt the stricter lockout (longer)
    if (incomingLockedUntil > this.lockoutState.lockedUntil) {
      this.lockoutState.lockedUntil = incomingLockedUntil;
      this.lockoutState.consecutiveLockouts = Math.max(
        this.lockoutState.consecutiveLockouts,
        incomingConsecutive
      );
      this.logger.info('[AuthManager] adopted lockout from other tab', {
        lockedUntil: incomingLockedUntil,
      });
    }
  }

  /* ---------- Session helpers ---------- */

  async getSession(): Promise<Session | null> {
    const { data } = await this.supabase.auth.getSession();
    return data?.session ?? null;
  }

  private tokenExpiresSoon(session: Session | null, thresholdSeconds = 60): boolean {
    if (!session) return true;
    
    const exp = session.expires_at ?? 0;
    const now = Math.floor(Date.now() / 1000);
    return exp - now <= thresholdSeconds;
  }

  /* ---------- Public API ---------- */

  async ensureFreshSession(): Promise<Session | null> {
    const current = await this.getSession();
    if (current && !this.tokenExpiresSoon(current)) return current;
    
    return this.forceRefreshSession();
  }

  async forceRefreshSession(): Promise<Session | null> {
    // If locked, early exit
    if (this.isLocked()) {
      this.logger.warn('[AuthManager] refresh attempt blocked by lockout', {
        blockedUntil: this.lockoutState.lockedUntil,
      });
      return this.getSession();
    }
    
    // Enforce min interval
    const now = this.now();
    const sinceLast = now - this.lastRefreshTs;
    
    if (sinceLast < this.minIntervalMs) {
      this.logger.info('[AuthManager] minInterval enforced, returning stored session', {
        sinceLast,
      });
      
      // record that an attempt was attempted (for sliding window)
      this.recordAttempt();
      
      return this.getSession();
    }
    
    // coalesce concurrent refreshes
    if (this.refreshingPromise) {
      this.logger.info('[AuthManager] joining existing refresh promise');
      this.recordAttempt();
      return this.refreshingPromise;
    }
    
    // create the coalesced promise
    this.refreshingPromise = (async () => {
      this.recordAttempt();
      let attempt = 0;
      let lastError: any = null;
      
      const sessionBefore = await this.getSession();
      const refreshToken = (sessionBefore as any)?.refresh_token ?? null;
      
      this.logger.info('[AuthManager] starting refresh', {
        masked_refresh: this.maskToken(refreshToken),
      });
      
      while (attempt <= this.maxRetries) {
        try {
          const res = await this.supabase.auth.refreshSession();
          const data = (res as any).data;
          const error = (res as any).error;
          
          if (error) {
            lastError = error;
            const status = (error as any)?.status;
            
            this.logger.warn('[AuthManager] refreshSession error', { attempt, status, error });
            
            if (status === 429) {
              // if we hit 429, increase attempt count and possibly lockout if many retries/attempts
              if (attempt >= this.maxRetries) {
                this.logger.error('[AuthManager] maxRetries reached for 429, triggering lockout');
                this.triggerLockout();
                break;
              }
              await this.waitWithJitter(attempt);
              attempt++;
              continue;
            }
            
            // other errors: do not retry many times
            break;
          }
          
          // success
          const newSession: Session | null = data?.session ?? null;
          
          this.lastRefreshTs = this.now();
          
          // reset lockout counters on success
          if (this.lockoutState.consecutiveLockouts > 0) {
            this.lockoutState.consecutiveLockouts = 0;
            this.lockoutState.lockedUntil = 0;
            this.broadcastLockout();
            this.logger.info('[AuthManager] cleared consecutiveLockouts after successful refresh');
          }
          
          this.logger.info('[AuthManager] refresh successful', {
            expires_at: newSession?.expires_at ?? null,
            masked_refresh: this.maskToken((newSession as any)?.refresh_token),
          });
          
          return newSession;
        } catch (err) {
          lastError = err;
          this.logger.warn('[AuthManager] exception during refresh', { attempt, err });
          
          if (attempt >= this.maxRetries) break;
          
          await this.waitWithJitter(attempt);
          attempt++;
        }
      }
      
      // final failure: recorded attempts may have triggered a lockout earlier
      this.logger.error('[AuthManager] refresh failed after retries', { lastError });
      
      // return current session (may be null)
      return this.getSession();
    })();
    
    try {
      const result = await this.refreshingPromise;
      return result;
    } finally {
      this.refreshingPromise = null;
    }
  }
}
