import { exec } from 'node:child_process'
import { existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { promisify } from 'node:util'

const execAsync = promisify(exec)

/**
 * Information extracted from dstack image folder name
 */
interface ImageInfo {
  variant: 'standard' | 'nvidia'
  version: string
  downloadUrl: string
}

/**
 * Parses a dstack image folder name to extract variant, version, and download URL
 * @param folderName - e.g., "dstack-0.5.3", "dstack-dev-0.5.3", "dstack-nvidia-0.5.3", "dstack-nvidia-dev-0.5.3"
 * @returns Parsed image information
 */
function parseImageFolderName(folderName: string): ImageInfo {
  if (folderName.startsWith('dstack-nvidia-dev-')) {
    const version = folderName.replace('dstack-nvidia-dev-', '')
    return {
      variant: 'nvidia',
      version,
      downloadUrl: `https://github.com/nearai/private-ml-sdk/releases/download/v${version}/dstack-nvidia-dev-${version}.tar.gz`,
    }
  }

  if (folderName.startsWith('dstack-nvidia-')) {
    const version = folderName.replace('dstack-nvidia-', '')
    return {
      variant: 'nvidia',
      version,
      downloadUrl: `https://github.com/nearai/private-ml-sdk/releases/download/v${version}/dstack-nvidia-${version}.tar.gz`,
    }
  }

  if (folderName.startsWith('dstack-dev-')) {
    const version = folderName.replace('dstack-dev-', '')
    return {
      variant: 'standard',
      version,
      downloadUrl: `https://github.com/Dstack-TEE/meta-dstack/releases/download/v${version}/dstack-dev-${version}.tar.gz`,
    }
  }

  if (folderName.startsWith('dstack-')) {
    const version = folderName.replace('dstack-', '')
    return {
      variant: 'standard',
      version,
      downloadUrl: `https://github.com/Dstack-TEE/meta-dstack/releases/download/v${version}/dstack-${version}.tar.gz`,
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

  console.log(
    `Downloading dstack image ${imageFolderName} from ${downloadUrl}...`,
  )

  try {
    // Download tarball
    await execAsync(`wget -O "${tarballPath}" "${downloadUrl}"`)

    // Extract tarball
    await execAsync(`tar -xzf "${tarballPath}" -C "${imagesDir}"`)

    // Clean up tarball
    await execAsync(`rm "${tarballPath}"`)

    console.log(`Successfully downloaded and extracted ${imageFolderName}`)
  } catch (error) {
    // Clean up on error
    try {
      await execAsync(`rm -f "${tarballPath}"`)
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
