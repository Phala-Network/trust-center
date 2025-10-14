'use client'

import {type Data, safeParseData} from '@/data/schema'
import {env} from '@/env'

interface S3Response {
  completedAt: string
  dataObjects: any[]
  errors: any[]
  success: boolean
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

    // Parse and return the dataObjects array
    return safeParseData(rawData.dataObjects)
  } catch (error) {
    console.warn('Error fetching data from S3:', error)

    return null
  }
}
