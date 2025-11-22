import { OpfsCloudFile } from './OpfsCloudFile';
import { readOpfsFile, writeOpfsFile } from '../utils/opfs';
import { md5FromArrayBuffer } from '../utils/md5';
import { GoogleDriveV2Provider } from '../providers/google-drive-v2/GoogleDriveV2Provider';
import { LOCAL_FILE_CHANGED, CLOUD_FILE_CHANGED, OPFS_CLOUD_ERROR } from './events';

jest.mock('../utils/opfs');
jest.mock('../utils/md5');
jest.mock('../providers/google-drive-v2/GoogleDriveV2Provider', () => {
    return {
        GoogleDriveV2Provider: jest.fn().mockImplementation(() => {
            return {
                getFileName: jest.fn().mockResolvedValue('test.txt'),
                download: jest.fn().mockResolvedValue(new ArrayBuffer(10)),
                poll: jest.fn().mockResolvedValue(false),
                upload: jest.fn().mockResolvedValue(undefined),
                checksum: jest.fn().mockResolvedValue('local-hash'),
                getRemoteFileChecksum: jest.fn().mockResolvedValue('remote-hash'),
                supportsPolling: jest.fn().mockReturnValue(true),
                pollIntervalMs: 1000,
                dispose: jest.fn().mockResolvedValue(undefined),
            };
        }),
    };
});
jest.mock('../providers/google-drive-v3/GoogleDriveV3Provider');

describe('OpfsCloudFile', () => {
    let mockProvider;
    let config;

    beforeEach(() => {
        jest.clearAllMocks();
        jest.useFakeTimers();

        // Setup mock provider
        mockProvider = {
            getFileName: jest.fn().mockResolvedValue('test.txt'),
            download: jest.fn().mockResolvedValue(new ArrayBuffer(10)),
            poll: jest.fn().mockResolvedValue(false),
            upload: jest.fn().mockResolvedValue(undefined),
            checksum: jest.fn().mockResolvedValue('local-hash'),
            getRemoteFileChecksum: jest.fn().mockResolvedValue('remote-hash'),
            supportsPolling: jest.fn().mockReturnValue(true),
            pollIntervalMs: 1000,
            dispose: jest.fn().mockResolvedValue(undefined),
        };

        config = {
            provider: {
                instance: mockProvider,
            },
            opfsPath: 'bucket',
        };

        // Mock utils
        readOpfsFile.mockResolvedValue(new ArrayBuffer(10));
        writeOpfsFile.mockResolvedValue(undefined);
        md5FromArrayBuffer.mockResolvedValue('hash');
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    describe('Initialization', () => {
        it('should initialize with provider instance', async () => {
            const opfsCloudFile = new OpfsCloudFile(config);

            // Wait for async start() to complete (it's called in constructor but not awaited)
            await Promise.resolve();
            await Promise.resolve();

            expect(mockProvider.getFileName).toHaveBeenCalled();
            expect(mockProvider.download).toHaveBeenCalled();
            expect(writeOpfsFile).toHaveBeenCalledWith('bucket/test.txt', expect.any(ArrayBuffer));
        });

        it('should initialize with Google Drive V2 type', () => {
            const v2Config = {
                type: 'google-drive-v2',
                provider: { config: { fileId: '123', accessToken: 'abc' } },
            };
            new OpfsCloudFile(v2Config);
            expect(GoogleDriveV2Provider).toHaveBeenCalled();
        });
    });

    describe('Sync and Polling', () => {
        it('should poll for changes', async () => {
            const opfsCloudFile = new OpfsCloudFile(config);
            await Promise.resolve(); // Wait for start

            // Fast-forward time
            jest.advanceTimersByTime(1000);

            expect(mockProvider.poll).toHaveBeenCalled();
        });

        it('should emit CLOUD_FILE_CHANGED when poll returns true', async () => {
            mockProvider.poll.mockResolvedValue(true);
            const opfsCloudFile = new OpfsCloudFile(config);
            await Promise.resolve();

            const listener = jest.fn();
            opfsCloudFile.addEventListener(CLOUD_FILE_CHANGED, listener);

            // Trigger poll
            await opfsCloudFile.sync();

            expect(listener).toHaveBeenCalled();
        });
    });

    describe('Auto-Upload (_onLocalFileChanged)', () => {
        it('should upload when local file changes and hash differs', async () => {
            const opfsCloudFile = new OpfsCloudFile(config);
            await Promise.resolve();

            // Setup hashes
            // opfsCloudFile._lastRemoteHash = 'old-hash'; // Removed property
            mockProvider.getRemoteFileChecksum.mockResolvedValue('old-hash');
            mockProvider.checksum.mockResolvedValue('new-hash'); // Local hash is different

            // Trigger local change
            await opfsCloudFile._onLocalFileChanged();

            expect(readOpfsFile).toHaveBeenCalledWith('bucket/test.txt');
            expect(mockProvider.upload).toHaveBeenCalled();
            // expect(opfsCloudFile._lastRemoteHash).toBe('new-remote-hash'); // Removed property
        });

        it('should NOT upload when hashes match', async () => {
            const opfsCloudFile = new OpfsCloudFile(config);
            await Promise.resolve();

            // opfsCloudFile._lastRemoteHash = 'same-hash'; // Removed property
            mockProvider.getRemoteFileChecksum.mockResolvedValue('same-hash');
            mockProvider.checksum.mockResolvedValue('same-hash');

            await opfsCloudFile._onLocalFileChanged();

            expect(mockProvider.upload).not.toHaveBeenCalled();
        });

        it('should trigger _onLocalFileChanged on LOCAL_FILE_CHANGED event', async () => {
            const opfsCloudFile = new OpfsCloudFile(config);
            await Promise.resolve();

            const spy = jest.spyOn(opfsCloudFile, '_onLocalFileChanged');

            // Manually dispatch event (simulating what would happen if we had a real EventTarget or similar mechanism)
            // Since OpfsCloudFile implements its own simple event system:
            opfsCloudFile._emit(LOCAL_FILE_CHANGED, {});

            // Wait for async handler
            await Promise.resolve();

            // Note: The current implementation of addEventListener in OpfsCloudFile 
            // adds the listener to a private map. The constructor adds a listener 
            // that calls _onLocalFileChanged.
            // We need to verify that emitting the event triggers the method.

            expect(spy).toHaveBeenCalled();
        });
    });
});
