import {RedpillDataObjectGenerator} from './dataObjects/redpillDataObjectGenerator'
import {AppInfoSchema, EventLogSchema, NvidiaPayloadSchema} from './schemas'
import type {
  AppInfo,
  AttestationBundle,
  QuoteData,
  VerifierMetadata,
} from './types'
import {parseAttestationBundle} from './types'
import {DstackApp} from './utils/dstackContract'
import {isUpToDate, verifyTeeQuote} from './verification/hardwareVerification'
import {getImageFolder, verifyOSIntegrity} from './verification/osVerification'
import {verifyComposeHash} from './verification/sourceCodeVerification'
import {Verifier} from './verifier'

const BASE_URL = 'https://api.redpill.ai/v1/attestation/report'

export class RedpillVerifier extends Verifier {
  public registrySmartContract: DstackApp
  private appInfoUrl: string
  private dataObjectGenerator: RedpillDataObjectGenerator

  constructor(
    contractAddress: `0x${string}`,
    model: string,
    metadata: VerifierMetadata = {},
  ) {
    super(metadata, 'app')
    this.registrySmartContract = new DstackApp(contractAddress)
    this.appInfoUrl = `${BASE_URL}?model=${model}`
    this.dataObjectGenerator = new RedpillDataObjectGenerator(metadata)
  }

  private async getAttestationBundle(): Promise<AttestationBundle> {
    const response = await fetch(this.appInfoUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer test`,
      },
    })

    if (!response.ok) {
      throw new Error(
        `Failed to fetch app info: ${response.status} ${response.statusText}`,
      )
    }

    const rawAppInfo = await response.json()
    if (typeof rawAppInfo !== 'object' || rawAppInfo === null) {
      throw new Error('Invalid response format from API')
    }

    return parseAttestationBundle(rawAppInfo as Record<string, unknown>, {
      nvidiaPayloadSchema: NvidiaPayloadSchema,
      eventLogSchema: EventLogSchema,
      appInfoSchema: AppInfoSchema,
    })
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
    const attestationBundle = await this.getAttestationBundle()
    const quoteData = await this.getQuote()

    const {isValid, calculatedHash, isRegistered} = await verifyComposeHash(
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
    dataObjects.forEach((obj) => this.createDataObject(obj))

    return isValid
  }

  public async getMetadata(): Promise<Record<string, unknown>> {
    return {
      verifierType: 'App',
      contractAddress: this.registrySmartContract.address,
      appInfoUrl: this.appInfoUrl,
      supportedVerifications: ['hardware', 'sourceCode'],
      usesGpuAttestation: true,
    }
  }
}
