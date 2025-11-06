// Calculation function documentation for verification process
// Each description explains the cryptographic operation or measurement process

export interface CalcFuncDocumentation {
  calcFunc: string
  description: string
}

export const calcFuncDocumentation: CalcFuncDocumentation[] = [
  // {
  //   calcFunc: 'replay_rtmr',
  //   description:
  //     'Replay RTMR (Runtime Measurement Register) calculation by processing event logs in sequence. This function takes event log entries and replays them in order to derive the final RTMR value, which is a cryptographic chain of measurements that ensures the integrity of the runtime environment. Each event extends the previous measurement using SHA-384 hash operations.',
  // },
  // {
  //   calcFunc: 'sha384',
  //   description:
  //     'SHA-384 cryptographic hash function. This function computes a 384-bit hash digest of the input data. In the context of TEE attestation, SHA-384 is used to measure various system components including BIOS, VM configuration, kernel, initrd, and rootfs. The resulting hash serves as a cryptographic fingerprint that can be compared against expected values to verify system integrity.',
  // },
  // {
  //   calcFunc: 'sha256',
  //   description:
  //     'SHA-256 cryptographic hash function. This function computes a 256-bit hash digest of the input data. It is commonly used for measuring application-specific components such as Docker Compose files and OVMF firmware. The compose-hash, which identifies the exact application configuration, is calculated using SHA-256 and stored in RTMR3 event logs.',
  // },
]

// Helper function to get calcFunc description
export function getCalcFuncDescription(calcFunc: string): string | null {
  const doc = calcFuncDocumentation.find((d) => d.calcFunc === calcFunc)
  return doc?.description ?? null
}
