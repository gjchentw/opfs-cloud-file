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
            expect(result).toEqual({ md5Checksum: 'new-hash' });
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
});
