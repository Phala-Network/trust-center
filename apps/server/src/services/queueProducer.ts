import {type JobsOptions, Queue} from 'bullmq'
import IORedis from 'ioredis'

// Kept separate from the worker: producer requests must never wait indefinitely
// for Redis readiness, including when Redis is unavailable at process startup.
export function createQueueProducer(
  redisUrl: string,
  queueName: string,
  defaultJobOptions: JobsOptions,
) {
  const redis = new IORedis(redisUrl, {
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
    commandTimeout: 10000,
    retryStrategy: (times) => Math.min(times * 50, 2000),
  })
  redis.on('error', () => console.error('[QUEUE] Producer Redis unavailable'))
  const queue = new Queue(queueName, {connection: redis, defaultJobOptions})
  queue.on('error', () => console.error('[QUEUE] Producer queue unavailable'))
  const add = async (name: string, data: unknown, options: JobsOptions) => {
    // BullMQ's initialization waits for first readiness even when ioredis disables
    // offline commands. Check BEFORE queue.add, not a timeout race (which can send
    // a supposedly failed job later when Redis returns).
    if (redis.status !== 'ready')
      throw new Error('Verification queue is unavailable')
    return queue.add(name, data, options)
  }
  const close = async () => {
    redis.disconnect()
    await queue.close()
  }
  return {queue, add, close}
}
