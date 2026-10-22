import {createHash} from 'node:crypto'
import {mkdtempSync, rmSync, writeFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {afterEach, describe, expect, test} from 'bun:test'

import {DSTACK_IMAGE_SHA256} from './dstackImageHashes'
import {
  ensureDstackImage,
  getPinnedImageSha256,
  sha256File,
} from './imageDownloader'

const originalFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = originalFetch
})

describe('getPinnedImageSha256', () => {
  test('returns the pinned digest for a known image', () => {
    const expected = DSTACK_IMAGE_SHA256['dstack-0.5.12.tar.gz']

    const pinned = getPinnedImageSha256(
      'https://example.invalid/releases/download/v0.5.12/dstack-0.5.12.tar.gz',
    )

    expect(pinned).toBe(expected as string)
  })

  test('refuses an image without a pinned digest', () => {
    expect(() =>
      getPinnedImageSha256(
        'https://example.invalid/releases/download/v9.9.9/dstack-9.9.9.tar.gz',
      ),
    ).toThrow('No pinned SHA-256')
  })

  test('every pinned digest is 64 lowercase hex characters', () => {
    for (const digest of Object.values(DSTACK_IMAGE_SHA256)) {
      expect(digest).toMatch(/^[0-9a-f]{64}$/)
    }
  })
})

describe('sha256File', () => {
  test('hashes file contents', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'image-hash-'))
    const path = join(directory, 'data.bin')
    const content = Buffer.from('dstack image bytes')
    writeFileSync(path, content)

    const digest = await sha256File(path)

    rmSync(directory, {recursive: true, force: true})
    expect(digest).toBe(createHash('sha256').update(content).digest('hex'))
  })
})

describe('ensureDstackImage', () => {
  test('rejects a downloaded tarball whose digest does not match', async () => {
    let requests = 0
    const tamperedFetch = async () => {
      requests++
      return new Response('not the real image')
    }
    globalThis.fetch = tamperedFetch as unknown as typeof fetch

    const outcome = ensureDstackImage('dstack-0.5.12').then(
      () => 'resolved',
      (error: Error) => error.message,
    )
    const message = await outcome

    expect(message).toContain('SHA-256 mismatch')
    expect(requests).toBe(3)
  }, 30_000)
})
