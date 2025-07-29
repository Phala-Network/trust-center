import { createPublicClient, http } from 'viem'
import { base } from 'viem/chains'
import { abi } from './abi/DstackApp.json' // Import your contract ABI

const client = createPublicClient({
  chain: base,
  transport: http(),
})

async function isComposeHashRegistered(address: `0x${string}`, composeHash: string): Promise<boolean> {
  const result = await client.readContract({
    address,
    abi,
    functionName: 'allowedComposeHashes',
    args: [composeHash]
  }) as boolean;
  return result;
}
