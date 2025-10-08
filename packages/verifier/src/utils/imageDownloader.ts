import { exec } from 'node:child_process'
import { createWriteStream, existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { pipeline } from 'node:stream/promises'
import { promisify } from 'node:util'

import type { NormalizedVersionString } from '../types/metadata'
import { createNormalizedVersion } from '../types/metadata'

const execAsync = promisify(exec)

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
  if (folderName.startsWith('dstack-nvidia-dev-')) {
    const version = createNormalizedVersion(
      `v${folderName.replace('dstack-nvidia-dev-', '')}`,
    )
    return {
      variant: 'nvidia',
      version,
      downloadUrl: `https://github.com/nearai/private-ml-sdk/releases/download/${version}/dstack-nvidia-dev-${version.slice(1)}.tar.gz`,
    }
  }

  if (folderName.startsWith('dstack-nvidia-')) {
    const version = createNormalizedVersion(
      `v${folderName.replace('dstack-nvidia-', '')}`,
    )
    return {
      variant: 'nvidia',
      version,
      downloadUrl: `https://github.com/nearai/private-ml-sdk/releases/download/${version}/dstack-nvidia-${version.slice(1)}.tar.gz`,
    }
  }

  if (folderName.startsWith('dstack-dev-')) {
    const version = createNormalizedVersion(
      `v${folderName.replace('dstack-dev-', '')}`,
    )
    return {
      variant: 'standard',
      version,
      downloadUrl: `https://github.com/Dstack-TEE/meta-dstack/releases/download/${version}/dstack-dev-${version.slice(1)}.tar.gz`,
    }
  }

  if (folderName.startsWith('dstack-')) {
    const version = createNormalizedVersion(
      `v${folderName.replace('dstack-', '')}`,
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
 * Downloads and extracts a dstack image tarball
 * @param downloadUrl - URL to download from
 * @param imageFolderName - Target folder name
 * @param imagesDir - Base directory for images
 */
async function downloadAndExtract(
  downloadUrl: string,
  imageFolderName: string,
  imagesDir: string,
): Promise<void> {
  const tarballPath = join(imagesDir, `${imageFolderName}.tar.gz`)
  const targetDir = join(imagesDir, imageFolderName)

  console.log(
    `Downloading dstack image ${imageFolderName} from ${downloadUrl}...`,
  )

  try {
    // Create target directory
    mkdirSync(targetDir, { recursive: true })

    // Download tarball using native fetch (avoids fd inheritance issues with wget)
    const response = await fetch(downloadUrl)
    if (!response.ok || !response.body) {
      throw new Error(
        `Failed to download: ${response.status} ${response.statusText}`,
      )
    }

    // Stream response to file
    await pipeline(
      response.body as unknown as NodeJS.ReadableStream,
      createWriteStream(tarballPath),
    )

    // Extract tarball into the target directory, stripping the root folder
    await execAsync(`tar -xzf "${tarballPath}" -C "${targetDir}" --strip-components=1`)

    // Clean up tarball
    await execAsync(`rm "${tarballPath}"`)

    console.log(`Successfully downloaded and extracted ${imageFolderName}`)
  } catch (error) {
    // Clean up on error
    try {
      await execAsync(`rm -f "${tarballPath}"`)
      await execAsync(`rm -rf "${targetDir}"`)
    } catch {
      // Ignore cleanup errors
    }

    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error'
    throw new Error(
      `Failed to download dstack image from ${downloadUrl}: ${errorMessage}`,
    )
  }
}

/**
 * Ensures a dstack image is available locally, downloading it if necessary
 * @param imageFolderName - e.g., "dstack-0.5.3", "dstack-nvidia-0.5.3"
 * @returns Path to the image folder
 * @throws Error if download fails or image is invalid
 */
export async function ensureDstackImage(
  imageFolderName: string,
): Promise<string> {
  const imagesDir = join(process.cwd(), 'external', 'dstack-images')
  const imagePath = join(imagesDir, imageFolderName)
  const metadataPath = join(imagePath, 'metadata.json')

  // Create images directory if it doesn't exist
  if (!existsSync(imagesDir)) {
    mkdirSync(imagesDir, { recursive: true })
  }

  // Check if already downloaded and valid
  if (existsSync(metadataPath)) {
    console.log(`Using cached dstack image: ${imageFolderName}`)
    return imagePath
  }

  // Parse folder name to get download URL
  const imageInfo = parseImageFolderName(imageFolderName)

  // Download and extract
  await downloadAndExtract(imageInfo.downloadUrl, imageFolderName, imagesDir)

  // Verify metadata.json exists after extraction
  if (!existsSync(metadataPath)) {
    throw new Error(
      `Downloaded dstack image ${imageFolderName} is missing metadata.json`,
    )
  }

  return imagePath
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
