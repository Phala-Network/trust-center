import { S3Client } from 'bun'

export interface S3Config {
  endpoint: string
  accessKeyId: string
  secretAccessKey: string
  bucketName: string
}

export interface UploadResult {
  s3Filename: string
  s3Key: string
  s3Bucket: string
}

// S3 service factory function
export const createS3Service = (config: S3Config) => {
  const client = new S3Client({
    endpoint: config.endpoint,
    accessKeyId: config.accessKeyId,
    secretAccessKey: config.secretAccessKey,
    bucket: config.bucketName,
  })

  const uploadJson = async (data: unknown): Promise<UploadResult> => {
    const s3Filename = `${crypto.randomUUID()}.json`
    const string = JSON.stringify(data)

    await client.write(s3Filename, string)

    return {
      s3Filename,
      s3Key: s3Filename,
      s3Bucket: config.bucketName,
    }
  }

  const deleteObject = async (key: string): Promise<void> => {
    await client.delete(key)
  }

  return {
    uploadJson,
    deleteObject,
  }
}

export type S3Service = ReturnType<typeof createS3Service>
