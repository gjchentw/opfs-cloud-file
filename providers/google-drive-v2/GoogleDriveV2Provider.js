import { BaseCloudProvider } from '../BaseCloudProvider.js';
import { md5FromArrayBuffer } from '../../utils/md5.js';


export class GoogleDriveV2Provider extends BaseCloudProvider {
  constructor(config) {
    super(config);
    this.fileId = config.fileId;
    this.accessToken = config.accessToken;
    if (!this.fileId || !this.accessToken) throw new Error('fileId and accessToken required for Google Drive v2');
    this.pollIntervalMs = config.pollIntervalMs || 8000;
    this._lastRemoteMD5 = null;
    this._meta = null;
  }

  supportsPolling() { return true; }

  async getFileMetadata() {
    const url = `https://www.googleapis.com/drive/v2/files/${encodeURIComponent(this.fileId)}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${this.accessToken}` } });
    if (!res.ok) throw new Error('metadata fetch failed: ' + res.status);
    this._meta = await res.json();
    return this._meta;
  }

  async getFileName() {
    const meta = await this.getFileMetadata();
    return meta && meta.title ? meta.title : null;
  }

  async download() {
    if (this._meta.mimeType.startsWith('application/vnd.google-apps')) {
      throw new Error('not a downloadable file');
    }

    const url = `https://www.googleapis.com/drive/v2/files/${encodeURIComponent(this.fileId)}?alt=media`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${this.accessToken}` } });
    if (!res.ok) throw new Error('download failed: ' + res.status);
    return await res.arrayBuffer();
  }

  async upload(data) {
    const url = `https://www.googleapis.com/upload/drive/v2/files/${encodeURIComponent(this.fileId)}?uploadType=media`;
    const res = await fetch(url, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': this._meta.mimeType || 'application/octet-stream'
      },
      body: data
    });

    if (!res.ok) throw new Error('upload failed: ' + res.status);

    this._meta = await res.json();
    this._lastRemoteMD5 = this._meta.md5Checksum;
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

  async getRemoteFileChecksum() {
    return this._lastRemoteMD5;
  }

  async checksum(data) {
    try {
      return await md5FromArrayBuffer(data);
    } catch (e) {
      return null;
    }
  }
}

