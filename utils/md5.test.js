/**
 * Unit tests for md5 utility
 * This test file improves code coverage for md5.js
 */

import { md5FromArrayBuffer } from './md5';

describe('md5FromArrayBuffer', () => {
    let originalSparkMD5;

    beforeEach(() => {
        originalSparkMD5 = globalThis.SparkMD5;
    });

    afterEach(() => {
        globalThis.SparkMD5 = originalSparkMD5;
    });

    describe('with SparkMD5 available', () => {
        beforeEach(() => {
            globalThis.SparkMD5 = {
                ArrayBuffer: {
                    hash: jest.fn((ab) => 'spark-md5-hash')
                }
            };
        });

        it('should use SparkMD5 when available in global', async () => {
            const ab = new ArrayBuffer(10);
            const result = await md5FromArrayBuffer(ab);
            
            expect(globalThis.SparkMD5.ArrayBuffer.hash).toHaveBeenCalledWith(ab);
            expect(result).toBe('spark-md5-hash');
        });

        it('should handle empty ArrayBuffer', async () => {
            const ab = new ArrayBuffer(0);
            const result = await md5FromArrayBuffer(ab);
            
            expect(globalThis.SparkMD5.ArrayBuffer.hash).toHaveBeenCalledWith(ab);
            expect(result).toBe('spark-md5-hash');
        });

        it('should handle large ArrayBuffer', async () => {
            const ab = new ArrayBuffer(1024 * 1024); // 1MB
            const result = await md5FromArrayBuffer(ab);
            
            expect(globalThis.SparkMD5.ArrayBuffer.hash).toHaveBeenCalledWith(ab);
            expect(result).toBe('spark-md5-hash');
        });
    });

    describe('without SparkMD5 available', () => {
        beforeEach(() => {
            delete globalThis.SparkMD5;
        });

        it('should use fallback implementation when SparkMD5 not available', async () => {
            const ab = new ArrayBuffer(10);
            const result = await md5FromArrayBuffer(ab);
            
            expect(result).toContain('md5-fallback-');
        });

        it('should return fallback hash with length for empty buffer', async () => {
            const ab = new ArrayBuffer(0);
            const result = await md5FromArrayBuffer(ab);
            
            expect(result).toBe('md5-fallback-0');
        });

        it('should return fallback hash with length for non-empty buffer', async () => {
            const ab = new ArrayBuffer(5);
            const result = await md5FromArrayBuffer(ab);
            
            expect(result).toBe('md5-fallback-5');
        });

        it('should handle typical buffer sizes', async () => {
            const sizes = [1, 10, 100, 1000];
            
            for (const size of sizes) {
                const ab = new ArrayBuffer(size);
                const result = await md5FromArrayBuffer(ab);
                expect(result).toBe(`md5-fallback-${size}`);
            }
        });
    });

    describe('type handling', () => {
        it('should accept ArrayBuffer input', async () => {
            const ab = new ArrayBuffer(8);
            await expect(md5FromArrayBuffer(ab)).resolves.toBeDefined();
        });
    });
});
