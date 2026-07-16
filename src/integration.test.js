/**
 * Integration tests for opfs-cloud-file hardening
 *
 * Unlike the unit tests, these tests do NOT mock utils/opfs or utils/md5.
 * They exercise the real OPFS utility code paths against an in-memory
 * OPFS implementation, with real SparkMD5 checksums.
 */

import { OpfsCloudFile } from './OpfsCloudFile';
import { readOpfsFile, writeOpfsFile } from '../utils/opfs';
import { md5FromArrayBuffer } from '../utils/md5';
import { CONFLICT_DETECTED, LOCAL_FILE_CHANGED, OPFS_CLOUD_ERROR } from './events';

// Minimal in-memory OPFS implementation (main-thread API surface)
function createMockOpfsRoot() {
    const makeDir = (name) => ({ kind: 'directory', name, children: new Map() });

    function fileHandle(f) {
        return {
            kind: 'file',
            name: f.name,
            getFile: async () => ({
                lastModified: f.lastModified,
                size: f.content.byteLength,
                arrayBuffer: async () => f.content,
            }),
            createWritable: async () => {
                const chunks = [];
                return {
                    write: async (buf) => { chunks.push(new Uint8Array(buf)); },
                    close: async () => {
                        const total = chunks.reduce((n, c) => n + c.length, 0);
                        const out = new Uint8Array(total);
                        let offset = 0;
                        for (const c of chunks) { out.set(c, offset); offset += c.length; }
                        f.content = out.buffer;
                        f.lastModified = Date.now();
                    },
                };
            },
        };
    }

    function dirHandle(dir) {
        return {
            kind: 'directory',
            name: dir.name,
            getDirectoryHandle: async (name, opts = {}) => {
                let d = dir.children.get(name);
                if (!d) {
                    if (!opts.create) throw new Error(`Directory not found: ${name}`);
                    d = makeDir(name);
                    dir.children.set(name, d);
                }
                if (d.kind !== 'directory') throw new Error(`Not a directory: ${name}`);
                return dirHandle(d);
            },
            getFileHandle: async (name, opts = {}) => {
                let f = dir.children.get(name);
                if (!f) {
                    if (!opts.create) throw new Error(`File not found: ${name}`);
                    f = { kind: 'file', name, content: new ArrayBuffer(0), lastModified: Date.now() };
                    dir.children.set(name, f);
                }
                if (f.kind !== 'file') throw new Error(`Not a file: ${name}`);
                return fileHandle(f);
            },
        };
    }

    return dirHandle(makeDir(''));
}

function abFromString(s) {
    const u8 = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) u8[i] = s.charCodeAt(i);
    return u8.buffer;
}

function stringFromAb(ab) {
    return String.fromCharCode(...new Uint8Array(ab));
}

async function flushMicrotasks(count = 20) {
    for (let i = 0; i < count; i++) await Promise.resolve();
}

describe('integration: OpfsCloudFile with real OPFS utilities', () => {
    let provider;
    let remoteContent;
    let remoteChecksum;

    beforeEach(async () => {
        jest.useFakeTimers();

        // Fresh in-memory OPFS for every test (jsdom's navigator is a getter,
        // so it must be replaced via defineProperty)
        const mockRoot = createMockOpfsRoot();
        Object.defineProperty(global, 'navigator', {
            value: { storage: { getDirectory: async () => mockRoot } },
            writable: true,
            configurable: true,
        });

        remoteContent = abFromString('remote content v1');
        remoteChecksum = await md5FromArrayBuffer(remoteContent);

        provider = {
            getFileName: jest.fn().mockResolvedValue('test.txt'),
            download: jest.fn().mockImplementation(async () => remoteContent),
            poll: jest.fn().mockResolvedValue(false),
            upload: jest.fn().mockResolvedValue(undefined),
            checksum: (data) => md5FromArrayBuffer(data),
            getRemoteFileChecksum: jest.fn().mockImplementation(async () => remoteChecksum),
            supportsPolling: jest.fn().mockReturnValue(false),
        };
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    function createCloudFile(extraOptions = {}) {
        return new OpfsCloudFile({
            provider: { instance: provider },
            opfsPath: 'bucket',
            ...extraOptions,
        });
    }

    it('downloads the remote file into OPFS and computes a real MD5 (8.1)', async () => {
        const cloudFile = createCloudFile();
        await flushMicrotasks();

        // File really lands in OPFS under the nested path
        const stored = await readOpfsFile('bucket/test.txt');
        expect(stored).not.toBeNull();
        expect(stringFromAb(stored)).toBe('remote content v1');

        // Local hash equals the real MD5 of the remote content
        expect(cloudFile._lastLocalHash).toBe(remoteChecksum);
        expect(cloudFile._lastLocalHash).toMatch(/^[0-9a-f]{32}$/);
    });

    it('uploads real local changes and retries transient errors (8.2)', async () => {
        const cloudFile = createCloudFile({ retryDelayMs: 100 });
        await flushMicrotasks();

        // Modify the local file for real
        await writeOpfsFile('bucket/test.txt', abFromString('local content v2'));

        provider.upload
            .mockRejectedValueOnce(new Error('upload failed: 500'))
            .mockResolvedValueOnce(undefined);

        const promise = cloudFile._onLocalFileChanged();
        await jest.advanceTimersByTimeAsync(100); // one backoff cycle
        await promise;

        expect(provider.upload).toHaveBeenCalledTimes(2);
        const uploaded = provider.upload.mock.calls[1][0];
        expect(stringFromAb(uploaded)).toBe('local content v2');
    });

    it('resolves conflicts by timestamp and downloads when remote is newer (8.3)', async () => {
        const cloudFile = createCloudFile();
        await flushMicrotasks();

        // Both sides changed: local file rewritten, remote checksum moved on
        await writeOpfsFile('bucket/test.txt', abFromString('local content v2'));
        remoteContent = abFromString('remote content v2');
        remoteChecksum = await md5FromArrayBuffer(remoteContent);

        // Remote is newer than the local file (fake timers freeze Date.now())
        provider.getRemoteModifiedTime = jest.fn().mockResolvedValue(Date.now() + 60000);

        await cloudFile._onLocalFileChanged();

        expect(provider.upload).not.toHaveBeenCalled();
        const stored = await readOpfsFile('bucket/test.txt');
        expect(stringFromAb(stored)).toBe('remote content v2');
    });

    it('emits conflict-detected when both changed and timestamps are equal (8.3)', async () => {
        const cloudFile = createCloudFile();
        await flushMicrotasks();

        await writeOpfsFile('bucket/test.txt', abFromString('local content v2'));
        remoteContent = abFromString('remote content v2');
        remoteChecksum = await md5FromArrayBuffer(remoteContent);

        // Equal timestamps (fake timers freeze Date.now())
        provider.getRemoteModifiedTime = jest.fn().mockResolvedValue(Date.now());

        const conflictListener = jest.fn();
        cloudFile.addEventListener(CONFLICT_DETECTED, conflictListener);

        await cloudFile._onLocalFileChanged();

        expect(provider.upload).not.toHaveBeenCalled();
        expect(conflictListener).toHaveBeenCalledTimes(1);
        const detail = conflictListener.mock.calls[0][0].detail;
        expect(detail.fileName).toBe('test.txt');
        expect(detail.localTimestamp).toBe(detail.remoteTimestamp);
        expect(detail.localChecksum).toMatch(/^[0-9a-f]{32}$/);
        expect(detail.remoteChecksum).toBe(remoteChecksum);
    });

    it('leaves no tracked access handles behind across many sync cycles (8.4)', async () => {
        const cloudFile = createCloudFile();
        await flushMicrotasks();

        for (let i = 0; i < 20; i++) {
            await writeOpfsFile('bucket/test.txt', abFromString(`local content ${i}`));
            await cloudFile._onLocalFileChanged();
            expect(cloudFile._accessHandles.size).toBe(0);
        }

        cloudFile.stop();
        expect(cloudFile._accessHandles.size).toBe(0);
    });

    it('local change with unchanged content does not upload (checksum match)', async () => {
        const cloudFile = createCloudFile();
        await flushMicrotasks();

        // Dispatch the event without changing the file
        cloudFile._emit(LOCAL_FILE_CHANGED, {});
        await flushMicrotasks();

        expect(provider.upload).not.toHaveBeenCalled();
    });

    it('surfaces enhanced Google Apps error through the error event (8.6)', async () => {
        const cloudFile = createCloudFile();
        await flushMicrotasks(); // initial download succeeds

        // Both local and remote changed; remote is newer -> download fails with enhanced error
        await writeOpfsFile('bucket/test.txt', abFromString('local content v2'));
        remoteChecksum = 'changed-remote-checksum';
        provider.getRemoteModifiedTime = jest.fn().mockResolvedValue(Date.now() + 60000);
        provider.download.mockRejectedValue(new Error(
            'Cannot download this file: it is a Google Docs file (application/vnd.google-apps.document), ' +
            'which is not downloadable as binary content. ' +
            'Use the Google Drive web interface to export it to a standard format.'
        ));

        const errorListener = jest.fn();
        cloudFile.addEventListener(OPFS_CLOUD_ERROR, errorListener);

        await cloudFile._onLocalFileChanged();

        expect(errorListener).toHaveBeenCalled();
        const err = errorListener.mock.calls[0][0].detail.error;
        expect(err.message).toContain('Google Docs');
        expect(err.message).toContain('not downloadable as binary');
        expect(err.message).toContain('Google Drive web interface to export');
    });
});
