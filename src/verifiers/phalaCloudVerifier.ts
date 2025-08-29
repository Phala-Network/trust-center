import {AppDataObjectGenerator} from '../dataObjects/appDataObjectGenerator'
import {KeyProviderSchema, TcbInfoSchema, VmConfigSchema} from '../schemas'
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
import {Verifier} from '../verifier'

export class PhalaCloudVerifier extends Verifier {
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
}
