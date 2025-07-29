import { createPublicClient, http } from 'viem'
import { base } from 'viem/chains'
import { abi } from './abi/DstackKms.json' // Import your contract ABI

type KmsInfo = {
  k256Pubkey: string
  caPubkey: string
  quote: string
  eventlog: string
}

const client = createPublicClient({
  chain: base,
  transport: http(),
})

async function gatewayAppId(address: `0x${string}`): Promise<string> {
  const result = await client.readContract({
    address,
    abi,
    functionName: 'gatewayAppId'
  }) as string;
  return result;
}

async function kmsInfo(address: `0x${string}`): Promise<KmsInfo> {
  const result = await client.readContract({
    address,
    abi,
    functionName: 'kmsInfo'
  }) as KmsInfo;
  return result;
}

async function isAppRegistered(address: `0x${string}`, app_id: string): Promise<boolean> {
  const result = await client.readContract({
    address,
    abi,
    functionName: 'registeredApps',
    args: [app_id],
  }) as boolean;
  return result;
}
