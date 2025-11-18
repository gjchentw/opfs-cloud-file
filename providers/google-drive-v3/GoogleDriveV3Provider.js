import { BaseCloudProvider } from '../BaseCloudProvider.js';
import { md5FromArrayBuffer } from '../../utils/md5.js';

export class GoogleDriveV3Provider extends BaseCloudProvider {
  constructor(config) {
    super(config);
    this.fileId = config.fileId;
    this.accessToken = config.accessToken;
    if (!this.fileId || !this.accessToken) throw new Error('fileId and accessToken required for Google Drive v3');
    this.pollIntervalMs = config.pollIntervalMs || 8000;
    this._lastRemoteMD5 = null;
    this._meta = null;
  }

  supportsPolling() { return true; }

  async getFileMetadata() {
    const url = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(this.fileId)}?fields=id,name,md5Checksum,modifiedTime,mimeType`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${this.accessToken}` } });
    if (!res.ok) throw new Error('metadata fetch failed: ' + res.status);
    this._meta = await res.json();
    return this._meta;
  }

  async getFileName() {
    const meta = await this.getFileMetadata();
    return meta && meta.name ? meta.name : null;
  }

  async download() {
    if (this._meta.mimeType.startsWith('application/vnd.google-apps')) {
      throw new Error('not a downloadable file');
    }

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

  async checksum(data) {
    try {
      return await md5FromArrayBuffer(data);
    } catch (e) {
      return null;
    }
  }
}
