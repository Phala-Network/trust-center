import {expect, test} from 'bun:test'

import {createQueueProducer} from './queueProducer'

test('Redis offline before first readiness rejects enqueue without an orphaned operation', async () => {
  // Reserve an ephemeral loopback port, then close it: no Redis or production access.
  const socket = Bun.listen({
    hostname: '127.0.0.1',
    port: 0,
    socket: {data() {}},
  })
  const port = socket.port
  socket.stop(true)
  const producer = createQueueProducer(
    `redis://127.0.0.1:${port}`,
    `offline-${crypto.randomUUID()}`,
    {},
  )
  try {
    await expect(
      producer.add('verification', {appId: 'test'}, {jobId: 'offline-test'}),
    ).rejects.toThrow('Verification queue is unavailable')
  } finally {
    await producer.close()
  }
}, 2000)

const redisServer = Bun.which('redis-server')
;(redisServer ? test : test.skip)(
  'producer recovers first readiness with no delayed job, and deduplicates stable IDs',
  async () => {
    const socket = Bun.listen({
      hostname: '127.0.0.1',
      port: 0,
      socket: {data() {}},
    })
    const port = socket.port
    socket.stop(true)
    const producer = createQueueProducer(
      `redis://127.0.0.1:${port}`,
      `ready-${crypto.randomUUID()}`,
      {},
    )
    let server: ReturnType<typeof Bun.spawn> | undefined
    try {
      await expect(
        producer.add(
          'verification',
          {appId: 'test'},
          {jobId: 'must-not-arrive'},
        ),
      ).rejects.toThrow('Verification queue is unavailable')
      server = Bun.spawn(
        [
          redisServer!,
          '--bind',
          '127.0.0.1',
          '--port',
          String(port),
          '--save',
          '',
          '--appendonly',
          'no',
        ],
        {stdout: 'pipe', stderr: 'pipe'},
      )
      const stdout = server.stdout as ReadableStream<Uint8Array>
      const reader = stdout.getReader()
      let log = ''
      while (!log.includes('Ready to accept connections')) {
        const chunk = await reader.read()
        if (chunk.done) throw new Error('Disposable Redis exited before ready')
        log += new TextDecoder().decode(chunk.value)
      }
      reader.releaseLock()
      await producer.queue.waitUntilReady()
      expect(await producer.queue.getJob('must-not-arrive')).toBeUndefined()
      await producer.add(
        'verification',
        {appId: 'test'},
        {jobId: 'stable-test'},
      )
      await producer.add(
        'verification',
        {appId: 'test'},
        {jobId: 'stable-test'},
      )
      expect(await producer.queue.getWaitingCount()).toBe(1)
      await producer.queue.obliterate({force: true})
    } finally {
      await producer.close()
      if (server) {
        server.kill()
        await server.exited
      }
    }
  },
  5000,
)
