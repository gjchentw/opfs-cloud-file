export class BaseCloudProvider {
  constructor(config) { this._config = config || {}; }
  supportsPolling() { return false; }
  async getFileName() { throw new Error('getFileName not implemented'); }
  async poll() { throw new Error('poll not implemented'); }
  async checksum(data) { throw new Error('checksum not implemented'); }
  async upload(data) { throw new Error('upload not implemented'); }
  async download() { throw new Error('download not implemented'); }
  async getRemoteFileChecksum() { throw new Error('getRemoteFileChecksum not implemented'); }
  async checksum() { throw new Error('download not implemented'); }
  async dispose() { }
}
