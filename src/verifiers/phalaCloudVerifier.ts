import { AppDataObjectGenerator } from '../dataObjects/appDataObjectGenerator'
import {
  KeyProviderSchema,
  SystemInfoSchema,
  TcbInfoSchema,
  VmConfigSchema,
} from '../schemas'
import {
  type AppInfo,
  type AppMetadata,
  type AttestationBundle,
  parseJsonFields,
  type QuoteData,
  type SystemInfo,
} from '../types'
import { DstackApp } from '../utils/dstackContract'
import {
  isUpToDate,
  verifyTeeQuote,
} from '../verification/hardwareVerification'
import {
  getImageFolder,
  verifyOSIntegrity,
} from '../verification/osVerification'
import { verifyComposeHash } from '../verification/sourceCodeVerification'
import { Verifier } from '../verifier'

export class PhalaCloudVerifier extends Verifier {
  public registrySmartContract: DstackApp
  private rpcEndpoint: string
  private dataObjectGenerator: AppDataObjectGenerator
  private appMetadata: AppMetadata

  constructor(
    contractAddress: `0x${string}`,
    domain: string,
    metadata: AppMetadata,
    chainId: number,
  ) {
    super(metadata, 'app')
    this.registrySmartContract = new DstackApp(contractAddress, chainId)
    this.appMetadata = metadata

    const cleanAddress = contractAddress.startsWith('0x')
      ? contractAddress.slice(2)
      : contractAddress
    this.rpcEndpoint = `https://${cleanAddress}-8090.${domain}`
    this.dataObjectGenerator = new AppDataObjectGenerator(metadata)
  }

  /**
   * Determines if an application has NVIDIA GPU support based on VM configuration
   */
  private hasNvidiaSupport(appInfo: AppInfo): boolean {
    return appInfo.vm_config.num_gpus > 0
  }

  protected async getQuote(): Promise<QuoteData> {
    try {
      const systemInfo = await PhalaCloudVerifier.getSystemInfo(
        this.registrySmartContract.address,
      )

      // Get the first instance's quote data
      if (systemInfo.instances.length === 0) {
        throw new Error('No instances found in Phala Cloud system info')
      }

      const instance = systemInfo.instances[0]
      if (!instance) {
        throw new Error(
          'First instance is undefined in Phala Cloud system info',
        )
      }

      return {
        quote: instance.quote,
        eventlog: instance.eventlog,
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Unknown error fetching quote from Phala Cloud API'
      throw new Error(`Failed to fetch Phala Cloud quote: ${errorMessage}`)
    }
  }

  protected async getAttestation(): Promise<AttestationBundle | null> {
    return null
  }

  protected async getAppInfo(): Promise<AppInfo> {
    const infoUrl = `${this.rpcEndpoint}/prpc/Info`
    try {
      const response = await fetch(infoUrl)
      if (!response.ok) {
        throw new Error(
          `Phala Cloud app info request failed: ${response.status} ${response.statusText} (URL: ${infoUrl})`,
        )
      }
      const responseData = await response.json()
      const appInfo = parseJsonFields(responseData as Record<string, unknown>, {
        tcb_info: TcbInfoSchema,
        key_provider_info: KeyProviderSchema,
        vm_config: VmConfigSchema,
      }) as AppInfo

      // Update metadata with NVIDIA support detection
      const nvidiaSupported = this.hasNvidiaSupport(appInfo)
      this.appMetadata = {
        ...this.appMetadata,
        hardware: {
          ...this.appMetadata.hardware,
          hasNvidiaSupport: nvidiaSupported,
        },
      }
      this.metadata = this.appMetadata

      // Update data object generator with fresh metadata
      this.dataObjectGenerator = new AppDataObjectGenerator(this.appMetadata)

      return appInfo
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : `Unknown error fetching app info from ${infoUrl}`
      throw new Error(`Failed to fetch Phala Cloud app info: ${errorMessage}`)
    }
  }

  /**
   * Static method to fetch system info from Phala Cloud API without instantiating the verifier
   */
  public static async getSystemInfo(
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

  public async verifyHardware(): Promise<boolean> {
    const quoteData = await this.getQuote()
    const verificationResult = await verifyTeeQuote(quoteData)

    // Generate DataObjects for Gateway hardware verification
    const dataObjects = this.dataObjectGenerator.generateHardwareDataObjects(
      quoteData,
      verificationResult,
    )
    dataObjects.forEach((obj) => {
      this.createDataObject(obj)
    })

    return isUpToDate(verificationResult)
  }

  public async verifyOperatingSystem(): Promise<boolean> {
    const appInfo = await this.getAppInfo()
    const imageFolderName = getImageFolder('app')

    const isValid = await verifyOSIntegrity(appInfo, imageFolderName)

    // Generate DataObjects for App OS verification
    const dataObjects = this.dataObjectGenerator.generateOSDataObjects(
      appInfo,
      false,
    )
    dataObjects.forEach((obj) => {
      this.createDataObject(obj)
    })

    return isValid
  }

  public async verifySourceCode(): Promise<boolean> {
    const appInfo = await this.getAppInfo()
    const quoteData = await this.getQuote()

    const { isValid, calculatedHash, isRegistered } = await verifyComposeHash(
      appInfo,
      quoteData,
      this.registrySmartContract,
    )

    // Generate DataObjects for App source code verification
    const dataObjects = this.dataObjectGenerator.generateSourceCodeDataObjects(
      appInfo,
      quoteData,
      calculatedHash,
      isRegistered ?? false,
      undefined,
      this.rpcEndpoint,
    )
    dataObjects.forEach((obj) => {
      this.createDataObject(obj)
    })

    return isValid
  }
}
