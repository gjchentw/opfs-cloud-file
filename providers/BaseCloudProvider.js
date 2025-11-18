export class BaseCloudProvider {
  constructor(config) { this._config = config || {}; }
  supportsPolling() { return false; }
  async poll() { throw new Error('poll not implemented'); }
  async download() { throw new Error('download not implemented'); }
  async dispose() {}
}
