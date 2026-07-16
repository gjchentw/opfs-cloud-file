/**
 * Unit tests for md5 utility
 * Verifies MD5 computation against known values (RFC 1321 test vectors)
 */

import { md5FromArrayBuffer } from './md5';

function abFromString(s) {
    // ASCII-only encoding (jsdom test environment lacks TextEncoder)
    const u8 = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) u8[i] = s.charCodeAt(i);
    return u8.buffer;
}

describe('md5FromArrayBuffer', () => {
    describe('known MD5 values', () => {
        it('should return the canonical MD5 for an empty buffer', async () => {
            const result = await md5FromArrayBuffer(new ArrayBuffer(0));
            expect(result).toBe('d41d8cd98f00b204e9800998ecf8427e');
        });

        it('should return the canonical MD5 for "a"', async () => {
            const result = await md5FromArrayBuffer(abFromString('a'));
            expect(result).toBe('0cc175b9c0f1b6a831c399e269772661');
        });

        it('should return the canonical MD5 for "abc"', async () => {
            const result = await md5FromArrayBuffer(abFromString('abc'));
            expect(result).toBe('900150983cd24fb0d6963f7d28e17f72');
        });

        it('should return the canonical MD5 for "message digest"', async () => {
            const result = await md5FromArrayBuffer(abFromString('message digest'));
            expect(result).toBe('f96b697d7cb7938d525a2f31aaf161d0');
        });

        it('should return a valid MD5 for binary (non-text) content', async () => {
            const u8 = new Uint8Array([0x00, 0xff, 0x10, 0x80]);
            const result = await md5FromArrayBuffer(u8.buffer);
            expect(result).toMatch(/^[0-9a-f]{32}$/);
        });

        it('should never return a placeholder fallback value', async () => {
            const result = await md5FromArrayBuffer(new ArrayBuffer(10));
            expect(result).not.toContain('md5-fallback-');
            expect(result).toMatch(/^[0-9a-f]{32}$/);
        });
    });

    describe('determinism', () => {
        it('should return the same hash for the same data every time', async () => {
            const ab = abFromString('deterministic-check');
            const first = await md5FromArrayBuffer(ab);
            const second = await md5FromArrayBuffer(ab);
            const third = await md5FromArrayBuffer(ab);
            expect(second).toBe(first);
            expect(third).toBe(first);
        });

        it('should return different hashes for different data', async () => {
            const a = await md5FromArrayBuffer(abFromString('content-a'));
            const b = await md5FromArrayBuffer(abFromString('content-b'));
            expect(a).not.toBe(b);
        });
    });

    describe('error handling', () => {
        it('should return null when computation fails', async () => {
            // Symbol cannot be converted to a typed array, so SparkMD5 throws internally
            const result = await md5FromArrayBuffer(Symbol('invalid'));
            expect(result).toBeNull();
        });
    });

    describe('buffer sizes', () => {
        it('should handle large ArrayBuffer (1MB)', async () => {
            const ab = new ArrayBuffer(1024 * 1024);
            const result = await md5FromArrayBuffer(ab);
            expect(result).toMatch(/^[0-9a-f]{32}$/);
        });
    });
});
