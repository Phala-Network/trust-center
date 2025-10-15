import { describe, expect, it } from 'vitest'
import type { DataObject } from '../types'
import { maskSensitiveDataObjects } from './maskSensitiveData'

describe('maskSensitiveData', () => {
  it('should mask docker_compose_file in compose_file JSON string', () => {
    const composeFileContent = JSON.stringify({
      manifest_version: 2,
      name: 'test-app',
      runner: 'docker-compose',
      docker_compose_file:
        'services:\n  app:\n    image: test:latest\n    ports:\n      - 8080:8080',
      kms_enabled: true,
      gateway_enabled: false,
    })

    const dataObjects: DataObject[] = [
      {
        id: 'app-code',
        name: 'APP Code',
        description: 'App source code',
        fields: {
          compose_file: composeFileContent,
          github_repo: 'https://github.com/test/test',
        },
        kind: 'app',
      },
    ]

    const masked = maskSensitiveDataObjects(dataObjects)

    expect(masked).toHaveLength(1)
    expect(masked[0]!.id).toBe('app-code')

    const maskedComposeFile = JSON.parse(
      masked[0]!.fields!.compose_file as string,
    )
    expect(maskedComposeFile.docker_compose_file).toBe('[MASKED]')
    expect(maskedComposeFile.manifest_version).toBe(2)
    expect(maskedComposeFile.name).toBe('test-app')
    expect(maskedComposeFile.kms_enabled).toBe(true)
  })

  it('should not modify data objects without compose_file', () => {
    const dataObjects: DataObject[] = [
      {
        id: 'app-cpu',
        name: 'CPU Hardware',
        description: 'Hardware info',
        fields: {
          manufacturer: 'Intel',
          model: 'TDX',
        },
        kind: 'app',
      },
    ]

    const masked = maskSensitiveDataObjects(dataObjects)

    expect(masked).toHaveLength(1)
    expect(masked[0]!).toEqual(dataObjects[0]!)
  })

  it('should handle multiple data objects', () => {
    const composeFile1 = JSON.stringify({
      manifest_version: 2,
      docker_compose_file: 'sensitive-content-1',
    })

    const composeFile2 = JSON.stringify({
      manifest_version: 2,
      docker_compose_file: 'sensitive-content-2',
    })

    const dataObjects: DataObject[] = [
      {
        id: 'kms-code',
        name: 'KMS Code',
        description: 'KMS code',
        fields: { compose_file: composeFile1 },
        kind: 'kms',
      },
      {
        id: 'gateway-code',
        name: 'Gateway Code',
        description: 'Gateway code',
        fields: { compose_file: composeFile2 },
        kind: 'gateway',
      },
      {
        id: 'app-cpu',
        name: 'CPU',
        description: 'CPU info',
        fields: { manufacturer: 'Intel' },
        kind: 'app',
      },
    ]

    const masked = maskSensitiveDataObjects(dataObjects)

    expect(masked).toHaveLength(3)

    const maskedKms = JSON.parse(masked[0]!.fields!.compose_file as string)
    expect(maskedKms.docker_compose_file).toBe('[MASKED]')

    const maskedGateway = JSON.parse(masked[1]!.fields!.compose_file as string)
    expect(maskedGateway.docker_compose_file).toBe('[MASKED]')

    expect(masked[2]!.fields!.manufacturer).toBe('Intel')
  })

  it('should handle malformed JSON gracefully', () => {
    const dataObjects: DataObject[] = [
      {
        id: 'app-code',
        name: 'APP Code',
        description: 'App code',
        fields: {
          compose_file: 'not a valid json',
        },
        kind: 'app',
      },
    ]

    const masked = maskSensitiveDataObjects(dataObjects)

    expect(masked).toHaveLength(1)
    expect(masked[0]!.fields!.compose_file).toBe('not a valid json')
  })

  it('should handle compose_file without docker_compose_file field', () => {
    const composeFile = JSON.stringify({
      manifest_version: 1,
      name: 'simple-app',
      runner: 'docker',
    })

    const dataObjects: DataObject[] = [
      {
        id: 'app-code',
        name: 'APP Code',
        description: 'App code',
        fields: { compose_file: composeFile },
        kind: 'app',
      },
    ]

    const masked = maskSensitiveDataObjects(dataObjects)

    expect(masked).toHaveLength(1)
    const maskedComposeFile = JSON.parse(
      masked[0]!.fields!.compose_file as string,
    )
    expect(maskedComposeFile).toEqual({
      manifest_version: 1,
      name: 'simple-app',
      runner: 'docker',
    })
  })

  it('should not mutate original data objects', () => {
    const composeFile = JSON.stringify({
      docker_compose_file: 'original-content',
    })

    const dataObjects: DataObject[] = [
      {
        id: 'app-code',
        name: 'APP Code',
        description: 'App code',
        fields: { compose_file: composeFile },
        kind: 'app',
      },
    ]

    const originalComposeFile = dataObjects[0]!.fields!.compose_file

    maskSensitiveDataObjects(dataObjects)

    // Original should remain unchanged
    expect(dataObjects[0]!.fields!.compose_file).toBe(originalComposeFile)
    const originalParsed = JSON.parse(originalComposeFile as string)
    expect(originalParsed.docker_compose_file).toBe('original-content')
  })
})
