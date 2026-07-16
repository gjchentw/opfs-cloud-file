/**
 * Unit tests for BaseCloudProvider
 * This test file improves code coverage for BaseCloudProvider.js
 */

import { BaseCloudProvider } from './BaseCloudProvider';

describe('BaseCloudProvider', () => {
    let provider;
    const config = { test: 'config' };

    beforeEach(() => {
        provider = new BaseCloudProvider(config);
    });

    describe('constructor', () => {
        it('should initialize with config', () => {
            expect(provider._config).toEqual(config);
        });

        it('should initialize with empty config when not provided', () => {
            const providerNoConfig = new BaseCloudProvider();
            expect(providerNoConfig._config).toEqual({});
        });
    });

    describe('supportsPolling', () => {
        it('should return false by default', () => {
            expect(provider.supportsPolling()).toBe(false);
        });
    });

    describe('getFileName', () => {
        it('should throw not implemented error', async () => {
            await expect(provider.getFileName()).rejects.toThrow('getFileName not implemented');
        });
    });

    describe('poll', () => {
        it('should throw not implemented error', async () => {
            await expect(provider.poll()).rejects.toThrow('poll not implemented');
        });
    });

    describe('checksum', () => {
        it('should throw download not implemented error', async () => {
            // Note: There are two checksum methods in BaseCloudProvider, but the second
            // overwrites the first in JavaScript, so both calls result in the same error
            const data = new ArrayBuffer(10);
            await expect(provider.checksum(data)).rejects.toThrow('download not implemented');
            await expect(provider.checksum()).rejects.toThrow('download not implemented');
        });
    });

    describe('upload', () => {
        it('should throw not implemented error', async () => {
            const data = new ArrayBuffer(10);
            await expect(provider.upload(data)).rejects.toThrow('upload not implemented');
        });
    });

    describe('download', () => {
        it('should throw not implemented error', async () => {
            await expect(provider.download()).rejects.toThrow('download not implemented');
        });
    });

    describe('getRemoteFileChecksum', () => {
        it('should throw not implemented error', async () => {
            await expect(provider.getRemoteFileChecksum()).rejects.toThrow('getRemoteFileChecksum not implemented');
        });
    });

    describe('dispose', () => {
        it('should dispose without error', async () => {
            await expect(provider.dispose()).resolves.toBeUndefined();
        });
    });
});
