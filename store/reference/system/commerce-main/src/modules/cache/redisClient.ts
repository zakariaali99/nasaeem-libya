import Redis from "ioredis";

type NoopPipeline = {
  rpush: (...args: any[]) => NoopPipeline;
  expire: (...args: any[]) => NoopPipeline;
  exec: () => Promise<any[]>;
};

type NoopRedisClient = {
  multi: () => NoopPipeline;
  set: (...args: any[]) => Promise<any>;
  get: (...args: any[]) => Promise<any>;
  lpop: (...args: any[]) => Promise<any>;
  del: (...args: any[]) => Promise<any>;
  exists: (...args: any[]) => Promise<any>;
  incr: (...args: any[]) => Promise<any>;
  decr: (...args: any[]) => Promise<any>;
  eval: (...args: any[]) => Promise<any>;
  scanStream: (...args: any[]) => NodeJS.ReadableStream;
  hset: (...args: any[]) => Promise<any>;
  hget: (...args: any[]) => Promise<any>;
  hdel: (...args: any[]) => Promise<any>;
  hmget: (...args: any[]) => Promise<any>;
  hgetall: (...args: any[]) => Promise<any>;
  quit: () => Promise<void>;
};

type RedisLike = Redis | NoopRedisClient;

const skipRedis = process.env.SKIP_REDIS === "true" || process.env.SKIP_SERVER_INIT === "true";

function createNoopRedisClient(): NoopRedisClient {
  console.warn("Redis client disabled (SKIP_REDIS/SKIP_SERVER_INIT). Using noop client for this build/runtime phase.");

  const noopPipeline: NoopPipeline = {
    rpush: () => noopPipeline,
    expire: () => noopPipeline,
    exec: async () => [],
  };

  return {
    multi: () => noopPipeline,
    set: async () => null,
    get: async () => null,
    lpop: async () => [],
    del: async () => 0,
    exists: async () => 0,
    incr: async () => 0,
    decr: async () => 0,
    eval: async () => null,
    scanStream: () => {
      const { Readable } = require("stream");
      return new Readable({
        read() {
          this.push(null);
        },
      });
    },
    hset: async () => 0,
    hget: async () => null,
    hdel: async () => 0,
    hmget: async () => [],
    hgetall: async () => ({}),
    quit: async () => undefined,
  };
}

function createRedisClient(): Redis {
  const redisHost = process.env.REDIS_HOST;
  const redisPortStr = process.env.REDIS_PORT;

  if (!redisHost || !redisPortStr) {
    throw new Error("Missing REDIS_HOST or REDIS_PORT environment variable for Redis connection");
  }

  const redisPort = parseInt(redisPortStr, 10);
  if (isNaN(redisPort)) {
    throw new Error("Invalid REDIS_PORT environment variable");
  }

  const redisPassword = process.env.REDIS_PASSWORD;

  const client = new Redis({
    host: redisHost,
    port: redisPort,
    password: redisPassword,
    maxRetriesPerRequest: null,
    enableOfflineQueue: true,
    reconnectOnError: (err) => {
      const targetError = "READONLY";
      if (err.message.includes(targetError)) {
        return true;
      }
      return false;
    },
  });

  client.on("error", (err) => {
    console.error("Redis Client Error:", err);
  });

  client.on("connect", () => {
    console.info("Redis client connected");
  });

  return client;
}

const redisClient: RedisLike = skipRedis ? createNoopRedisClient() : createRedisClient();

export default redisClient as unknown as Redis;
