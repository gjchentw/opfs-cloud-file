# OpfsCloudFile

![Build Status](https://img.shields.io/github/actions/workflow/status/gjchentw/opfs-cloud-file/build.yml?label=Build)
![Test Status](https://img.shields.io/github/actions/workflow/status/gjchentw/opfs-cloud-file/test.yml?label=Tests)
![License](https://img.shields.io/badge/license-MIT-blue.svg)

**OpfsCloudFile** is a library that synchronizes files between the Origin Private File System (OPFS) and cloud storage providers (currently supporting Google Drive). It leverages Web Workers and the OPFS synchronous API (`createSyncAccessHandle`) for high-performance file operations without blocking the main thread.

## Features

- **Seamless Sync**: Automatically synchronizes local OPFS changes to the cloud.
- **Web Worker Support**: Runs heavy file operations in a background worker.
- **High Performance**: Uses OPFS synchronous access handles when available.
- **Extensible**: Easy to add new cloud storage providers.
- **Google Drive Support**: Built-in support for Google Drive API V2 and V3.

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

