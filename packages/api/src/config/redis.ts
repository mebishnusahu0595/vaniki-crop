import { Redis, type RedisOptions } from 'ioredis';

const redisConfig: RedisOptions = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  maxRetriesPerRequest: null, // Required for BullMQ
};

/**
 * Initialize a shared Redis connection for applications or queues.
 */
const redisConnection = new Redis(redisConfig);

redisConnection.on('connect', () => {
  console.log('Successfully connected to Redis');
});

redisConnection.on('error', (err) => {
  console.error('Redis connection error:', err);
});

export { redisConnection, redisConfig };
