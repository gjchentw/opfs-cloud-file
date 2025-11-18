import { SOURCE_FILE_CHANGED, OPFS_CLOUD_ERROR } from "./events.js";
import { readOpfsFile, writeOpfsFile } from "../utils/opfs.js";
import { md5FromArrayBuffer } from "../utils/md5.js";

export class OpfsCloudFile {
  constructor(options) {
    if (!options || !options.provider || !options.provider.instance) throw new Error('provider.instance required');
    this.provider = options.provider.instance;
    this.opfsPath = options.opfsPath || 'mirror.bin';
    this.pollingInterval = options.pollingInterval || (this.provider.pollIntervalMs || 8000);
    this._timer = null;
    this._listeners = new Map();
    this._lastLocalHash = null;
    this._lastRemoteHash = null;
    this._stopped = true;
  }

  addEventListener(type, cb) {
    if (!this._listeners.has(type)) this._listeners.set(type, []);
    this._listeners.get(type).push(cb);
  }
  removeEventListener(type, cb) {
    if (!this._listeners.has(type)) return;
    this._listeners.set(type, this._listeners.get(type).filter(f=>f!==cb));
  }
  _emit(type, detail) {
    const handlers = this._listeners.get(type) || [];
    for (const h of handlers) {
      try { h({ detail }); } catch(e){ console.error(e); }
    }
  }

  async _computeLocalHash() {
    try {
      const ab = await readOpfsFile(this.opfsPath);
      if (!ab) return null;
      return await md5FromArrayBuffer(ab);
    } catch (e) {
      return null;
    }
  }

  async sync() {
    try {
      const isChanged = await this.provider.poll();
      // provider.poll only indicates remote change; compute local hash and emit
      const localHash = await this._computeLocalHash();
      this._lastLocalHash = this._lastLocalHash || localHash;
      if (isChanged) {
        this._emit(SOURCE_FILE_CHANGED, { reason: 'remoteChanged', localHash });
      } else if (localHash !== this._lastLocalHash) {
        this._emit(SOURCE_FILE_CHANGED, { reason: 'localChanged', localHash });
      }
      this._lastLocalHash = localHash;
      return isChanged;
    } catch (err) {
      this._emit(OPFS_CLOUD_ERROR, { error: err });
      throw err;
    }
  }

  start() {
    if (!this.provider.supportsPolling()) return;
    if (this._timer) return;
    this._stopped = false;
    this._timer = setInterval(()=> {
      this.sync().catch(()=>{});
    }, this.pollingInterval);
    // initial sync
    this.sync().catch(()=>{});
  }

  stop() {
    if (this._timer) clearInterval(this._timer);
    this._timer = null;
    this._stopped = true;
    if (this.provider && typeof this.provider.dispose === 'function') this.provider.dispose().catch(()=>{});
  }

  async downloadAndReplace() {
    const data = await this.provider.download();
    await writeOpfsFile(this.opfsPath, data);
    this._lastLocalHash = await this._computeLocalHash();
    return this._lastLocalHash;
  }
}
