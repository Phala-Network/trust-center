import { S3Client } from 'bun'

export interface R2Config {
  endpoint: string
  accessKeyId: string
  secretAccessKey: string
  bucketName: string
}

export interface UploadResult {
  fileName: string
  r2Key: string
  r2Bucket: string
}

// R2 service factory function
export const createR2Service = (config: R2Config) => {
  const client = new S3Client({
    endpoint: config.endpoint,
    accessKeyId: config.accessKeyId,
    secretAccessKey: config.secretAccessKey,
    bucket: config.bucketName,
  })
  const bucketName = config.bucketName

  const uploadJson = async (data: unknown): Promise<UploadResult> => {
    const fileName = `${crypto.randomUUID()}.json`
    const string = JSON.stringify(data)

    await client.write(fileName, string)

    return {
      fileName,
      r2Key: fileName,
      r2Bucket: bucketName,
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

export type R2Service = ReturnType<typeof createR2Service>
