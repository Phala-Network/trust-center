import { AppDataObjectGenerator } from '../dataObjects/appDataObjectGenerator'
import { AppInfoSchema, EventLogSchema, NvidiaPayloadSchema } from '../schemas'
import type {
  AppInfo,
  AttestationBundle,
  CompleteAppMetadata,
  EventLog,
  QuoteData,
  SystemInfo,
} from '../types'
import { parseAttestationBundle } from '../types'
import { DstackApp } from '../utils/dstackContract'
import {
  isUpToDate,
  verifyTeeQuote,
} from '../verification/hardwareVerification'
import { verifyOSIntegrity } from '../verification/osVerification'
import { verifyComposeHash } from '../verification/sourceCodeVerification'
import { Verifier } from '../verifier'

const BASE_URL = 'https://api.redpill.ai/v1/attestation/report'

export class RedpillVerifier extends Verifier {
  public registrySmartContract: DstackApp
  private rpcEndpoint: string
  private dataObjectGenerator: AppDataObjectGenerator

  constructor(
    contractAddress: `0x${string}`,
    model: string,
    metadata: CompleteAppMetadata,
  ) {
    if (!metadata.governance || metadata.governance.type !== 'OnChain') {
      throw new Error('RedpillVerifier requires governance to be onchain')
    }

    super(metadata, 'app')
    this.registrySmartContract = new DstackApp(
      contractAddress,
      metadata.governance.chainId,
    )
    this.rpcEndpoint = `${BASE_URL}?model=${model}`
    this.dataObjectGenerator = new AppDataObjectGenerator(metadata)
  }

  private async getAttestationBundle(): Promise<AttestationBundle> {
    try {
      const response = await fetch(this.rpcEndpoint, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer test`,
        },
      })

      if (!response.ok) {
        throw new Error(
          `Redpill attestation request failed: ${response.status} ${response.statusText} (URL: ${this.rpcEndpoint})`,
        )
      }

      const rawAppInfo = await response.json()
      if (typeof rawAppInfo !== 'object' || rawAppInfo === null) {
        throw new Error(
          `Invalid response format from Redpill API: expected object, got ${typeof rawAppInfo} (URL: ${this.rpcEndpoint})`,
        )
      }

      return parseAttestationBundle(rawAppInfo as Record<string, unknown>, {
        nvidiaPayloadSchema: NvidiaPayloadSchema,
        eventLogSchema: EventLogSchema,
        appInfoSchema: AppInfoSchema,
      })
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : `Unknown error fetching attestation bundle from ${this.rpcEndpoint}`
      throw new Error(
        `Failed to fetch Redpill attestation bundle: ${errorMessage}`,
      )
    }
  }

  protected async getQuote(): Promise<QuoteData> {
    const attestations = await this.getAttestationBundle()
    const quote = attestations.intel_quote.startsWith('0x')
      ? (attestations.intel_quote as `0x${string}`)
      : (`0x${attestations.intel_quote}` as `0x${string}`)

    return {
      quote: quote,
      eventlog: attestations.event_log,
    }
  }

  protected async getAttestation(): Promise<AttestationBundle | null> {
    return this.getAttestationBundle()
  }

  protected async getAppInfo(): Promise<AppInfo> {
    return (await this.getAttestationBundle()).info
  }

  /**
   * Static method to fetch system info from Redpill API without instantiating the verifier
   */
  public static async getSystemInfo(
    contractAddress: string,
    model: string,
  ): Promise<SystemInfo> {
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
            image_version: 'dstack-nvidia-0.5.3',
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

  public async verifyHardware(): Promise<boolean> {
    const quoteData = await this.getQuote()
    const attestationBundle = await this.getAttestationBundle()
    const verificationResult = await verifyTeeQuote(quoteData)

    // Generate DataObjects for App hardware verification
    const dataObjects = this.dataObjectGenerator.generateHardwareDataObjects(
      quoteData,
      verificationResult,
      attestationBundle,
    )
    dataObjects.forEach((obj) => {
      this.createDataObject(obj)
    })

    return isUpToDate(verificationResult)
  }

  public async verifyOperatingSystem(): Promise<boolean> {
    const appInfo = await this.getAppInfo()

    // Use hardcoded version for Redpill (as the version is consistent)
    const imageFolderName = 'dstack-nvidia-dev-0.5.3'

    // Ensure image is downloaded
    const { ensureDstackImage } = await import('../utils/imageDownloader')
    await ensureDstackImage(imageFolderName)

    const isValid = await verifyOSIntegrity(appInfo, imageFolderName)

    // Generate DataObjects for App OS verification
    const dataObjects = this.dataObjectGenerator.generateOSDataObjects(
      appInfo,
      true,
    )
    dataObjects.forEach((obj) => {
      this.createDataObject(obj)
    })

    return isValid
  }

  public async verifySourceCode(): Promise<boolean> {
    const attestationBundle = await this.getAttestationBundle()
    const quoteData = await this.getQuote()

    const { isValid, calculatedHash, isRegistered } = await verifyComposeHash(
      attestationBundle.info,
      quoteData,
      this.registrySmartContract,
    )

    // Generate DataObjects for App source code verification
    const dataObjects = this.dataObjectGenerator.generateSourceCodeDataObjects(
      attestationBundle.info,
      quoteData,
      calculatedHash,
      isRegistered ?? false,
      attestationBundle,
    )
    dataObjects.forEach((obj) => {
      this.createDataObject(obj)
    })

    return isValid
  }
}
