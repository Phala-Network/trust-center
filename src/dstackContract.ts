
import { createPublicClient, http } from 'viem';
import { base } from 'viem/chains';
import { abi as appAbi } from './abi/DstackApp.json';
import { abi as kmsAbi } from './abi/DstackKms.json';

export abstract class DstackContract {
  protected client;
  protected address: `0x${string}`;

  constructor(address: `0x${string}`) {
    this.address = address;
    this.client = createPublicClient({
      chain: base,
      transport: http(),
    });
  }
}

export class DstackApp extends DstackContract {
  constructor(address: `0x${string}`) {
    super(address);
  }

  async isComposeHashRegistered(composeHash: string): Promise<boolean> {
    return await this.client.readContract({
      address: this.address,
      abi: appAbi,
      functionName: 'allowedComposeHashes',
      args: [composeHash],
    }) as boolean;
  }
}

export type KmsInfo = {
  k256Pubkey: string;
  caPubkey: string;
  quote: string;
  eventlog: string;
};

export class DstackKms extends DstackContract {
  constructor(address: `0x${string}`) {
    super(address);
  }

  async gatewayAppId(): Promise<string> {
    return await this.client.readContract({
      address: this.address,
      abi: kmsAbi,
      functionName: 'gatewayAppId',
    }) as string;
  }

  async kmsInfo(): Promise<KmsInfo> {
    return await this.client.readContract({
      address: this.address,
      abi: kmsAbi,
      functionName: 'kmsInfo',
    }) as KmsInfo;
  }
}
