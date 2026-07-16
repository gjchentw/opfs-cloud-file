import { OpfsCloudFile, events } from '../index';

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

            // Forward all events to the main thread
            for (const eventType of Object.values(events)) {
                cloudFile.addEventListener(eventType, (event: { detail: unknown }) => {
                    self.postMessage({ type: 'opfs-event', eventType, detail: event.detail });
                });
            }

            console.log('OpfsCloudFile initialized in worker', cloudFile);

        } catch (err) {
            console.error('Failed to initialize OpfsCloudFile in worker:', err);
        }
    }
};
