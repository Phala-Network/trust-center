'use client'

import {placeholderData} from '@/data/placeholder-data'
import {type Data, type DataObject, safeParseData} from '@/data/schema'
import {env} from '@/env'

interface S3Response {
  completedAt: string
  dataObjects: any[]
  errors: any[]
  success: boolean
}

/**
 * Merge S3 data with placeholder data, marking missing objects as placeholders
 * @param s3Data - Data fetched from S3
 * @returns Merged data with placeholders marked
 */
function mergeWithPlaceholderData(s3Data: Data): Data {
  const s3DataMap = new Map<string, DataObject>()

  // Create a map of S3 data by ID for fast lookup
  for (const item of s3Data) {
    s3DataMap.set(item.id, item)
  }

  const mergedData: Data = []

  // Process each placeholder item
  for (const placeholderItem of placeholderData) {
    const s3Item = s3DataMap.get(placeholderItem.id)

    if (s3Item) {
      // S3 data exists, use it (without placeholder flag)
      mergedData.push(s3Item)
    } else {
      // S3 data missing, use placeholder data and mark it
      mergedData.push({
        ...placeholderItem,
        isPlaceholder: true,
      })
    }
  }

  return mergedData
}

/**
 * Fetch JSON data from S3 bucket (client-side)
 * @param s3Key - The S3 key/path to the JSON file
 * @returns Parsed data or null if fetch fails
 */
export async function fetchDataFromS3Client(
  s3Key: string,
): Promise<Data | null> {
  try {
    const s3Url = `${env.NEXT_PUBLIC_S3_BUCKET_URL}/${s3Key}`

    const response = await fetch(s3Url, {
      method: 'GET',
      // headers: {
      //   'Content-Type': 'application/json',
      // },
      // Always cache S3 data for better performance
      cache: 'force-cache',
    })

    if (!response.ok) {
      console.warn(
        `Failed to fetch data from S3: ${response.status} ${response.statusText}`,
      )
      return null
    }

    const rawData: S3Response = await response.json()

    // Check if the response is successful and has dataObjects
    if (!rawData.success || !rawData.dataObjects) {
      console.warn('S3 response indicates failure or missing dataObjects')
      return null
    }

    // Parse the dataObjects array
    const s3Data = safeParseData(rawData.dataObjects)

    // Merge with placeholder data and mark missing items
    return mergeWithPlaceholderData(s3Data)
  } catch (error) {
    console.warn('Error fetching data from S3:', error)

    return null
  }
}
