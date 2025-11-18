import { BaseCloudProvider } from '../BaseCloudProvider.js';

export class GoogleDriveV3Provider extends BaseCloudProvider {
  constructor(config) {
    super(config);
    this.fileId = config.fileId;
    this.accessToken = config.accessToken;
    this.pollIntervalMs = config.pollIntervalMs || 8000;
    this._lastRemoteMD5 = null;
  }

  supportsPolling() { return true; }

  async getFileMetadata() {
    const url = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(this.fileId)}?fields=id,name,md5Checksum,modifiedTime`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${this.accessToken}` } });
    if (!res.ok) throw new Error('metadata fetch failed: ' + res.status);
    return await res.json();
  }

  async download() {
    const url = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(this.fileId)}?alt=media`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${this.accessToken}` } });
    if (!res.ok) throw new Error('download failed: ' + res.status);
    return await res.arrayBuffer();
  }

  async poll() {
    const meta = await this.getFileMetadata();
    const remoteMD5 = meta && meta.md5Checksum ? meta.md5Checksum : null;
    if (!this._lastRemoteMD5) {
      this._lastRemoteMD5 = remoteMD5;
      return false;
    }
    const changed = remoteMD5 !== this._lastRemoteMD5;
    this._lastRemoteMD5 = remoteMD5;
    return changed;
  }
}
