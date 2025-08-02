import {createHash} from 'node:crypto'
import path from 'node:path'
import {DeepseekKmsInfo} from './consts'
import {
  type AppInfo,
  type AttestationBundle,
  parseJsonFields,
  type QuoteAndEventLog,
} from './types'
import {verifyQuote} from './utils/dcap-qvl'
import {measureDstackImages} from './utils/dstack-mr'
import {DstackKms} from './utils/dstackContract'
import {calculate, getCollectedEvents, measure} from './utils/operations'
import {Verifier} from './verifier'

export class KmsVerifier extends Verifier {
  public registrySmartContract: DstackKms
  public caPubkey: `0x${string}` = '0x'

  constructor(contractAddress: `0x${string}`) {
    super()

    this.registrySmartContract = new DstackKms(contractAddress)
  }

  protected async getQuote(): Promise<QuoteAndEventLog> {
    // the quote and event log of KMS are published on the smart contract
    const kmsInfo = await this.registrySmartContract.kmsInfo()
    const rawEventlog = Buffer.from(
      kmsInfo.eventlog.replace('0x', ''),
      'hex',
    ).toString('utf8')

    this.caPubkey = kmsInfo.caPubkey

    return {quote: kmsInfo.quote, eventlog: JSON.parse(rawEventlog)}
  }

  protected async getAttestation(): Promise<AttestationBundle | null> {
    // KMS does not use GPU
    return null
  }

  protected async getAppInfo(): Promise<AppInfo> {
    const rawAppInfo = DeepseekKmsInfo

    return parseJsonFields<AppInfo>(rawAppInfo, {
      tcb_info: true,
      key_provider_info: true,
      vm_config: true,
    })
  }

  public async verifyHardware(): Promise<boolean> {
    const quote = await this.getQuote()
    const result = await verifyQuote(quote.quote, {hex: true})
    return result.status === 'UpToDate'
  }

  public async verifyOperatingSystem(): Promise<boolean> {
    const appInfo = await this.getAppInfo()

    const result = await measureDstackImages({
      image_folder: path.join(
        __dirname,
        '../external/dstack-images/dstack-0.5.3',
      ),
      vm_config: appInfo.vm_config,
    })

    return (
      result.mrtd === appInfo.tcb_info.mrtd &&
      result.rtmr0 === appInfo.tcb_info.rtmr0 &&
      result.rtmr1 === appInfo.tcb_info.rtmr1 &&
      result.rtmr2 === appInfo.tcb_info.rtmr2
    )
  }

  public async verifySourceCode(): Promise<boolean> {
    const appInfo = await this.getAppInfo()
    const quote = await this.getQuote()

    const appCompose = appInfo.tcb_info.app_compose
    const appComposeEvent = quote.eventlog.find(
      (value) => value.event === 'compose-hash',
    )

    const hash = calculate(
      'appInfo.tcb_info.app_compose',
      appCompose,
      'compose_hash',
      'sha256',
      () => createHash('sha256').update(appCompose).digest('hex'),
    )

    console.log(getCollectedEvents())

    return measure(
      appComposeEvent?.event_payload,
      hash,
      () => hash === appComposeEvent?.event_payload,
    )
  }

  public async getMetadata(): Promise<any> {
    // Implement metadata retrieval logic
    return {}
  }
}
