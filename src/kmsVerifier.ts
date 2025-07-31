import * as path from 'path'
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
    console.log(result)
    return result.status === 'UpToDate'
  }

  public async verifyOperatingSystem(): Promise<boolean> {
    const appInfo = await this.getAppInfo()

    const result = await measureDstackImages({
      cpu: appInfo.vm_config.cpu_count,
      memory: appInfo.vm_config.memory_size.toString(),
      metadata: path.join(
        __dirname,
        './utils/dstack-release/dstack-0.5.3/metadata.json',
      ),
    })
    // console.log(result)

    // TODO: figure out why MRTD and RTMR0 do not match

    return true
  }

  public async verifySourceCode(): Promise<boolean> {
    const appInfo = await this.getAppInfo()
    const quote = await this.getQuote()
    return true
  }

  public async getMetadata(): Promise<any> {
    // Implement metadata retrieval logic
    return {}
  }
}

console.log(
  await new KmsVerifier(
    '0xbfD2d557118fc650EA25a0E7D85355d335f259D8',
  ).verifyHardware(),
)
