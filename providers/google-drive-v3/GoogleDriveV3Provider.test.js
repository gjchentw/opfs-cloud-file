import { GoogleDriveV3Provider } from './GoogleDriveV3Provider';
import { md5FromArrayBuffer } from '../../utils/md5';

jest.mock('../../utils/md5');

describe('GoogleDriveV3Provider', () => {
    let provider;
    const config = {
        fileId: 'test-file-id',
        accessToken: 'test-access-token',
    };

    beforeEach(() => {
        jest.clearAllMocks();
        global.fetch = jest.fn();
        provider = new GoogleDriveV3Provider(config);
    });

    describe('getFileMetadata', () => {
        it('should fetch metadata from correct URL', async () => {
            global.fetch.mockResolvedValue({
                ok: true,
                json: jest.fn().mockResolvedValue({ name: 'test.txt', md5Checksum: 'abc', mimeType: 'text/plain' }),
            });

            const meta = await provider.getFileMetadata();

            expect(global.fetch).toHaveBeenCalledWith(
                'https://www.googleapis.com/drive/v3/files/test-file-id?fields=id,name,md5Checksum,modifiedTime,mimeType',
                { headers: { Authorization: 'Bearer test-access-token' } }
            );
            expect(meta).toEqual({ name: 'test.txt', md5Checksum: 'abc', mimeType: 'text/plain' });
        });
    });

    describe('download', () => {
        it('should download file content', async () => {
            provider._meta = { mimeType: 'text/plain' };

            global.fetch.mockResolvedValue({
                ok: true,
                arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(10)),
            });

            const buffer = await provider.download();

            expect(global.fetch).toHaveBeenCalledWith(
                'https://www.googleapis.com/drive/v3/files/test-file-id?alt=media',
                { headers: { Authorization: 'Bearer test-access-token' } }
            );
            expect(buffer).toBeInstanceOf(ArrayBuffer);
        });
    });

    describe('upload', () => {
        it('should upload file using PATCH', async () => {
            provider._meta = { mimeType: 'text/plain' };
            global.fetch.mockResolvedValue({
                ok: true,
                json: jest.fn().mockResolvedValue({ md5Checksum: 'new-hash' }),
            });

            const data = new ArrayBuffer(5);
            const result = await provider.upload(data);

            expect(global.fetch).toHaveBeenCalledWith(
                'https://www.googleapis.com/upload/drive/v3/files/test-file-id?uploadType=media',
                {
                    method: 'PATCH',
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
        it('should detect changes', async () => {
            provider._lastRemoteMD5 = 'old-hash';
            global.fetch.mockResolvedValue({
                ok: true,
                json: jest.fn().mockResolvedValue({ md5Checksum: 'new-hash' }),
            });

            const changed = await provider.poll();
            expect(changed).toBe(true);
        });
    });

    describe('supportsPolling', () => {
        it('should return true', () => {
            expect(provider.supportsPolling()).toBe(true);
        });
    });

    describe('getFileName', () => {
        it('should return file name from metadata', async () => {
            global.fetch.mockResolvedValue({
                ok: true,
                json: jest.fn().mockResolvedValue({ name: 'test-file.txt', md5Checksum: 'abc', mimeType: 'text/plain' }),
            });

            const filename = await provider.getFileName();
            expect(filename).toBe('test-file.txt');
        });

        it('should return null when metadata has no name', async () => {
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
            expect(() => new GoogleDriveV3Provider(invalidConfig)).toThrow('fileId and accessToken required for Google Drive v3');
        });

        it('should throw error when accessToken is missing', () => {
            const invalidConfig = { fileId: 'test-id' };
            expect(() => new GoogleDriveV3Provider(invalidConfig)).toThrow('fileId and accessToken required for Google Drive v3');
        });

        it('should set default pollIntervalMs', () => {
            expect(provider.pollIntervalMs).toBe(8000);
        });

        it('should use custom pollIntervalMs', () => {
            const customConfig = { fileId: 'test', accessToken: 'token', pollIntervalMs: 5000 };
            const customProvider = new GoogleDriveV3Provider(customConfig);
            expect(customProvider.pollIntervalMs).toBe(5000);
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

        it('should return false if checksum is same', async () => {
            provider._lastRemoteMD5 = 'same-hash';
            global.fetch.mockResolvedValue({
                ok: true,
                json: jest.fn().mockResolvedValue({ md5Checksum: 'same-hash' }),
            });

            const changed = await provider.poll();
            expect(changed).toBe(false);
        });

        it('should return null when metadata has no md5Checksum', async () => {
            global.fetch.mockResolvedValue({
                ok: true,
                json: jest.fn().mockResolvedValue({ name: 'test.txt' }),
            });

            const changed = await provider.poll();
            expect(changed).toBe(false);
            expect(provider._lastRemoteMD5).toBeNull();
        });
    });
});
