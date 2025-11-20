# OpfsCloudFile

[![NPM Version](https://img.shields.io/npm/v/opfs-cloud-file)](https://www.npmjs.com/package/opfs-cloud-file)
[![Test Status](https://img.shields.io/github/actions/workflow/status/gjchentw/opfs-cloud-file/test.yml?label=Tests)](https://github.com/gjchentw/opfs-cloud-file/actions/workflows/test.yml)
[![License](https://img.shields.io/npm/l/opfs-cloud-file)](LICENSE.md)

**OpfsCloudFile** is a library that synchronizes a file between the Origin Private File System (OPFS) and cloud storage providers (currently supporting Google Drive). It leverages Web Workers and the OPFS synchronous API (`createSyncAccessHandle`) for high-performance file operations without blocking the main thread.

## Features

- **Seamless Sync**: Automatically synchronizes local OPFS changes to the cloud.
- **Web Worker Support**: Runs heavy file operations in a background worker.
- **High Performance**: Uses OPFS synchronous access handles when available.
- **Extensible**: Easy to add new cloud storage providers.
- **Google Drive Support**: Built-in support for Google Drive API V2 and V3.

## Installation

```bash
npm install opfs-cloud-file
```

## Usage

Here is the simplest example of how to use `OpfsCloudFile` with Google Drive:

```javascript
import { OpfsCloudFile } from './src/OpfsCloudFile';

// Configuration for Google Drive V3
const config = {
  type: 'google-drive-v3',
  opfsPath: 'my-app', // Path in OPFS
  provider: {
    config: {
      fileId: 'YOUR_GOOGLE_DRIVE_FILE_ID',
      accessToken: 'YOUR_ACCESS_TOKEN',
    },
  },
};

// Initialize OpfsCloudFile
const cloudFile = new OpfsCloudFile(config);

// Listen for changes from the cloud
cloudFile.addEventListener('cloud-file-changed', (event) => {
  console.log('Remote file changed:', event.detail);
});

// Listen for errors
cloudFile.addEventListener('opfs-cloud-error', (event) => {
  console.error('Sync error:', event.detail);
});

// Start syncing (happens automatically on init, but you can trigger manually)
// cloudFile.sync();

// Notify OpfsCloudFile when you modify the file locally
// This triggers the auto-upload process
function onFileSaved() {
  cloudFile.dispatchEvent(new CustomEvent('local-file-changed'));
}

```

## Contributing New Providers

We welcome contributions! If you want to add support for a new cloud provider (e.g., Dropbox, OneDrive), you need to create a class that extends `BaseCloudProvider` and implements the following interface:

```javascript
class MyCloudProvider extends BaseCloudProvider {
  constructor(config) {
    super(config);
    // Initialize your provider
  }

  /**
   * Returns the name of the file from the cloud.
   * @returns {Promise<string>}
   */
  async getFileName() {
    // ...
  }

  /**
   * Downloads the file content from the cloud.
   * @returns {Promise<ArrayBuffer>}
   */
  async download() {
    // ...
  }

  /**
   * Uploads the file content to the cloud.
   * @param {ArrayBuffer} data - The file content to upload.
   * @returns {Promise<object>} - Metadata of the uploaded file (must include checksum).
   */
  async upload(data) {
    // ...
  }

  /**
   * Checks for changes on the cloud.
   * @returns {Promise<boolean>} - True if the remote file has changed.
   */
  async poll() {
    // ...
  }

  /**
   * Returns the checksum of the local data (e.g., MD5).
   * @param {ArrayBuffer} data 
   * @returns {Promise<string>}
   */
  async checksum(data) {
    // ...
  }
  
  /**
   * Clean up resources.
   */
  async dispose() {
    // ...
  }
}
```

