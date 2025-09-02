import { AppDataObjectGenerator } from '../dataObjects/appDataObjectGenerator'
import { KeyProviderSchema, TcbInfoSchema, VmConfigSchema } from '../schemas'
import {
  type AppInfo,
  type AttestationBundle,
  parseJsonFields,
  type QuoteData,
  type VerifierMetadata,
} from '../types'
import { DstackApp } from '../utils/dstackContract'
import { getPhalaCloudInfo } from '../utils/systemInfo'
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

  constructor(
    contractAddress: `0x${string}`,
    domain: string,
    metadata: VerifierMetadata = {},
    chainId: number,
  ) {
    super(metadata, 'app')
    this.registrySmartContract = new DstackApp(contractAddress, chainId)
    const cleanAddress = contractAddress.startsWith('0x')
      ? contractAddress.slice(2)
      : contractAddress
    this.rpcEndpoint = `https://${cleanAddress}-8090.${domain}`
    this.dataObjectGenerator = new AppDataObjectGenerator(metadata)
  }

  protected async getQuote(): Promise<QuoteData> {
    try {
      const systemInfo = await getPhalaCloudInfo(
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
      return parseJsonFields(responseData as Record<string, unknown>, {
        tcb_info: TcbInfoSchema,
        key_provider_info: KeyProviderSchema,
        vm_config: VmConfigSchema,
      }) as AppInfo
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : `Unknown error fetching app info from ${infoUrl}`
      throw new Error(`Failed to fetch Phala Cloud app info: ${errorMessage}`)
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
      {} /* measurement result */,
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
    )
    dataObjects.forEach((obj) => {
      this.createDataObject(obj)
    })

    return isValid
  }
}
