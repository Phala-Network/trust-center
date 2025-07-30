import {createPublicClient, http} from 'viem'
import {base} from 'viem/chains'
import {abi as appAbi} from './abi/DstackApp.json'
import {abi as kmsAbi} from './abi/DstackKms.json'

export abstract class DstackContract {
  protected client

  public address: `0x${string}`

  constructor(address: `0x${string}`) {
    this.address = address
    this.client = createPublicClient({
      chain: base,
      transport: http(),
    })
  }
}

export class DstackApp extends DstackContract {
  constructor(address: `0x${string}`) {
    super(address)
  }

  async isComposeHashRegistered(composeHash: string): Promise<boolean> {
    return (await this.client.readContract({
      address: this.address,
      abi: appAbi,
      functionName: 'allowedComposeHashes',
      args: [composeHash],
    })) as boolean
  }
}

export type KmsInfo = {
  k256Pubkey: `0x${string}`
  caPubkey: `0x${string}`
  quote: `0x${string}`
  eventlog: `0x${string}`
}

export class DstackKms extends DstackContract {
  constructor(address: `0x${string}`) {
    super(address)
  }

  async gatewayAppId(): Promise<string> {
    return (await this.client.readContract({
      address: this.address,
      abi: kmsAbi,
      functionName: 'gatewayAppId',
    })) as string
  }

  async kmsInfo(): Promise<KmsInfo> {
    const kmsInfo = await this.client.readContract({
      address: this.address,
      abi: kmsAbi,
      functionName: 'kmsInfo',
    })
    return {
      k256Pubkey: kmsInfo[0],
      caPubkey: kmsInfo[1],
      quote: kmsInfo[2],
      eventlog: kmsInfo[3],
    }
  }
}

console.log(
  await new DstackKms('0xbfD2d557118fc650EA25a0E7D85355d335f259D8').kmsInfo(),
)
