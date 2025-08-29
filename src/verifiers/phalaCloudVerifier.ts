import {AppDataObjectGenerator} from '../dataObjects/appDataObjectGenerator'
import {
  DstackInfoSchema,
  KeyProviderSchema,
  TcbInfoSchema,
  VmConfigSchema,
} from '../schemas'
import type {DstackInfo} from '../types'
import {
  type AppInfo,
  type AttestationBundle,
  parseJsonFields,
  type QuoteData,
  type VerifierMetadata,
} from '../types'
import {DstackApp} from '../utils/dstackContract'
import {isUpToDate, verifyTeeQuote} from '../verification/hardwareVerification'
import {getImageFolder, verifyOSIntegrity} from '../verification/osVerification'
import {verifyComposeHash} from '../verification/sourceCodeVerification'
import type {DstackInfoProvider} from '../verifier'
import {Verifier} from '../verifier'

export class PhalaCloudVerifier extends Verifier implements DstackInfoProvider {
  public registrySmartContract: DstackApp
  private rpcEndpoint: string
  private dataObjectGenerator: AppDataObjectGenerator

  constructor(
    contractAddress: `0x${string}`,
    domain: string,
    metadata: VerifierMetadata = {},
    chainId: number,
  ) {
    super(metadata, 'app')
    this.registrySmartContract = new DstackApp(contractAddress, chainId)
    this.rpcEndpoint = `https://${contractAddress}-8090.${domain}`
    this.dataObjectGenerator = new AppDataObjectGenerator(metadata)
  }

  protected async getQuote(): Promise<QuoteData> {
    const response = await fetch(`${this.rpcEndpoint}/prpc/Quote`)
    if (!response.ok) {
      throw new Error(
        `Failed to fetch Gateway app info: ${response.status} ${response.statusText}`,
      )
    }
    const responseData = await response.json()

    return responseData as QuoteData
  }

  protected async getAttestation(): Promise<AttestationBundle | null> {
    return null
  }

  protected async getAppInfo(): Promise<AppInfo> {
    const response = await fetch(`${this.rpcEndpoint}/prpc/Info`)
    if (!response.ok) {
      throw new Error(
        `Failed to fetch app info: ${response.status} ${response.statusText}`,
      )
    }
    const responseData = await response.json()
    return parseJsonFields(responseData as Record<string, unknown>, {
      tcb_info: TcbInfoSchema,
      key_provider_info: KeyProviderSchema,
      vm_config: VmConfigSchema,
    }) as AppInfo
  }

  public async verifyHardware(): Promise<boolean> {
    const quoteData = await this.getQuote()
    const verificationResult = await verifyTeeQuote(quoteData)

    // Generate DataObjects for Gateway hardware verification
    const dataObjects = this.dataObjectGenerator.generateHardwareDataObjects(
      quoteData,
      verificationResult,
    )
    dataObjects.forEach((obj) => this.createDataObject(obj))

    return isUpToDate(verificationResult)
  }

  public async verifyOperatingSystem(): Promise<boolean> {
    const appInfo = await this.getAppInfo()
    const imageFolderName = getImageFolder('app')

    const isValid = await verifyOSIntegrity(appInfo, imageFolderName)

    // Generate DataObjects for App OS verification
    const dataObjects = this.dataObjectGenerator.generateOSDataObjects(
      appInfo,
      {} /* measurement result */,
    )
    dataObjects.forEach((obj) => this.createDataObject(obj))

    return isValid
  }

  public async verifySourceCode(): Promise<boolean> {
    const appInfo = await this.getAppInfo()
    const quoteData = await this.getQuote()

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
    )
    dataObjects.forEach((obj) => this.createDataObject(obj))

    return isValid
  }

  public async getDstackInfo(appId: string): Promise<DstackInfo> {
    // Remove 0x prefix if present for the API call
    const cleanAppId = appId.startsWith('0x') ? appId.slice(2) : appId

    const apiUrl = `https://cloud-api.phala.network/api/v1/apps/${cleanAppId}/attestations`

    const response = await fetch(apiUrl)
    if (!response.ok) {
      if (response.status === 500) {
        throw new Error(
          `App '${appId}' not found or is currently down on Phala Cloud`,
        )
      }
      throw new Error(
        `Failed to fetch DStack info from Phala Cloud: ${response.status} ${response.statusText}`,
      )
    }

    const rawData = await response.json()
    if (typeof rawData !== 'object' || rawData === null) {
      throw new Error('Invalid response format from Phala Cloud API')
    }

    // Parse and validate the response using Zod schema
    const parseResult = DstackInfoSchema.safeParse(rawData)
    if (!parseResult.success) {
      throw new Error(
        `Failed to parse Phala Cloud response: ${parseResult.error.message}`,
      )
    }

    // Transform quotes to ensure they have 0x prefix
    const transformedData: DstackInfo = {
      ...parseResult.data,
      instances: parseResult.data.instances.map((instance) => ({
        ...instance,
        quote: instance.quote.startsWith('0x')
          ? (instance.quote as `0x${string}`)
          : (`0x${instance.quote}` as `0x${string}`),
      })),
    }

    return transformedData
  }
}
