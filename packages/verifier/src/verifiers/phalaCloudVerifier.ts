import { AppDataObjectGenerator } from '../dataObjects/appDataObjectGenerator'
import {
  KeyProviderSchema,
  LegacyTcbInfoSchema,
  SystemInfoSchema,
  TcbInfoSchema,
  VmConfigSchema,
} from '../schemas'
import {
  type AppInfo,
  type AttestationBundle,
  type CompleteAppMetadata,
  convertLegacyAppInfo,
  type LegacyAppInfo,
  parseJsonFields,
  type QuoteData,
  type SystemInfo,
} from '../types'
import { DstackApp } from '../utils/dstackContract'
import { isLegacyVersion } from '../utils/metadataUtils'
import {
  isUpToDate,
  verifyTeeQuote,
} from '../verification/hardwareVerification'
import {
  verifyOSIntegrity,
  verifyOSIntegrityLegacy,
} from '../verification/osVerification'
import { verifyComposeHash } from '../verification/sourceCodeVerification'
import { Verifier } from '../verifier'

export class PhalaCloudVerifier extends Verifier {
  public registrySmartContract?: DstackApp
  public appId: string
  private rpcEndpoint: string
  private dataObjectGenerator: AppDataObjectGenerator
  private appMetadata: CompleteAppMetadata
  private systemInfo: SystemInfo

  constructor(
    contractAddress: `0x${string}`,
    domain: string,
    metadata: CompleteAppMetadata,
    systemInfo: SystemInfo,
  ) {
    super(metadata, 'app')
    // Only create smart contract if governance is OnChain
    if (metadata.governance?.type === 'OnChain') {
      this.registrySmartContract = new DstackApp(
        contractAddress,
        metadata.governance.chainId,
      )
    }
    this.appMetadata = metadata
    this.systemInfo = systemInfo

    this.appId = contractAddress.startsWith('0x')
      ? contractAddress.slice(2)
      : contractAddress
    this.rpcEndpoint = `https://${this.appId}-8090.${domain}`
    this.dataObjectGenerator = new AppDataObjectGenerator(metadata)
  }

  /**
   * Determines if an application has NVIDIA GPU support based on VM configuration
   */
  private hasNvidiaSupport(appInfo: AppInfo): boolean {
    return appInfo.vm_config ? appInfo.vm_config.num_gpus > 0 : false
  }

  protected async getQuote(): Promise<QuoteData> {
    try {
      const systemInfo = await PhalaCloudVerifier.getSystemInfo(this.appId)

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
    if (!isLegacyVersion(this.systemInfo.kms_info.version)) {
      const infoUrl = `${this.rpcEndpoint}/prpc/Info`
      try {
        const response = await fetch(infoUrl)
        if (!response.ok) {
          throw new Error(
            `Phala Cloud app info request failed: ${response.status} ${response.statusText} (URL: ${infoUrl})`,
          )
        }
        const responseData = await response.json()
        const appInfo = parseJsonFields(
          responseData as Record<string, unknown>,
          {
            tcb_info: TcbInfoSchema,
            key_provider_info: KeyProviderSchema,
            vm_config: VmConfigSchema,
          },
        ) as AppInfo

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
    } else {
      const infoUrl = `${this.rpcEndpoint}/prpc/Worker.Info`
      try {
        const response = await fetch(infoUrl)
        if (!response.ok) {
          throw new Error(
            `Phala Cloud app info request failed: ${response.status} ${response.statusText} (URL: ${infoUrl})`,
          )
        }
        const responseData = await response.json()

        const legacyAppInfo = parseJsonFields(
          responseData as Record<string, unknown>,
          {
            tcb_info: LegacyTcbInfoSchema,
          },
        ) as LegacyAppInfo

        // Convert legacy format to standard AppInfo format
        const appInfo = convertLegacyAppInfo(legacyAppInfo)

        this.appMetadata = {
          ...this.appMetadata,
          hardware: {
            ...this.appMetadata.hardware,
            hasNvidiaSupport: false,
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
  }

  /**
   * Static method to fetch system info from Phala Cloud API without instantiating the verifier
   */
  public static async getSystemInfo(appId: string): Promise<SystemInfo> {
    // Remove 0x prefix if present for the API call
    const cleanAppId = appId.startsWith('0x') ? appId.slice(2) : appId

    const apiUrl = `https://cloud-api.phala.network/api/v1/apps/${cleanAppId}/attestations`

    try {
      const response = await fetch(apiUrl)
      if (!response.ok) {
        if (response.status === 500) {
          throw new Error(
            `App '${appId}' not found or is currently down on Phala Cloud (URL: ${apiUrl})`,
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

      // Filter out invalid instances (empty objects when instance is turned off)
      const validInstances = parseResult.data.instances.filter(
        (instance) =>
          instance.quote !== undefined &&
          instance.eventlog !== undefined &&
          instance.image_version !== undefined,
      )

      // Check if instances list is empty (instance is turned off)
      if (validInstances.length === 0) {
        throw new Error(
          `App '${appId}' has no running instances on Phala Cloud`,
        )
      }

      // Transform quotes to ensure they have 0x prefix
      const transformedData: SystemInfo = {
        ...parseResult.data,
        instances: validInstances.map((instance) => ({
          quote: instance.quote!.startsWith('0x')
            ? (instance.quote! as `0x${string}`)
            : (`0x${instance.quote!}` as `0x${string}`),
          eventlog: instance.eventlog!,
          image_version: instance.image_version!,
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

    // Get image version from first instance
    const imageFolderName = this.systemInfo.instances[0]?.image_version
    if (!imageFolderName) {
      throw new Error('No image_version found in SystemInfo.instances[0]')
    }

    // Ensure image is downloaded
    const { ensureDstackImage } = await import('../utils/imageDownloader')
    await ensureDstackImage(imageFolderName)

    const isValid = isLegacyVersion(this.systemInfo.kms_info.version)
      ? await verifyOSIntegrityLegacy(appInfo, imageFolderName)
      : await verifyOSIntegrity(appInfo, imageFolderName)

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
