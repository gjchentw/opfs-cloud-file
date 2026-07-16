import { CLOUD_FILE_CHANGED, OPFS_CLOUD_ERROR, LOCAL_FILE_CHANGED, CONFLICT_DETECTED } from "./events.js";
import { readOpfsFile, writeOpfsFile, getOpfsFileLastModified } from "../utils/opfs.js";
import { GoogleDriveV2Provider } from "../providers/google-drive-v2/GoogleDriveV2Provider.js";
import { GoogleDriveV3Provider } from "../providers/google-drive-v3/GoogleDriveV3Provider.js";

const NON_RETRYABLE_STATUS = [401, 403, 404];

export class OpfsCloudFile {
  constructor(options) {
    if (!options || !options.provider || (!options.provider.instance && !options.type)) throw new Error('provider.instance required');

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
    this.maxRetries = options.maxRetries !== undefined ? options.maxRetries : 3;
    this.retryDelayMs = options.retryDelayMs !== undefined ? options.retryDelayMs : 1000;
    this.backoffMultiplier = options.backoffMultiplier !== undefined ? options.backoffMultiplier : 2;
    this.retryableErrors = options.retryableErrors || null;
    this._timer = null;
    this._listeners = new Map();
    this._lastLocalHash = null;
    this._lastSyncedRemoteHash = null;
    this._stopped = true;
    this._accessHandles = new Set();

    this.provider.getFileName().then((filename) => {
      this._filename = filename || 'unknown';
      this.start();
    }).catch((err) => {
      this._emit(OPFS_CLOUD_ERROR, { error: err });
    });

    this.addEventListener(LOCAL_FILE_CHANGED, () => {
      this._onLocalFileChanged();
    });
  }

  async _onLocalFileChanged() {
    const localHash = await this._computeLocalHash();
    this._lastLocalHash = localHash;

    const remoteHash = await this.provider.getRemoteFileChecksum();
    if (this._lastLocalHash === remoteHash) return;

    // Conflict detection: remote also changed since the last synced state
    if (this._lastSyncedRemoteHash !== null && remoteHash !== this._lastSyncedRemoteHash) {
      const resolution = await this._resolveConflict(localHash, remoteHash);
      if (resolution === 'remote') {
        try {
          await this.downloadAndReplace();
        } catch (e) {
          this._emit(OPFS_CLOUD_ERROR, { error: e });
        }
        return;
      }
      if (resolution === 'conflict') return; // conflict-detected already emitted
      // resolution === 'local': fall through to upload
    }

    try {
      const ab = await readOpfsFile(this.opfsPath + '/' + this._filename, this._accessHandles);
      if (ab) {
        await this._withRetry(() => this.provider.upload(ab));
        this._lastLocalHash = await this._computeLocalHash(); // Recompute to be sure
        this._lastSyncedRemoteHash = await this.provider.getRemoteFileChecksum();
      }
    } catch (e) {
      this._emit(OPFS_CLOUD_ERROR, { error: e });
    }
  }

  async _resolveConflict(localChecksum, remoteChecksum) {
    const localTimestamp = await getOpfsFileLastModified(this.opfsPath + '/' + this._filename);
    const remoteTimestamp = typeof this.provider.getRemoteModifiedTime === 'function'
      ? await this.provider.getRemoteModifiedTime()
      : null;

    // Timestamps unavailable: fall back to last-write-wins (local wins)
    if (localTimestamp == null || remoteTimestamp == null) return 'local';

    if (localTimestamp > remoteTimestamp) return 'local';
    if (remoteTimestamp > localTimestamp) return 'remote';

    // Timestamps equal: manual resolution required
    this._emit(CONFLICT_DETECTED, {
      localChecksum,
      remoteChecksum,
      localTimestamp,
      remoteTimestamp,
      fileName: this._filename,
    });
    return 'conflict';
  }

  _extractErrorStatus(err) {
    if (!err) return null;
    if (typeof err.status === 'number') return err.status;
    const match = /\b(\d{3})\b\s*$/.exec(err.message || '');
    return match ? parseInt(match[1], 10) : null;
  }

  _isRetryableError(err) {
    const status = this._extractErrorStatus(err);
    // fetch signals network-level failures as TypeError
    const isNetworkError = err instanceof TypeError;
    if (this.retryableErrors) {
      if (status === null) return isNetworkError && this.retryableErrors.includes('network');
      return this.retryableErrors.includes(status);
    }
    if (status === null) return isNetworkError;
    if (NON_RETRYABLE_STATUS.includes(status)) return false;
    if (status === 429) return true;
    if (status >= 500 && status <= 599) return true;
    return false;
  }

  async _withRetry(fn) {
    let attempt = 0;
    for (;;) {
      try {
        return await fn();
      } catch (e) {
        if (!this._isRetryableError(e) || attempt >= this.maxRetries) throw e;
        const delay = this.retryDelayMs * Math.pow(this.backoffMultiplier, attempt);
        attempt++;
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
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
      const ab = await readOpfsFile(this.opfsPath + '/' + this._filename, this._accessHandles);
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
        const remoteHash = await this.provider.getRemoteFileChecksum();
        this._emit(CLOUD_FILE_CHANGED, { reason: 'remoteChanged', remoteHash: remoteHash });
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
    this.cleanup();
    if (this.provider && typeof this.provider.dispose === 'function') this.provider.dispose().catch(() => { });
  }

  cleanup() {
    const failures = [];
    for (const handle of this._accessHandles) {
      try {
        handle.close();
      } catch (e) {
        failures.push({ handle, error: e });
      }
    }
    this._accessHandles.clear();
    if (failures.length) {
      console.warn('opfs-cloud-file: failed to close some OPFS access handles', failures);
      this._emit(OPFS_CLOUD_ERROR, { warning: true, failures });
    }
  }

  async downloadAndReplace() {
    const data = await this._withRetry(() => this.provider.download());

    await writeOpfsFile(this.opfsPath + '/' + this._filename, data, this._accessHandles);
    this._lastLocalHash = await this._computeLocalHash();
    this._lastSyncedRemoteHash = await this.provider.getRemoteFileChecksum();
    return this._lastLocalHash;
  }
}
