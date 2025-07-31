import type {AppInfo, AttestationBundle, QuoteAndEventLog} from './types'

export abstract class Verifier {
  // Get quote and event log from TDX
  protected abstract getQuote(): Promise<QuoteAndEventLog>

  // Get both TDX and Nvidia attestation
  protected abstract getAttestation(): Promise<AttestationBundle | null>

  // Get AppInfo defined in dstack-guest-agent
  // This needs to be acquired locally through http://${GUEST_AGENT_ADDR}/prpc/Info
  protected abstract getAppInfo(): Promise<AppInfo>

  // Verify TDX and Nvidia attestation signatures
  public abstract verifyHardware(): Promise<boolean>

  public abstract verifyOperatingSystem(): Promise<boolean>

  public abstract verifySourceCode(): Promise<boolean>

  public abstract getMetadata(): Promise<any>
}
