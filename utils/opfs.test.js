import { readOpfsFile, writeOpfsFile, getOpfsFileLastModified, mkdir } from './opfs';

describe('utils/opfs', () => {
    let mockRoot;
    let mockFileHandle;
    let mockDirectoryHandle;
    let mockWritable;
    let mockSyncAccessHandle;

    beforeEach(() => {
        // Mock File System Access API objects
        mockWritable = {
            write: jest.fn().mockResolvedValue(undefined),
            close: jest.fn().mockResolvedValue(undefined),
        };

        mockSyncAccessHandle = {
            getSize: jest.fn(),
            read: jest.fn(),
            write: jest.fn(),
            truncate: jest.fn(),
            flush: jest.fn(),
            close: jest.fn(),
        };

        mockFileHandle = {
            getFile: jest.fn(),
            createWritable: jest.fn().mockResolvedValue(mockWritable),
            createSyncAccessHandle: undefined, // Default to main thread (no sync access)
        };

        mockDirectoryHandle = {
            getFileHandle: jest.fn().mockResolvedValue(mockFileHandle),
            getDirectoryHandle: jest.fn(),
        };
        // Recursive mock for getDirectoryHandle to return itself or another mock
        mockDirectoryHandle.getDirectoryHandle.mockResolvedValue(mockDirectoryHandle);

        mockRoot = mockDirectoryHandle;

        // Mock navigator.storage
        Object.defineProperty(global, 'navigator', {
            value: {
                storage: {
                    getDirectory: jest.fn().mockResolvedValue(mockRoot),
                },
            },
            writable: true,
        });
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('readOpfsFile', () => {
        it('should read file in main thread (async)', async () => {
            const mockFile = {
                arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(8)),
            };
            mockFileHandle.getFile.mockResolvedValue(mockFile);

            const result = await readOpfsFile('test.txt');

            expect(navigator.storage.getDirectory).toHaveBeenCalled();
            expect(mockRoot.getFileHandle).toHaveBeenCalledWith('test.txt');
            expect(mockFileHandle.getFile).toHaveBeenCalled();
            expect(mockFile.arrayBuffer).toHaveBeenCalled();
            expect(result).toBeInstanceOf(ArrayBuffer);
        });

        it('should read file in worker (sync)', async () => {
            // Simulate Worker environment
            mockFileHandle.createSyncAccessHandle = jest.fn().mockResolvedValue(mockSyncAccessHandle);
            mockSyncAccessHandle.getSize.mockReturnValue(8);

            const result = await readOpfsFile('test.txt');

            expect(mockFileHandle.createSyncAccessHandle).toHaveBeenCalled();
            expect(mockSyncAccessHandle.getSize).toHaveBeenCalled();
            expect(mockSyncAccessHandle.read).toHaveBeenCalled();
            expect(mockSyncAccessHandle.close).toHaveBeenCalled();
            expect(result).toBeInstanceOf(ArrayBuffer);
            expect(result.byteLength).toBe(8);
        });

        it('should return null on error', async () => {
            mockRoot.getFileHandle.mockRejectedValue(new Error('File not found'));
            const result = await readOpfsFile('test.txt');
            expect(result).toBeNull();
        });

        it('should read file from a nested folder path', async () => {
            const mockFile = {
                arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(8)),
            };
            mockFileHandle.getFile.mockResolvedValue(mockFile);

            const result = await readOpfsFile('bucket/test.txt');

            expect(mockRoot.getDirectoryHandle).toHaveBeenCalledWith('bucket');
            expect(mockDirectoryHandle.getFileHandle).toHaveBeenCalledWith('test.txt');
            expect(result).toBeInstanceOf(ArrayBuffer);
        });

        it('should return null when a folder in the path does not exist', async () => {
            mockRoot.getDirectoryHandle.mockRejectedValue(new Error('Directory not found'));
            const result = await readOpfsFile('missing/test.txt');
            expect(result).toBeNull();
        });

        it('should track sync access handle in tracker and remove it after close', async () => {
            mockFileHandle.createSyncAccessHandle = jest.fn().mockResolvedValue(mockSyncAccessHandle);
            mockSyncAccessHandle.getSize.mockReturnValue(8);

            const tracker = new Set();
            const addSpy = jest.spyOn(tracker, 'add');
            const deleteSpy = jest.spyOn(tracker, 'delete');

            await readOpfsFile('test.txt', tracker);

            expect(addSpy).toHaveBeenCalledWith(mockSyncAccessHandle);
            expect(deleteSpy).toHaveBeenCalledWith(mockSyncAccessHandle);
            expect(tracker.size).toBe(0);
        });

        it('should remove handle from tracker even when read throws', async () => {
            mockFileHandle.createSyncAccessHandle = jest.fn().mockResolvedValue(mockSyncAccessHandle);
            mockSyncAccessHandle.getSize.mockImplementation(() => { throw new Error('read error'); });

            const tracker = new Set();
            const result = await readOpfsFile('test.txt', tracker);

            expect(result).toBeNull();
            expect(mockSyncAccessHandle.close).toHaveBeenCalled();
            expect(tracker.size).toBe(0);
        });
    });

    describe('writeOpfsFile', () => {
        it('should write file in main thread (async)', async () => {
            const buffer = new ArrayBuffer(8);
            await writeOpfsFile('folder/test.txt', buffer);

            expect(mockRoot.getDirectoryHandle).toHaveBeenCalledWith('folder', { create: true });
            expect(mockDirectoryHandle.getFileHandle).toHaveBeenCalledWith('test.txt', { create: true });
            expect(mockFileHandle.createWritable).toHaveBeenCalled();
            expect(mockWritable.write).toHaveBeenCalledWith(buffer);
            expect(mockWritable.close).toHaveBeenCalled();
        });

        it('should write file in worker (sync)', async () => {
            const buffer = new ArrayBuffer(8);
            // Simulate Worker environment
            mockFileHandle.createSyncAccessHandle = jest.fn().mockResolvedValue(mockSyncAccessHandle);

            await writeOpfsFile('test.txt', buffer);

            expect(mockFileHandle.createSyncAccessHandle).toHaveBeenCalled();
            expect(mockSyncAccessHandle.truncate).toHaveBeenCalledWith(0);
            expect(mockSyncAccessHandle.write).toHaveBeenCalledWith(buffer, { at: 0 });
            expect(mockSyncAccessHandle.flush).toHaveBeenCalled();
            expect(mockSyncAccessHandle.close).toHaveBeenCalled();
        });

        it('should track sync access handle in tracker and remove it after close', async () => {
            const buffer = new ArrayBuffer(8);
            mockFileHandle.createSyncAccessHandle = jest.fn().mockResolvedValue(mockSyncAccessHandle);

            const tracker = new Set();
            const addSpy = jest.spyOn(tracker, 'add');
            const deleteSpy = jest.spyOn(tracker, 'delete');

            await writeOpfsFile('test.txt', buffer, tracker);

            expect(addSpy).toHaveBeenCalledWith(mockSyncAccessHandle);
            expect(deleteSpy).toHaveBeenCalledWith(mockSyncAccessHandle);
            expect(tracker.size).toBe(0);
        });
    });

    describe('getOpfsFileLastModified', () => {
        it('should return lastModified of a file in the root', async () => {
            mockFileHandle.getFile.mockResolvedValue({ lastModified: 12345 });

            const result = await getOpfsFileLastModified('test.txt');

            expect(mockRoot.getFileHandle).toHaveBeenCalledWith('test.txt');
            expect(result).toBe(12345);
        });

        it('should return lastModified of a file in a nested folder', async () => {
            mockFileHandle.getFile.mockResolvedValue({ lastModified: 67890 });

            const result = await getOpfsFileLastModified('folder/test.txt');

            expect(mockRoot.getDirectoryHandle).toHaveBeenCalledWith('folder');
            expect(mockDirectoryHandle.getFileHandle).toHaveBeenCalledWith('test.txt');
            expect(result).toBe(67890);
        });

        it('should return null when the file does not exist', async () => {
            mockRoot.getFileHandle.mockRejectedValue(new Error('File not found'));

            const result = await getOpfsFileLastModified('missing.txt');

            expect(result).toBeNull();
        });
    });

    describe('mkdir', () => {
        it('should recursively create directories', async () => {
            const folders = ['a', 'b', 'c'];
            // We need to ensure getDirectoryHandle returns a new mock for each call to verify chain
            // But for simplicity, reusing mockDirectoryHandle is enough if we check call arguments

            await mkdir(mockRoot, [...folders]); // Pass copy because mkdir consumes array

            expect(mockRoot.getDirectoryHandle).toHaveBeenCalledWith('a', { create: true });
            expect(mockRoot.getDirectoryHandle).toHaveBeenCalledWith('b', { create: true });
            expect(mockRoot.getDirectoryHandle).toHaveBeenCalledWith('c', { create: true });
            expect(mockRoot.getDirectoryHandle).toHaveBeenCalledTimes(3);
        });
    });
});
