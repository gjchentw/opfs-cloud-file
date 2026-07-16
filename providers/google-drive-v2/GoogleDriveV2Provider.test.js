import { GoogleDriveV2Provider } from './GoogleDriveV2Provider';
import { md5FromArrayBuffer } from '../../utils/md5';

jest.mock('../../utils/md5');

describe('GoogleDriveV2Provider', () => {
    let provider;
    const config = {
        fileId: 'test-file-id',
        accessToken: 'test-access-token',
    };

    beforeEach(() => {
        jest.clearAllMocks();
        global.fetch = jest.fn();
        provider = new GoogleDriveV2Provider(config);
    });

    describe('getFileMetadata', () => {
        it('should fetch metadata from correct URL', async () => {
            global.fetch.mockResolvedValue({
                ok: true,
                json: jest.fn().mockResolvedValue({ title: 'test.txt', md5Checksum: 'abc', mimeType: 'text/plain' }),
            });

            const meta = await provider.getFileMetadata();

            expect(global.fetch).toHaveBeenCalledWith(
                'https://www.googleapis.com/drive/v2/files/test-file-id',
                { headers: { Authorization: 'Bearer test-access-token' } }
            );
            expect(meta).toEqual({ title: 'test.txt', md5Checksum: 'abc', mimeType: 'text/plain' });
        });

        it('should throw error on failure', async () => {
            global.fetch.mockResolvedValue({ ok: false, status: 404 });
            await expect(provider.getFileMetadata()).rejects.toThrow('metadata fetch failed: 404');
        });
    });

    describe('download', () => {
        it('should download file content', async () => {
            // Setup metadata first
            provider._meta = { mimeType: 'text/plain' };

            global.fetch.mockResolvedValue({
                ok: true,
                arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(10)),
            });

            const buffer = await provider.download();

            expect(global.fetch).toHaveBeenCalledWith(
                'https://www.googleapis.com/drive/v2/files/test-file-id?alt=media',
                { headers: { Authorization: 'Bearer test-access-token' } }
            );
            expect(buffer).toBeInstanceOf(ArrayBuffer);
        });

        it('should throw enhanced error if file is not downloadable (Google Apps)', async () => {
            provider._meta = { mimeType: 'application/vnd.google-apps.document' };
            const err = await provider.download().then(
                () => { throw new Error('expected download to reject'); },
                (e) => e
            );
            // File type
            expect(err.message).toContain('Google Docs');
            expect(err.message).toContain('application/vnd.google-apps.document');
            // Explanation
            expect(err.message).toContain('not downloadable as binary');
            // Actionable suggestion
            expect(err.message).toContain('Google Drive web interface to export');
        });

        it('should use generic type name for unknown Google Apps mimeType', async () => {
            provider._meta = { mimeType: 'application/vnd.google-apps.unknown' };
            await expect(provider.download()).rejects.toThrow('Google Apps file');
        });

        it('should throw error on API failure status', async () => {
            provider._meta = { mimeType: 'text/plain' };
            global.fetch.mockResolvedValue({ ok: false, status: 500 });
            await expect(provider.download()).rejects.toThrow('download failed: 500');
        });
    });

    describe('getRemoteModifiedTime', () => {
        it('should return parsed timestamp from modifiedDate', async () => {
            provider._meta = { modifiedDate: '2026-07-16T00:00:00.000Z' };
            const ts = await provider.getRemoteModifiedTime();
            expect(ts).toBe(Date.parse('2026-07-16T00:00:00.000Z'));
        });

        it('should return null when metadata is missing', async () => {
            provider._meta = null;
            expect(await provider.getRemoteModifiedTime()).toBeNull();
        });

        it('should return null when modifiedDate is missing', async () => {
            provider._meta = {};
            expect(await provider.getRemoteModifiedTime()).toBeNull();
        });

        it('should return null when modifiedDate is invalid', async () => {
            provider._meta = { modifiedDate: 'not-a-date' };
            expect(await provider.getRemoteModifiedTime()).toBeNull();
        });
    });

    describe('upload', () => {
        it('should upload file using PUT', async () => {
            provider._meta = { mimeType: 'text/plain' };
            global.fetch.mockResolvedValue({
                ok: true,
                json: jest.fn().mockResolvedValue({ md5Checksum: 'new-hash' }),
            });

            const data = new ArrayBuffer(5);
            const result = await provider.upload(data);

            expect(global.fetch).toHaveBeenCalledWith(
                'https://www.googleapis.com/upload/drive/v2/files/test-file-id?uploadType=media',
                {
                    method: 'PUT',
                    headers: {
                        Authorization: 'Bearer test-access-token',
                        'Content-Type': 'text/plain',
                    },
                    body: data,
                }
            );
            expect(result).toBeUndefined();
            expect(provider._lastRemoteMD5).toBe('new-hash');
        });
    });

    describe('poll', () => {
        it('should return false on first poll (initial sync)', async () => {
            global.fetch.mockResolvedValue({
                ok: true,
                json: jest.fn().mockResolvedValue({ md5Checksum: 'abc' }),
            });

            const changed = await provider.poll();
            expect(changed).toBe(false);
            expect(provider._lastRemoteMD5).toBe('abc');
        });

        it('should return true if checksum changes', async () => {
            provider._lastRemoteMD5 = 'old-hash';
            global.fetch.mockResolvedValue({
                ok: true,
                json: jest.fn().mockResolvedValue({ md5Checksum: 'new-hash' }),
            });

            const changed = await provider.poll();
            expect(changed).toBe(true);
            expect(provider._lastRemoteMD5).toBe('new-hash');
        });

        it('should return false if checksum is same', async () => {
            provider._lastRemoteMD5 = 'same-hash';
            global.fetch.mockResolvedValue({
                ok: true,
                json: jest.fn().mockResolvedValue({ md5Checksum: 'same-hash' }),
            });

            const changed = await provider.poll();
            expect(changed).toBe(false);
        });
    });

    describe('supportsPolling', () => {
        it('should return true', () => {
            expect(provider.supportsPolling()).toBe(true);
        });
    });

    describe('getFileName', () => {
        it('should return file title from metadata', async () => {
            global.fetch.mockResolvedValue({
                ok: true,
                json: jest.fn().mockResolvedValue({ title: 'test-file.txt', md5Checksum: 'abc', mimeType: 'text/plain' }),
            });

            const filename = await provider.getFileName();
            expect(filename).toBe('test-file.txt');
        });

        it('should return null when metadata has no title', async () => {
            global.fetch.mockResolvedValue({
                ok: true,
                json: jest.fn().mockResolvedValue({ md5Checksum: 'abc', mimeType: 'text/plain' }),
            });

            const filename = await provider.getFileName();
            expect(filename).toBeNull();
        });

        it('should return null when metadata is null', async () => {
            global.fetch.mockResolvedValue({
                ok: true,
                json: jest.fn().mockResolvedValue(null),
            });

            const filename = await provider.getFileName();
            expect(filename).toBeNull();
        });
    });

    describe('getRemoteFileChecksum', () => {
        it('should return last remote MD5', async () => {
            provider._lastRemoteMD5 = 'abc123';
            const checksum = await provider.getRemoteFileChecksum();
            expect(checksum).toBe('abc123');
        });

        it('should return null when no checksum available', async () => {
            provider._lastRemoteMD5 = null;
            const checksum = await provider.getRemoteFileChecksum();
            expect(checksum).toBeNull();
        });
    });

    describe('checksum', () => {
        it('should return md5 hash for data', async () => {
            const data = new ArrayBuffer(10);
            md5FromArrayBuffer.mockResolvedValue('test-hash');

            const result = await provider.checksum(data);
            expect(result).toBe('test-hash');
            expect(md5FromArrayBuffer).toHaveBeenCalledWith(data);
        });

        it('should return null on error', async () => {
            const data = new ArrayBuffer(10);
            md5FromArrayBuffer.mockRejectedValue(new Error('hash error'));

            const result = await provider.checksum(data);
            expect(result).toBeNull();
        });
    });

    describe('constructor validation', () => {
        it('should throw error when fileId is missing', () => {
            const invalidConfig = { accessToken: 'test-token' };
            expect(() => new GoogleDriveV2Provider(invalidConfig)).toThrow('fileId and accessToken required for Google Drive v2');
        });

        it('should throw error when accessToken is missing', () => {
            const invalidConfig = { fileId: 'test-id' };
            expect(() => new GoogleDriveV2Provider(invalidConfig)).toThrow('fileId and accessToken required for Google Drive v2');
        });

        it('should set default pollIntervalMs', () => {
            expect(provider.pollIntervalMs).toBe(8000);
        });

        it('should use custom pollIntervalMs', () => {
            const customConfig = { fileId: 'test', accessToken: 'token', pollIntervalMs: 5000 };
            const customProvider = new GoogleDriveV2Provider(customConfig);
            expect(customProvider.pollIntervalMs).toBe(5000);
        });
    });
});
