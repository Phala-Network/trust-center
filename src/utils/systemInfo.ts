/**
 * Utilities for fetching system information from different providers
 */

import {SystemInfoSchema} from '../schemas'
import type {EventLog, SystemInfo} from '../types'

/**
 * Fetch system info from Phala Cloud API
 */
export async function getPhalaCloudInfo(
  contractAddress: string,
): Promise<SystemInfo> {
  // Remove 0x prefix if present for the API call
  const cleanAppId = contractAddress.startsWith('0x')
    ? contractAddress.slice(2)
    : contractAddress

  const apiUrl = `https://cloud-api.phala.network/api/v1/apps/${cleanAppId}/attestations`

  try {
    const response = await fetch(apiUrl)
    if (!response.ok) {
      if (response.status === 500) {
        throw new Error(
          `App '${contractAddress}' not found or is currently down on Phala Cloud (URL: ${apiUrl})`,
        )
      }
      throw new Error(
        `Phala Cloud API request failed: ${response.status} ${response.statusText} (URL: ${apiUrl})`,
      )
    }

    const rawData = await response.json()
    if (typeof rawData !== 'object' || rawData === null) {
      throw new Error('Invalid response format from Phala Cloud API')
    }

    // Parse and validate the response using Zod schema
    const parseResult = SystemInfoSchema.safeParse(rawData)
    if (!parseResult.success) {
      throw new Error(
        `Failed to parse Phala Cloud response: ${parseResult.error.message}`,
      )
    }

    // Transform quotes to ensure they have 0x prefix
    const transformedData: SystemInfo = {
      ...parseResult.data,
      instances: parseResult.data.instances.map((instance) => ({
        ...instance,
        quote: instance.quote.startsWith('0x')
          ? (instance.quote as `0x${string}`)
          : (`0x${instance.quote}` as `0x${string}`),
      })),
    }

    return transformedData
  } catch (error) {
    const errorMessage =
      error instanceof Error
        ? error.message
        : `Unknown error fetching from Phala Cloud API (${apiUrl})`
    throw new Error(
      `Failed to fetch system info from Phala Cloud: ${errorMessage}`,
    )
  }
}

/**
 * Fetch system info from Redpill API
 */
export async function getRedpillInfo(
  contractAddress: string,
  model: string,
): Promise<SystemInfo> {
  const BASE_URL = 'https://api.redpill.ai/v1/attestation/report'
  const rpcEndpoint = `${BASE_URL}?model=${model}`

  try {
    const response = await fetch(rpcEndpoint, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer test`,
      },
    })

    if (!response.ok) {
      throw new Error(
        `Redpill API request failed for model '${model}': ${response.status} ${response.statusText} (URL: ${rpcEndpoint})`,
      )
    }

    // Get quote data from the response
    const quoteData = (await response.json()) as {
      quote: `0x${string}`
      eventlog: EventLog
    }

    const systemInfo: SystemInfo = {
      app_id: contractAddress.startsWith('0x')
        ? contractAddress.slice(2)
        : contractAddress,
      contract_address: contractAddress.startsWith('0x')
        ? (contractAddress as `0x${string}`)
        : (`0x${contractAddress}` as `0x${string}`),
      kms_info: {
        contract_address: '0xbfd2d557118fc650ea25a0e7d85355d335f259d8',
        chain_id: 8453,
        version: 'v0.5.3 (git:c06e524bd460fd9c9add)',
        url: '',
        gateway_app_id: '0x39F2f3373CEcFf85BD8BBd985adeeF32547a302c',
        gateway_app_url: 'https://gateway.llm-04.phala.network:9204',
      },
      instances: [
        {
          quote: quoteData.quote,
          eventlog: quoteData.eventlog,
          image_version: 'dstack-0.5.3',
        },
      ],
    }

    return systemInfo
  } catch (error) {
    const errorMessage =
      error instanceof Error
        ? error.message
        : `Unknown error fetching from Redpill API (${rpcEndpoint})`
    throw new Error(`Failed to fetch Redpill info: ${errorMessage}`)
  }
}
