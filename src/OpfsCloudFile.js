import { CLOUD_FILE_CHANGED, OPFS_CLOUD_ERROR } from "./events.js";
import { readOpfsFile, writeOpfsFile } from "../utils/opfs.js";
import { md5FromArrayBuffer } from "../utils/md5.js";
import { GoogleDriveV2Provider } from "../providers/google-drive-v2/GoogleDriveV2Provider.js";
import { GoogleDriveV3Provider } from "../providers/google-drive-v3/GoogleDriveV3Provider.js";

export class OpfsCloudFile {
  constructor(options) {
    if (!options || !options.provider || (!options.provider.instance && !options.type) ) throw new Error('provider.instance required');

    if (options.provider.instance) {
      this.provider = options.provider.instance;
    }
    else if (options.type == 'google-drive-v2') {
      this.provider = new GoogleDriveV2Provider(options.provider.config);
    }
    else if (options.type == 'google-drive-v3') {
      this.provider = new GoogleDriveV3Provider(options.provider.config);
    } else {
      throw new Error('provider not found');
    }

    this.opfsPath = options.opfsPath || 'bucket';
    this.pollingInterval = options.pollingInterval || (this.provider.pollIntervalMs || 8000);
    this._timer = null;
    this._listeners = new Map();
    this._lastLocalHash = null;
    this._lastRemoteHash = null;
    this._stopped = true;

    this.provider.getFileName().then((filename) => {
      this._filename = filename || 'unknown';
      this.start();
    }).catch((err) => {
      this._emit(OPFS_CLOUD_ERROR, { error: err });
    });

  }

  addEventListener(type, cb) {
    if (!this._listeners.has(type)) this._listeners.set(type, []);
    this._listeners.get(type).push(cb);
  }
  removeEventListener(type, cb) {
    if (!this._listeners.has(type)) return;
    this._listeners.set(type, this._listeners.get(type).filter(f => f !== cb));
  }
  _emit(type, detail) {
    const handlers = this._listeners.get(type) || [];
    for (const h of handlers) {
      try { h({ detail }); } catch (e) { console.error(e); }
    }
  }

  async _computeLocalHash() {
    try {
      const ab = await readOpfsFile(this.opfsPath + '/' + this._filename);
      if (!ab) return null;
      return await this.provider.checksum(ab);
    } catch (e) {
      return null;
    }
  }

  async sync() {
    try {
      const changed = await this.provider.poll();

      if (changed) {
        this._emit(CLOUD_FILE_CHANGED, { reason: 'remoteChanged', remoteHash });
      }
    } catch (err) {
      this._emit(OPFS_CLOUD_ERROR, { error: err });
      throw err;
    }
  }

  start() {
    // download at start
    this.downloadAndReplace().catch((e) => { console.error(e) });

    if (!this.provider.supportsPolling()) return;
    if (this._timer) return;
    this._stopped = false;
    this._timer = setInterval(() => {
      this.sync().catch(() => { });
    }, this.pollingInterval);
    // initial sync
    this.sync().catch(() => { });
  }

  stop() {
    if (this._timer) clearInterval(this._timer);
    this._timer = null;
    this._stopped = true;
    if (this.provider && typeof this.provider.dispose === 'function') this.provider.dispose().catch(() => { });
  }

  async downloadAndReplace() {
    const data = await this.provider.download();
    
    await writeOpfsFile(this.opfsPath  + '/' + this._filename, data);
    this._lastLocalHash = await this._computeLocalHash();
    return this._lastLocalHash;
  }
}
