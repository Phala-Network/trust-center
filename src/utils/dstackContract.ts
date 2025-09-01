import {createPublicClient, http} from 'viem'
import type {Chain} from 'viem/chains'
import {base, mainnet} from 'viem/chains'
import {abi as appAbi} from './abi/DstackApp.json'
import {abi as kmsAbi} from './abi/DstackKms.json'

/**
 * Gets the appropriate chain configuration based on chain ID
 */
function getChainFromId(chainId: number): Chain {
  switch (chainId) {
    case 1:
      return mainnet
    case 8453:
      return base
    default:
      throw new Error(`Unsupported chain ID: ${chainId}`)
  }
}

/**
 * Abstract base class for DStack smart contract interactions.
 *
 * Provides common functionality for interacting with DStack contracts
 * deployed on various blockchains (Ethereum mainnet, Base).
 */
export abstract class DstackContract {
  /** viem public client for blockchain interactions */
  protected client

  /** Ethereum address of the smart contract */
  public address: `0x${string}`

  /**
   * Creates a new DStack contract instance.
   *
   * @param contractAddress - Ethereum address of the contract
   * @param chainId - Chain ID (1 for Ethereum mainnet, 8453 for Base)
   */
  constructor(contractAddress: `0x${string}`, chainId: number) {
    this.address = contractAddress
    this.client = createPublicClient({
      chain: getChainFromId(chainId),
      transport: http(),
    })
  }
}

/**
 * DStack App registry contract for managing application compose hashes.
 */
export class DstackApp extends DstackContract {
  /**
   * Checks if a compose hash is registered and allowed in the app registry.
   *
   * @param composeHashValue - The compose hash to check
   * @returns Promise resolving to true if the hash is registered
   */
  async isComposeHashRegistered(composeHashValue: string): Promise<boolean> {
    return (await this.client.readContract({
      address: this.address,
      abi: appAbi,
      functionName: 'allowedComposeHashes',
      args: [composeHashValue],
    })) as boolean
  }
}

/**
 * Information retrieved from the KMS registry contract.
 */
export interface KmsInfo {
  /** secp256k1 public key for cryptographic operations */
  k256Pubkey: `0x${string}`
  /** Certificate Authority public key */
  caPubkey: `0x${string}`
  /** TEE attestation quote as hex string */
  quote: `0x${string}`
  /** Event log data as hex string */
  eventlog: `0x${string}`
}

/**
 * DStack KMS registry contract for managing key management service data.
 */
export class DstackKms extends DstackContract {
  /**
   * Retrieves the Gateway application ID associated with this KMS.
   *
   * @returns Promise resolving to the Gateway app ID string
   */
  async gatewayAppId(): Promise<string> {
    return (await this.client.readContract({
      address: this.address,
      abi: kmsAbi,
      functionName: 'gatewayAppId',
    })) as string
  }

  /**
   * Retrieves comprehensive KMS information from the registry contract.
   *
   * @returns Promise resolving to KMS information including keys, quote, and event log
   */
  async kmsInfo(): Promise<KmsInfo> {
    const contractKmsInfo = (await this.client.readContract({
      address: this.address,
      abi: kmsAbi,
      functionName: 'kmsInfo',
    })) as [string, string, string, string]

    return {
      k256Pubkey: contractKmsInfo[0] as `0x${string}`,
      caPubkey: contractKmsInfo[1] as `0x${string}`,
      quote: contractKmsInfo[2] as `0x${string}`,
      eventlog: contractKmsInfo[3] as `0x${string}`,
    }
  }
}
