import {z} from 'zod'

import {AppDataObjectGenerator} from '../dataObjects/appDataObjectGenerator'
import {
  AppInfoSchema,
  BasicVmConfigSchema,
  EventLogSchema,
  KeyProviderSchema,
  LegacyTcbInfoSchema,
  NvidiaPayloadSchema,
  SystemInfoSchema,
  TcbInfoSchema,
  VmConfigSchema,
} from '../schemas'
import {
  type AppId,
  type AppInfo,
  type AttestationBundle,
  type CompleteAppMetadata,
  convertLegacyAppInfo,
  type LegacyAppInfo,
  parseAttestationBundle,
  parseJsonFields,
  type QuoteData,
  type SystemInfo,
  type VerificationFailure,
} from '../types'
import type {DataObjectCollector} from '../utils/dataObjectCollector'
import {DstackApp} from '../utils/dstackContract'
import {
  createImageVersion,
  createKmsVersion,
  supportsInfoRpcEndpoint,
  supportsOnchainKms,
} from '../utils/metadataUtils'
import {verifyEventLog} from '../verification/eventLogVerification'
import {isUpToDate, verifyTeeQuote} from '../verification/hardwareVerification'
import {
  verifyOSIntegrity,
  verifyOSIntegrityLegacy,
} from '../verification/osVerification'
import {verifyComposeHash} from '../verification/sourceCodeVerification'
import {Verifier} from '../verifier'

export class PhalaCloudVerifier extends Verifier {
  public registrySmartContract?: DstackApp
  public appId: AppId
  private rpcEndpoint: string
  private dataObjectGenerator: AppDataObjectGenerator
  private appMetadata: CompleteAppMetadata
  private systemInfo: SystemInfo
  private attestationBundle?: AttestationBundle

  // Cache for Redpill models
  private static modelCache: {models: any[]; timestamp: number} | null = null
  private static readonly CACHE_TTL = 5 * 60 * 1000 // 5 minutes

  constructor(
    systemInfo: SystemInfo,
    domain: string,
    metadata: CompleteAppMetadata,
    collector: DataObjectCollector,
  ) {
    super(metadata, 'app', collector)
    this.appId = systemInfo.app_id
    this.appMetadata = metadata
    this.systemInfo = systemInfo

    // Only create smart contract if governance is OnChain
    // Get contract_address from systemInfo instead of deriving it from appId
    if (metadata.governance?.type === 'OnChain') {
      const contractAddress = systemInfo.contract_address
      if (!contractAddress) {
        throw new Error('Contract address is required for OnChain governance')
      }
      this.registrySmartContract = new DstackApp(
        contractAddress,
        metadata.governance.chainId,
      )
    }

    this.rpcEndpoint = `https://${this.appId}-8090.${domain}`
    this.dataObjectGenerator = new AppDataObjectGenerator(metadata)
  }

  /**
   * Determines if an application has NVIDIA GPU support based on VM configuration
   */
  private hasNvidiaSupport(appInfo: AppInfo): boolean {
    return appInfo.vm_config && 'num_gpus' in appInfo.vm_config
      ? appInfo.vm_config.num_gpus > 0
      : false
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
    if (supportsInfoRpcEndpoint(this.systemInfo.kms_info.version)) {
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
            vm_config: z.union([VmConfigSchema, BasicVmConfigSchema]),
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
  public static async getSystemInfo(appId: AppId): Promise<SystemInfo> {
    const apiUrl = `https://cloud-api.phala.network/api/v1/apps/${appId}/attestations`

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
        kms_info: {
          ...parseResult.data.kms_info,
          version: createKmsVersion(parseResult.data.kms_info.version),
        },
        instances: validInstances.map((instance) => ({
          quote: instance.quote!.startsWith('0x')
            ? (instance.quote! as `0x${string}`)
            : (`0x${instance.quote!}` as `0x${string}`),
          eventlog: instance.eventlog!,
          image_version: createImageVersion(instance.image_version!),
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
   * Fetches the list of running models from Redpill API with caching
   */
  private static async getRunningModels(): Promise<any[]> {
    const now = Date.now()
    if (
      PhalaCloudVerifier.modelCache &&
      now - PhalaCloudVerifier.modelCache.timestamp <
        PhalaCloudVerifier.CACHE_TTL
    ) {
      return PhalaCloudVerifier.modelCache.models
    }

    try {
      const response = await fetch('https://api.redpill.ai/v1/models')
      if (!response.ok) {
        throw new Error(`Failed to fetch models: ${response.statusText}`)
      }
      const data = await response.json()
      // The API returns { data: [...] }
      const models = (data as any).data || []
      PhalaCloudVerifier.modelCache = {models, timestamp: now}
      return models
    } catch (error) {
      console.warn('Failed to fetch Redpill models:', error)
      return []
    }
  }

  public async verifyHardware(): Promise<{
    isValid: boolean
    failures: VerificationFailure[]
  }> {
    const quoteData = await this.getQuote()
    const verificationResult = await verifyTeeQuote(quoteData)
    const failures: VerificationFailure[] = []

    this.attestationBundle = undefined

    // Check for GPU support via Redpill API
    try {
      const models = await PhalaCloudVerifier.getRunningModels()
      const matchingModel = models.find(
        (m: any) => m.metadata?.appid === this.appId,
      )

      if (matchingModel) {
        const attestationUrl = `https://api.redpill.ai/v1/attestation/report?model=${matchingModel.id}`
        const response = await fetch(attestationUrl, {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer test`,
          },
        })

        if (response.ok) {
          const rawAppInfo = await response.json()
          this.attestationBundle = parseAttestationBundle(
            rawAppInfo as Record<string, unknown>,
            {
              nvidiaPayloadSchema: NvidiaPayloadSchema,
              eventLogSchema: EventLogSchema,
              appInfoSchema: AppInfoSchema,
            },
          )
        }
      }
    } catch (error) {
      console.warn(
        `Failed to fetch GPU attestation for app ${this.appId}:`,
        error,
      )
    }

    // Generate DataObjects for App hardware verification
    const dataObjects = this.dataObjectGenerator.generateHardwareDataObjects(
      quoteData,
      verificationResult,
      this.attestationBundle,
    )
    dataObjects.forEach((obj) => {
      this.createDataObject(obj)
    })

    // Check hardware verification result
    const isValid = isUpToDate(verificationResult)
    if (!isValid) {
      failures.push({
        componentId: 'app-main',
        error: `Hardware verification failed: TEE attestation status is '${verificationResult.status}' (expected 'UpToDate')`,
      })
    }

    // Verify Event Logs against RTMRs in the quote
    const {rt_mr0, rt_mr1, rt_mr2, rt_mr3} = verificationResult.report.TD10
    const eventLogVerification = verifyEventLog(quoteData.eventlog, {
      rtmr0: rt_mr0,
      rtmr1: rt_mr1,
      rtmr2: rt_mr2,
      rtmr3: rt_mr3,
    })

    if (!eventLogVerification.isValid) {
      eventLogVerification.failures.forEach((failure) => {
        failures.push({
          componentId: 'app-main',
          error: failure,
        })
      })
    }

    console.log('Event log replay results:', eventLogVerification)

    return {isValid, failures}
  }

  public async verifyOperatingSystem(): Promise<{
    isValid: boolean
    failures: VerificationFailure[]
  }> {
    const appInfo = await this.getAppInfo()
    const failures: VerificationFailure[] = []

    // Get image version from first instance
    const imageFolderName = this.systemInfo.instances[0]?.image_version
    if (!imageFolderName) {
      throw new Error('No image_version found in SystemInfo.instances[0]')
    }

    // Ensure image is downloaded
    const {ensureDstackImage} = await import('../utils/imageDownloader')
    await ensureDstackImage(imageFolderName)

    const isValid = supportsOnchainKms(this.systemInfo.kms_info.version)
      ? await verifyOSIntegrity(appInfo, imageFolderName)
      : await verifyOSIntegrityLegacy(appInfo, imageFolderName)

    // Generate DataObjects for App OS verification
    const dataObjects = this.dataObjectGenerator.generateOSDataObjects(
      appInfo,
      false,
    )
    dataObjects.forEach((obj) => {
      this.createDataObject(obj)
    })

    if (!isValid) {
      failures.push({
        componentId: 'app-main',
        error:
          'Operating system verification failed: Measurement registers (MRTD, RTMR0-2) do not match expected values',
      })
    }

    return {isValid, failures}
  }

  public async verifySourceCode(): Promise<{
    isValid: boolean
    failures: VerificationFailure[]
  }> {
    const appInfo = await this.getAppInfo()
    const quoteData = await this.getQuote()
    const failures: VerificationFailure[] = []

    const {isValid, calculatedHash, isRegistered} = await verifyComposeHash(
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
      this.attestationBundle,
      this.rpcEndpoint,
    )
    dataObjects.forEach((obj) => {
      this.createDataObject(obj)
    })

    if (!isValid) {
      if (this.registrySmartContract && !isRegistered) {
        failures.push({
          componentId: 'app-main',
          error:
            'Source code verification failed: Compose hash is not registered in the on-chain registry',
        })
      } else {
        failures.push({
          componentId: 'app-main',
          error:
            'Source code verification failed: Calculated compose hash does not match the hash in RTMR3 event log',
        })
      }
    }

    return {isValid, failures}
  }
}
