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

        it('should throw if file is not downloadable (Google Apps)', async () => {
            provider._meta = { mimeType: 'application/vnd.google-apps.document' };
            await expect(provider.download()).rejects.toThrow('not a downloadable file');
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
});
