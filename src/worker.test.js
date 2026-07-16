/**
 * Integration tests for worker event forwarding
 * Verifies that events emitted inside the worker are forwarded to the
 * main thread via postMessage using the documented message format.
 */

const mockListeners = new Map();
const mockAddEventListener = jest.fn((type, cb) => {
    if (!mockListeners.has(type)) mockListeners.set(type, []);
    mockListeners.get(type).push(cb);
});

jest.mock('../index', () => ({
    OpfsCloudFile: jest.fn().mockImplementation(() => ({
        addEventListener: mockAddEventListener,
    })),
    events: jest.requireActual('./events.js'),
}));

import { OpfsCloudFile, events } from '../index';

describe('worker event forwarding', () => {
    let originalOnMessage;
    let originalPostMessage;

    beforeAll(async () => {
        originalOnMessage = self.onmessage;
        originalPostMessage = self.postMessage;
        await import('./worker.ts'); // registers self.onmessage
    });

    afterAll(() => {
        self.onmessage = originalOnMessage;
        self.postMessage = originalPostMessage;
    });

    beforeEach(() => {
        mockListeners.clear();
        mockAddEventListener.mockClear();
        OpfsCloudFile.mockClear();
        self.postMessage = jest.fn();
        jest.spyOn(console, 'log').mockImplementation(() => { });
        jest.spyOn(console, 'error').mockImplementation(() => { });
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    function initWorker() {
        self.onmessage({
            data: {
                type: 'init',
                config: { type: 'google-drive-v3', fileId: 'f', accessToken: 't' },
            },
        });
    }

    it('should create OpfsCloudFile on init message', () => {
        initWorker();

        expect(OpfsCloudFile).toHaveBeenCalledWith({
            type: 'google-drive-v3',
            provider: { config: { fileId: 'f', accessToken: 't' } },
        });
    });

    it('should register listeners for all event types', () => {
        initWorker();

        const registeredTypes = mockAddEventListener.mock.calls.map(([type]) => type);
        for (const eventType of Object.values(events)) {
            expect(registeredTypes).toContain(eventType);
        }
        // Includes the conflict-detected event
        expect(registeredTypes).toContain('conflict-detected');
    });

    it.each(
        ['local-file-changed', 'cloud-file-changed', 'opfs-cloud-error', 'conflict-detected']
    )('should forward %s events to the main thread with consistent format', (eventType) => {
        initWorker();

        const detail = { some: 'payload' };
        for (const cb of mockListeners.get(eventType)) cb({ detail });

        expect(self.postMessage).toHaveBeenCalledWith({
            type: 'opfs-event',
            eventType,
            detail,
        });
    });

    it('should ignore messages of unknown type', () => {
        self.onmessage({ data: { type: 'unknown' } });
        expect(OpfsCloudFile).not.toHaveBeenCalled();
    });

    it('should log an error when initialization fails', () => {
        OpfsCloudFile.mockImplementationOnce(() => { throw new Error('init failed'); });

        initWorker();

        expect(console.error).toHaveBeenCalledWith(
            'Failed to initialize OpfsCloudFile in worker:',
            expect.any(Error)
        );
    });
});
