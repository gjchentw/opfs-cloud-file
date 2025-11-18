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
}

export interface OpfsCloudFileOptions {
  type: any,
  provider: { id?: string; instance?: BaseCloudProvider; config?: ProviderConfig };
  opfsPath?: string;
  pollingInterval?: number;
  useWorkerHash?: boolean;
}

export class OpfsCloudFile {
  constructor(options: OpfsCloudFileOptions);
  start(): Promise<void>;
  stop(): Promise<void>;
  sync(): Promise<void>;
  getLocalHash(): Promise<string | null>;
  getRemoteHash(): Promise<string | null>;
  downloadAndReplace(): Promise<string>;
  addEventListener(type: string, listener: (ev:any)=>void): void;
  removeEventListener(type: string, listener: (ev:any)=>void): void;
}

export const CLOUD_FILE_CHANGED: string;
export const OPFS_CLOUD_ERROR: string;

export class GoogleDriveV2Provider {
  constructor(config: { fileId: string; accessToken: string; pollIntervalMs?: number });
  supportsPolling(): boolean;
  poll(): Promise<boolean>;
  getFileMetadata(): Promise<any>;
  download(): Promise<ArrayBuffer>;
}

export class GoogleDriveV3Provider {
  constructor(config: { fileId: string; accessToken: string; pollIntervalMs?: number });
  supportsPolling(): boolean;
  poll(): Promise<boolean>;
  getFileMetadata(): Promise<any>;
  download(): Promise<ArrayBuffer>;
}
