import { BaseCloudProvider } from '../BaseCloudProvider.js';
import { md5FromArrayBuffer } from '../../utils/md5.js';

const GOOGLE_APPS_TYPE_NAMES = {
  'application/vnd.google-apps.document': 'Google Docs',
  'application/vnd.google-apps.spreadsheet': 'Google Sheets',
  'application/vnd.google-apps.presentation': 'Google Slides',
  'application/vnd.google-apps.drawing': 'Google Drawings',
  'application/vnd.google-apps.form': 'Google Forms',
  'application/vnd.google-apps.script': 'Google Apps Script',
  'application/vnd.google-apps.site': 'Google Sites',
  'application/vnd.google-apps.map': 'Google My Maps',
};

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
      const typeName = GOOGLE_APPS_TYPE_NAMES[this._meta.mimeType] || 'Google Apps';
      throw new Error(
        `Cannot download this file: it is a ${typeName} file (${this._meta.mimeType}), ` +
        'which is not downloadable as binary content. ' +
        'Use the Google Drive web interface to export it to a standard format.'
      );
    }

    const url = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(this.fileId)}?alt=media`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${this.accessToken}` } });
    if (!res.ok) throw new Error('download failed: ' + res.status);
    return await res.arrayBuffer();
  }

  async upload(data) {
    const url = `https://www.googleapis.com/upload/drive/v3/files/${encodeURIComponent(this.fileId)}?uploadType=media`;
    const res = await fetch(url, {
      method: 'PATCH',
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

  async getRemoteModifiedTime() {
    if (!this._meta || !this._meta.modifiedTime) return null;
    const ts = Date.parse(this._meta.modifiedTime);
    return Number.isNaN(ts) ? null : ts;
  }

  async checksum(data) {
    try {
      return await md5FromArrayBuffer(data);
    } catch (e) {
      return null;
    }
  }
}
