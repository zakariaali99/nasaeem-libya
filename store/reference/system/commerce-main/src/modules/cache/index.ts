import redisClient from "./redisClient";
import { randomUUID } from 'crypto';

// Global cache prefix to avoid key collisions
const CACHE_PREFIX = process.env.CACHE_PREFIX || "wave";

/**
 * Build the redis key with prefix
 * @param key Base key
 */
const buildKey = (key: string) => `${CACHE_PREFIX}:${key}`;

/**
 * Set a value in cache with optional TTL (in seconds)
 * @param key Cache key
 * @param value Value to store (serializable)
 * @param ttlSeconds Optional time to live in seconds
 */
export async function setCache(key: string, value: any, ttlSeconds?: number): Promise<void> {
  const redisKey = buildKey(key);
  const payload = JSON.stringify(value);
  try {
    if (ttlSeconds && ttlSeconds > 0) {
      await redisClient.set(redisKey, payload, "EX", ttlSeconds);
    } else {
      await redisClient.set(redisKey, payload);
    }
  } catch (err) {
    console.error(`Failed to set cache for key ${redisKey}:`, err);
    throw err;
  }
}

/**
 * Get a value from cache
 * @param key Cache key
 * @returns Parsed value or null if not found
 */
export async function getCache<T>(key: string): Promise<T | null> {
  const redisKey = buildKey(key);
  try {
    const reply = await redisClient.get(redisKey);
    if (!reply) return null;
    return JSON.parse(reply) as T;
  } catch (err) {
    console.error(`Failed to get cache for key ${redisKey}:`, err);
    throw err;
  }
}

/**
 * Delete a key from cache
 * @param key Cache key
 */
export async function deleteCache(key: string): Promise<void> {
  const redisKey = buildKey(key);
  try {
    await redisClient.del(redisKey);
  } catch (err) {
    console.error(`Failed to delete cache for key ${redisKey}:`, err);
    throw err;
  }
}

/**
 * Check if a key exists in cache
 * @param key Cache key
 * @returns true if exists
 */
export async function cacheExists(key: string): Promise<boolean> {
  const redisKey = buildKey(key);
  try {
    const count = await redisClient.exists(redisKey);
    return count > 0;
  } catch (err) {
    console.error(`Failed to check existence for key ${redisKey}:`, err);
    throw err;
  }
}

/**
 * Increment a numeric key atomically
 * @param key Cache key
 * @returns New value
 */
export async function incr(key: string): Promise<number> {
  const redisKey = buildKey(key);
  try {
    return await redisClient.incr(redisKey);
  } catch (err) {
    console.error(`Failed to increment key ${redisKey}:`, err);
    throw err;
  }
}

/**
 * Decrement a numeric key atomically
 * @param key Cache key
 * @returns New value
 */
export async function decr(key: string): Promise<number> {
  const redisKey = buildKey(key);
  try {
    return await redisClient.decr(redisKey);
  } catch (err) {
    console.error(`Failed to decrement key ${redisKey}:`, err);
    throw err;
  }
}

/**
 * Acquire a distributed lock for a given key
 * @param key Base key for lock
 * @param ttlMs Time to live in milliseconds for the lock
 * @returns Lock identifier
 */
export async function acquireLock(key: string, ttlMs: number): Promise<string> {
  const redisKey = buildKey(`lock:${key}`);
  const lockId = randomUUID();
  const acquired = await redisClient.set(redisKey, lockId, 'PX', ttlMs, 'NX');
  if (acquired !== 'OK') {
    throw new Error(`Could not acquire lock for key ${key}`);
  }
  return lockId;
}

/**
 * Release a distributed lock if lockId matches
 * @param key Base key for lock
 * @param lockId Identifier returned from acquireLock
 */
export async function releaseLock(key: string, lockId: string): Promise<void> {
  const redisKey = buildKey(`lock:${key}`);
  const lua = `
    if redis.call('get', KEYS[1]) == ARGV[1] then
      return redis.call('del', KEYS[1])
    else
      return 0
    end
  `;
  await redisClient.eval(lua, 1, redisKey, lockId);
}

/**
 * Flush all cache entries matching a pattern
 * @param pattern Pattern to match (without prefix)
 */
export async function flushCacheByPattern(pattern: string): Promise<void> {
  const stream = redisClient.scanStream({ match: buildKey(pattern), count: 100 });
  for await (const keys of stream) {
    if (keys.length) {
      await redisClient.del(...keys);
    }
  }
}

/**
 * Set a Redis hash at a key
 * @param key Base key
 * @param hash Object to store as hash (serializes values)
 */
export async function setHash(key: string, hash: Record<string, any>): Promise<void> {
  const redisKey = buildKey(key);
  const flat: string[] = [];
  for (const field in hash) {
    flat.push(field, JSON.stringify(hash[field]));
  }
  if (flat.length) await redisClient.hset(redisKey, ...flat);
}

/**
 * Get a Redis hash
 * @param key Base key
 * @param fields Optional specific fields to retrieve
 */
export async function getHash<T>(key: string, fields?: string[]): Promise<Record<string, T> | null> {
  const redisKey = buildKey(key);
  let data: Record<string, string> | string[];
  if (fields && fields.length) {
    data = await redisClient.hmget(redisKey, ...fields) as string[];
  } else {
    data = await redisClient.hgetall(redisKey);
  }
  if (!data || (Array.isArray(data) && data.every(v => v === null))) {
    return null;
  }
  const result: Record<string, T> = {};
  if (Array.isArray(data) && fields) {
    fields.forEach((f, i) => {
      if (data[i] !== null) result[f] = JSON.parse(data[i]) as T;
    });
  } else {
    for (const f in data as Record<string, string>) {
      result[f] = JSON.parse((data as Record<string, string>)[f]) as T;
    }
  }
  return result;
}

/**
 * Delete a Redis hash
 * @param key Base key
 */
export async function deleteHash(key: string): Promise<void> {
  const redisKey = buildKey(key);
  await redisClient.del(redisKey);
}
