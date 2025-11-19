import { OpfsCloudFile } from '../index';

self.onmessage = (e: MessageEvent) => {
    const { type, config } = e.data;

    if (type === 'init') {
        try {
            const cloudFile = new OpfsCloudFile({
                type: config.type,
                provider: {
                    config: {
                        fileId: config.fileId,
                        accessToken: config.accessToken,
                    }
                },
            });

            // Forward events to main thread if needed, or just log for now
            // cloudFile.addEventListener('some-event', (detail) => self.postMessage({ type: 'event', detail }));

            console.log('OpfsCloudFile initialized in worker', cloudFile);

        } catch (err) {
            console.error('Failed to initialize OpfsCloudFile in worker:', err);
        }
    }
};
