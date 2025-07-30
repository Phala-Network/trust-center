import { type QuoteAndEventLog, type AppInfo, type AttestationBundle } from './types';

export abstract class Verifiable {
  protected abstract getQuote(): Promise<QuoteAndEventLog>;

  protected abstract getAttestation(): Promise<AttestationBundle>;

  protected abstract getAppInfo(): Promise<AppInfo>;

  public abstract verifyHardware(): Promise<boolean>;

  public abstract verifyOperatingSystem(): Promise<boolean>;

  public abstract verifySourceCode(): Promise<boolean>;

  public abstract getMetadata(): Promise<any>;
}