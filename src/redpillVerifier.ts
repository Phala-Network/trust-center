import {createHash} from 'node:crypto'
import * as path from 'node:path'
import type {
  AppInfo,
  AttestationBundle,
  QuoteAndEventLog,
  TcbInfo,
} from './types'
import {parseJsonFields} from './types'
import {verifyQuote} from './utils/dcap-qvl'
import {measureDstackImages} from './utils/dstack-mr'
import {DstackApp} from './utils/dstackContract'
import {calculate, getCollectedEvents, measure} from './utils/operations'
import {Verifier} from './verifier'

const BASE_URL = 'https://api.redpill.ai/v1/attestation/report'

export class RedpillVerifier extends Verifier {
  public registrySmartContract: DstackApp
  private appInfoUrl: string

  constructor(contractAddress: `0x${string}`, model: string) {
    super()
    this.registrySmartContract = new DstackApp(contractAddress)
    this.appInfoUrl = `${BASE_URL}?model=${model}`
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

    return parseJsonFields<AttestationBundle>(
      rawAppInfo as Record<string, unknown>,
      {
        nvidia_payload: true,
        event_log: true,
        info: true,
      },
    )
  }

  protected async getQuote(): Promise<QuoteAndEventLog> {
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
    const verificationResult = await verifyQuote(quoteData.quote, {hex: true})
    return verificationResult.status === 'UpToDate'
  }

  public async verifyOperatingSystem(): Promise<boolean> {
    const appInfo = await this.getAppInfo()

    const measurementResult = await measureDstackImages({
      image_folder: path.join(
        __dirname,
        '../external/dstack-images/dstack-nvidia-dev-0.5.3',
      ),
      vm_config: JSON.parse(appInfo.vm_config),
    })

    const expectedTcb = JSON.parse(appInfo.tcb_info) as TcbInfo
    return (
      measurementResult.mrtd === expectedTcb.mrtd &&
      measurementResult.rtmr0 === expectedTcb.rtmr0 &&
      measurementResult.rtmr1 === expectedTcb.rtmr1 &&
      measurementResult.rtmr2 === expectedTcb.rtmr2
    )
  }

  public async verifySourceCode(): Promise<boolean> {
    const appInfo = await this.getAppInfo()
    const quoteData = await this.getQuote()

    const tcbInfo = JSON.parse(appInfo.tcb_info) as TcbInfo
    const appComposeConfig = tcbInfo.app_compose
    const composeHashEvent = quoteData.eventlog.find(
      (entry) => entry.event === 'compose-hash',
    )

    if (!composeHashEvent) {
      return false
    }

    const isRegistered =
      await this.registrySmartContract.isComposeHashRegistered(
        `0x${composeHashEvent.event_payload}`,
      )

    const calculatedHash = calculate(
      'appInfo.tcb_info.app_compose',
      appComposeConfig,
      'compose_hash',
      'sha256',
      () => createHash('sha256').update(appComposeConfig).digest('hex'),
    )

    console.log(getCollectedEvents())

    return (
      isRegistered &&
      measure(
        composeHashEvent?.event_payload,
        calculatedHash,
        () => calculatedHash === composeHashEvent?.event_payload,
      )
    )
  }

  public async getMetadata(): Promise<Record<string, unknown>> {
    return {
      verifierType: 'App',
      contractAddress: this.registrySmartContract.address,
      appInfoUrl: this.appInfoUrl,
      supportedVerifications: ['hardware', 'sourceCode'],
      usesGpuAttestation: false,
    }
  }
}
