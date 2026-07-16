export type ProviderConfig = { [key: string]: any };

export interface BaseCloudProvider {
  constructor(config: ProviderConfig): any;
  supportsPolling(): boolean;
  /**
   * Check for changes. Return true if changed, false otherwise.
   */
  poll(): Promise<boolean>;
  // optional: download/upload
  download?(): Promise<Blob | ArrayBuffer>;
  upload?(data: Blob | ArrayBuffer): Promise<void>;
  dispose?(): Promise<void>;
  /**
   * Optional: remote file modification timestamp (ms since epoch) from metadata.
   * Used for conflict resolution; return null when unavailable.
   */
  getRemoteModifiedTime?(): Promise<number | null>;
}

export interface OpfsCloudFileOptions {
  type: any,
  provider: { id?: string; instance?: BaseCloudProvider; config?: ProviderConfig };
  opfsPath?: string;
  pollingInterval?: number;
  useWorkerHash?: boolean;
  /** Maximum number of retry attempts for transient errors (default: 3) */
  maxRetries?: number;
  /** Base delay between retries in milliseconds (default: 1000) */
  retryDelayMs?: number;
  /** Multiplier for exponential backoff (default: 2) */
  backoffMultiplier?: number;
  /**
   * Custom list of retryable errors: HTTP status codes and/or the string
   * 'network' for network-level errors. Default: network errors, 429, 500-599.
   */
  retryableErrors?: Array<number | 'network'> | null;
}

export class OpfsCloudFile {
  constructor(options: OpfsCloudFileOptions);
  start(): void;
  stop(): void;
  sync(): Promise<void>;
  /** Explicitly close all tracked OPFS access handles. */
  cleanup(): void;
  downloadAndReplace(): Promise<string | null>;
  addEventListener(type: string, listener: (ev:any)=>void): void;
  removeEventListener(type: string, listener: (ev:any)=>void): void;
}

export declare const events: {
  LOCAL_FILE_CHANGED: string;
  CLOUD_FILE_CHANGED: string;
  OPFS_CLOUD_ERROR: string;
  CONFLICT_DETECTED: string;
};

export class GoogleDriveV2Provider {
  constructor(config: { fileId: string; accessToken: string; pollIntervalMs?: number });
  supportsPolling(): boolean;
  poll(): Promise<boolean>;
  getFileMetadata(): Promise<any>;
  download(): Promise<ArrayBuffer>;
  getRemoteModifiedTime(): Promise<number | null>;
}

export class GoogleDriveV3Provider {
  constructor(config: { fileId: string; accessToken: string; pollIntervalMs?: number });
  supportsPolling(): boolean;
  poll(): Promise<boolean>;
  getFileMetadata(): Promise<any>;
  download(): Promise<ArrayBuffer>;
  getRemoteModifiedTime(): Promise<number | null>;
}
