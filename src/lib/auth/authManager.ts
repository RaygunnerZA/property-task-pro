// src/lib/auth/authManager.ts
import { supabase } from "@/integrations/supabase/client";
import { AuthManagerWithBlocker } from "./AuthManagerWithBlocker";

/**
 * Global AuthManager instance with automatic loop detection and blocking
 * 
 * Configuration:
 * - minIntervalMs: 30s - minimum time between refresh attempts
 * - slidingWindowMs: 60s - time window for counting attempts
 * - maxAttemptsInWindow: 20 - threshold to trigger lockout
 * - lockoutMs: 60s - initial lockout duration
 * - lockoutBackoffMultiplier: 2 - exponential backoff for consecutive lockouts
 * - enableCrossTab: true - coordinate lockouts across browser tabs
 */
export const authManager = new AuthManagerWithBlocker({
  supabase,
  minIntervalMs: 30_000,           // 30 seconds minimum between refreshes
  backoffBaseMs: 1_000,            // 1 second base backoff
  backoffMaxMs: 30_000,            // 30 seconds max backoff
  maxRetries: 4,                   // Max retries per refresh attempt
  slidingWindowMs: 60_000,         // 1 minute sliding window
  maxAttemptsInWindow: 20,         // 20 attempts in 1 minute triggers lockout
  lockoutMs: 60_000,               // 1 minute lockout
  lockoutBackoffMultiplier: 2,     // Each lockout doubles duration (max 24h)
  enableCrossTab: true,            // Share lockout state across tabs
  logger: console,                 // Use console logger (can be swapped for Sentry)
});
