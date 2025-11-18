import { resolve } from 'path';
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';

export default defineConfig({
    build: {
        lib: {
            entry: resolve(__dirname, 'index.js'),
            name: 'OpfsCloudFile',
            fileName: (format) => `opfs-cloud-file.${format === 'umd' ? 'umd.cjs' : 'js'}`,
        },
    },
    plugins: [
        dts({
            insertTypesEntry: true,
        }),
    ],
});
