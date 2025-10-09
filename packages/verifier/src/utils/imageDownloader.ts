import { exec } from 'node:child_process'
import {
  createWriteStream,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { dirname, join } from 'node:path'
import { pipeline } from 'node:stream/promises'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

import type { NormalizedVersionString } from '../types/metadata'
import { createNormalizedVersion } from '../types/metadata'

const execAsync = promisify(exec)

// Singleton pattern: Track ongoing downloads to prevent duplicates
const downloadPromises = new Map<string, Promise<string>>()

// Download timeout (10 minutes for large images)
const DOWNLOAD_TIMEOUT_MS = 10 * 60 * 1000

// Maximum retry attempts for failed downloads
const MAX_RETRIES = 3

// Backoff delay between retries (in ms)
const RETRY_DELAY_MS = 2000

/**
 * Information extracted from dstack image folder name
 */
interface ImageInfo {
  variant: 'standard' | 'nvidia'
  version: NormalizedVersionString
  downloadUrl: string
}

/**
 * Parses a dstack image folder name to extract variant, version, and download URL
 * @param folderName - e.g., "dstack-0.5.3", "dstack-dev-0.5.3", "dstack-nvidia-0.5.3", "dstack-nvidia-dev-0.5.3"
 * @returns Parsed image information
 */
function parseImageFolderName(folderName: string): ImageInfo {
  // Normalize the folder name (trim whitespace)
  const normalized = folderName.trim()

  // Validate format
  if (!normalized.startsWith('dstack-')) {
    throw new Error(
      `Invalid dstack image folder name: ${folderName}. Expected format: dstack-[nvidia-][dev-]<version>`,
    )
  }

  // Parse nvidia-dev variant
  if (normalized.startsWith('dstack-nvidia-dev-')) {
    const versionPart = normalized.slice(18) // Remove 'dstack-nvidia-dev-'
    const version = createNormalizedVersion(
      versionPart.startsWith('v') ? versionPart : `v${versionPart}`,
    )
    return {
      variant: 'nvidia',
      version,
      downloadUrl: `https://github.com/nearai/private-ml-sdk/releases/download/${version}/dstack-nvidia-dev-${version.slice(1)}.tar.gz`,
    }
  }

  // Parse nvidia variant
  if (normalized.startsWith('dstack-nvidia-')) {
    const versionPart = normalized.slice(14) // Remove 'dstack-nvidia-'
    const version = createNormalizedVersion(
      versionPart.startsWith('v') ? versionPart : `v${versionPart}`,
    )
    return {
      variant: 'nvidia',
      version,
      downloadUrl: `https://github.com/nearai/private-ml-sdk/releases/download/${version}/dstack-nvidia-${version.slice(1)}.tar.gz`,
    }
  }

  // Parse dev variant
  if (normalized.startsWith('dstack-dev-')) {
    const versionPart = normalized.slice(11) // Remove 'dstack-dev-'
    const version = createNormalizedVersion(
      versionPart.startsWith('v') ? versionPart : `v${versionPart}`,
    )
    return {
      variant: 'standard',
      version,
      downloadUrl: `https://github.com/Dstack-TEE/meta-dstack/releases/download/${version}/dstack-dev-${version.slice(1)}.tar.gz`,
    }
  }

  // Parse standard variant
  if (normalized.startsWith('dstack-')) {
    const versionPart = normalized.slice(7) // Remove 'dstack-'
    const version = createNormalizedVersion(
      versionPart.startsWith('v') ? versionPart : `v${versionPart}`,
    )
    return {
      variant: 'standard',
      version,
      downloadUrl: `https://github.com/Dstack-TEE/meta-dstack/releases/download/${version}/dstack-${version.slice(1)}.tar.gz`,
    }
  }

  throw new Error(
    `Invalid dstack image folder name: ${folderName}. Expected format: dstack-[nvidia-][dev-]<version>`,
  )
}

/**
 * Sleep for a specified duration
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Creates a timeout promise that rejects after a specified duration
 */
function createTimeout(ms: number, operation: string): Promise<never> {
  return new Promise((_, reject) =>
    setTimeout(
      () => reject(new Error(`${operation} timed out after ${ms}ms`)),
      ms,
    ),
  )
}

/**
 * Validates that a path doesn't contain shell injection characters
 */
function sanitizePath(path: string): string {
  if (path.includes('`') || path.includes('$') || path.includes(';')) {
    throw new Error(`Invalid path contains shell metacharacters: ${path}`)
  }
  return path
}

/**
 * Marks an image as being actively downloaded by creating a lock file
 */
function createDownloadLock(lockPath: string): void {
  writeFileSync(
    lockPath,
    JSON.stringify({
      pid: process.pid,
      timestamp: Date.now(),
    }),
  )
}

/**
 * Checks if a download lock is stale (older than 30 minutes)
 */
function isLockStale(lockPath: string): boolean {
  try {
    const lockData = JSON.parse(readFileSync(lockPath, 'utf-8'))
    const age = Date.now() - lockData.timestamp
    return age > 30 * 60 * 1000 // 30 minutes
  } catch {
    return true // If we can't read it, consider it stale
  }
}

/**
 * Downloads and extracts a dstack image tarball with retry logic
 * @param downloadUrl - URL to download from
 * @param imageFolderName - Target folder name
 * @param imagesDir - Base directory for images
 * @param attempt - Current retry attempt (internal use)
 */
async function downloadAndExtract(
  downloadUrl: string,
  imageFolderName: string,
  imagesDir: string,
  attempt = 1,
): Promise<void> {
  const tarballPath = join(imagesDir, `${imageFolderName}.tar.gz`)
  const targetDir = join(imagesDir, imageFolderName)
  const lockPath = join(imagesDir, `${imageFolderName}.lock`)
  const metadataPath = join(targetDir, 'metadata.json')

  // Sanitize paths to prevent shell injection
  sanitizePath(tarballPath)
  sanitizePath(targetDir)

  console.log(
    `[${attempt}/${MAX_RETRIES}] Downloading dstack image ${imageFolderName} from ${downloadUrl}...`,
  )

  try {
    // Check for and handle stale locks
    if (existsSync(lockPath) && isLockStale(lockPath)) {
      console.log('Removing stale download lock...')
      rmSync(lockPath, {force: true})
    }

    // Create lock file to prevent concurrent downloads from other processes
    createDownloadLock(lockPath)

    // Clean up any partial previous attempts
    if (existsSync(targetDir)) {
      console.log('Cleaning up incomplete previous download...')
      rmSync(targetDir, {recursive: true, force: true})
    }
    if (existsSync(tarballPath)) {
      rmSync(tarballPath, {force: true})
    }

    // Create target directory
    mkdirSync(targetDir, {recursive: true})

    // Download tarball with timeout
    const downloadPromise = (async () => {
      const response = await fetch(downloadUrl)
      if (!response.ok || !response.body) {
        throw new Error(
          `HTTP ${response.status}: ${response.statusText}`,
        )
      }

      const writeStream = createWriteStream(tarballPath)
      await pipeline(
        response.body as unknown as NodeJS.ReadableStream,
        writeStream,
      )
    })()

    await Promise.race([
      downloadPromise,
      createTimeout(DOWNLOAD_TIMEOUT_MS, 'Download'),
    ])

    console.log('Download complete, extracting tarball...')

    // Extract tarball into the target directory, stripping the root folder
    await execAsync(
      `tar -xzf "${tarballPath}" -C "${targetDir}" --strip-components=1`,
    )

    // Verify extraction was successful
    if (!existsSync(metadataPath)) {
      throw new Error('Extraction failed: metadata.json not found')
    }

    // Clean up tarball
    rmSync(tarballPath, {force: true})

    // Remove lock file on success
    rmSync(lockPath, {force: true})

    console.log(`Successfully downloaded and extracted ${imageFolderName}`)
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'

    // Clean up on error
    try {
      rmSync(tarballPath, {force: true})
      rmSync(targetDir, {recursive: true, force: true})
      rmSync(lockPath, {force: true})
    } catch {
      // Ignore cleanup errors
    }

    // Retry on failure
    if (attempt < MAX_RETRIES) {
      console.log(
        `Download failed: ${errorMessage}. Retrying in ${RETRY_DELAY_MS}ms...`,
      )
      await sleep(RETRY_DELAY_MS)
      return downloadAndExtract(downloadUrl, imageFolderName, imagesDir, attempt + 1)
    }

    throw new Error(
      `Failed to download dstack image after ${MAX_RETRIES} attempts: ${errorMessage}`,
    )
  }
}

// Cached verifier base directory to avoid repeated path resolution
let cachedVerifierBaseDir: string | null = null

/**
 * Get the base directory for the verifier package
 * Works in both dev (from source) and Docker (from dist)
 */
function getVerifierBaseDir(): string {
  // Return cached value if already resolved
  if (cachedVerifierBaseDir) {
    return cachedVerifierBaseDir
  }

  // In Bun, import.meta.url points to the actual source file location
  // This file is at packages/verifier/src/utils/imageDownloader.ts
  // We need to resolve to packages/verifier/
  const currentFileUrl = import.meta.url
  const currentFilePath = fileURLToPath(currentFileUrl)

  // Navigate up from src/utils/ to get to packages/verifier/
  // current: /path/to/packages/verifier/src/utils/imageDownloader.ts
  // target:  /path/to/packages/verifier/
  const verifierDir = join(dirname(currentFilePath), '..', '..')

  console.log(`[imageDownloader] Current file: ${currentFilePath}`)
  console.log(`[imageDownloader] Verifier base dir: ${verifierDir}`)
  console.log(`[imageDownloader] Images will be stored in: ${join(verifierDir, 'external', 'dstack-images')}`)

  // Cache the result
  cachedVerifierBaseDir = verifierDir
  return verifierDir
}

/**
 * Ensures a dstack image is available locally, downloading it if necessary
 * Uses singleton pattern to prevent duplicate downloads when called simultaneously
 * @param imageFolderName - e.g., "dstack-0.5.3", "dstack-nvidia-0.5.3"
 * @returns Path to the image folder
 * @throws Error if download fails or image is invalid
 */
export async function ensureDstackImage(
  imageFolderName: string,
): Promise<string> {
  // Normalize the folder name to ensure consistent cache keys
  const normalizedFolderName = imageFolderName.trim()

  // Check if download is already in progress for this image (in-memory check)
  const existingPromise = downloadPromises.get(normalizedFolderName)
  if (existingPromise) {
    console.log(`[imageDownloader] Reusing existing download promise for ${normalizedFolderName}`)
    return existingPromise
  }

  // Start new download process
  const downloadPromise = (async () => {
    try {
      const verifierBaseDir = getVerifierBaseDir()
      const imagesDir = join(verifierBaseDir, 'external', 'dstack-images')
      const imagePath = join(imagesDir, normalizedFolderName)
      const metadataPath = join(imagePath, 'metadata.json')
      const lockPath = join(imagesDir, `${normalizedFolderName}.lock`)

      console.log(`[imageDownloader] Ensuring image ${normalizedFolderName}`)
      console.log(`[imageDownloader] Images directory: ${imagesDir}`)
      console.log(`[imageDownloader] Target path: ${imagePath}`)

      // Create images directory if it doesn't exist
      if (!existsSync(imagesDir)) {
        console.log(`[imageDownloader] Creating images directory: ${imagesDir}`)
        mkdirSync(imagesDir, {recursive: true})
      }

      // Check if already downloaded and valid (complete with metadata)
      if (existsSync(metadataPath)) {
        console.log(`[imageDownloader] Using cached dstack image: ${normalizedFolderName}`)
        return imagePath
      }

      // Check if another process is downloading (lock file exists and not stale)
      if (existsSync(lockPath) && !isLockStale(lockPath)) {
        console.log(
          `[imageDownloader] Another process is downloading ${normalizedFolderName}, waiting...`,
        )
        // Wait for the other process to finish
        let attempts = 0
        const maxWaitAttempts = 60 // 10 minutes (60 * 10s)
        while (existsSync(lockPath) && !isLockStale(lockPath) && attempts < maxWaitAttempts) {
          await sleep(10000) // Wait 10 seconds
          attempts++
          if (existsSync(metadataPath)) {
            console.log(`[imageDownloader] Download completed by another process: ${normalizedFolderName}`)
            return imagePath
          }
        }
      }

      // Parse folder name to get download URL
      const imageInfo = parseImageFolderName(normalizedFolderName)

      // Download and extract (with retries built-in)
      await downloadAndExtract(imageInfo.downloadUrl, normalizedFolderName, imagesDir)

      // Final verification
      if (!existsSync(metadataPath)) {
        throw new Error(
          `Downloaded dstack image ${normalizedFolderName} is missing metadata.json after extraction`,
        )
      }

      return imagePath
    } catch (error) {
      // Remove from cache on error so it can be retried
      downloadPromises.delete(normalizedFolderName)
      throw error
    } finally {
      // Clean up: remove from tracking map after a delay to allow other callers to reuse
      // This prevents race conditions where a caller checks just as we're finishing
      setTimeout(() => {
        downloadPromises.delete(normalizedFolderName)
      }, 1000)
    }
  })()

  // Track this download
  downloadPromises.set(normalizedFolderName, downloadPromise)
  console.log(`[imageDownloader] Created new download promise for ${normalizedFolderName}. Total active downloads: ${downloadPromises.size}`)

  return downloadPromise
}

/**
 * Extracts version number from KMS version string
 * @param versionString - e.g., "v0.5.3 (git:c06e524bd460fd9c9add)"
 * @returns Clean version number without 'v' prefix, e.g., "0.5.3"
 */
export function extractVersionNumber(versionString: string): string {
  // Match version pattern: v0.5.3 or just the number
  const match = versionString.match(/v?(\d+\.\d+\.\d+)/)
  if (!match?.[1]) {
    throw new Error(`Unable to extract version number from: ${versionString}`)
  }
  return match[1]
}
