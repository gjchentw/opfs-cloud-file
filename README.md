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
  // Optional: error recovery configuration (defaults shown)
  maxRetries: 3,        // Retry attempts for transient errors
  retryDelayMs: 1000,   // Base delay between retries
  backoffMultiplier: 2, // Exponential backoff multiplier
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

// Listen for conflicts that need manual resolution
cloudFile.addEventListener('conflict-detected', (event) => {
  console.warn('Sync conflict:', event.detail);
});

// Start syncing (happens automatically on init, but you can trigger manually)
// cloudFile.sync();

// Notify OpfsCloudFile when you modify the file locally
// This triggers the auto-upload process
function onFileSaved() {
  cloudFile.dispatchEvent(new CustomEvent('local-file-changed'));
}

```

## Error Recovery (Retry)

Transient errors are retried automatically with exponential backoff. The retry
behavior is configurable via the `OpfsCloudFile` constructor options:

| Option | Default | Description |
|--------|---------|-------------|
| `maxRetries` | `3` | Maximum number of retry attempts |
| `retryDelayMs` | `1000` | Base delay between retries in milliseconds |
| `backoffMultiplier` | `2` | Multiplier for exponential backoff |
| `retryableErrors` | `null` | Custom list of retryable errors (HTTP status codes and/or the string `'network'`) |

The wait before retry attempt *n* is `retryDelayMs * backoffMultiplier^n`
(1s, 2s, 4s with the defaults).

By default the following errors are retried:

- **Network errors** (e.g. `fetch` failures with no HTTP status)
- **429** Too Many Requests (rate limiting)
- **500–599** server errors

These errors are **not** retried and fail immediately:

- **401** Unauthorized, **403** Forbidden, **404** Not Found (and other 4xx)

An `opfs-cloud-error` event is emitted only after all retries are exhausted
(or immediately for non-retryable errors).

## Conflict Resolution

When both the local file and the remote file have changed since the last sync,
the conflict is resolved by comparing modification timestamps:

- **Local timestamp newer** → local changes are uploaded (local wins)
- **Remote timestamp newer** → remote changes are downloaded (remote wins)
- **Timestamps equal** → a `conflict-detected` event is emitted for manual resolution
- **Timestamps unavailable** → falls back to last-write-wins (local wins)

### The `conflict-detected` Event

```javascript
cloudFile.addEventListener('conflict-detected', (event) => {
  const {
    localChecksum,   // MD5 of the local file
    remoteChecksum,  // MD5 of the remote file
    localTimestamp,  // Local modification time (ms since epoch)
    remoteTimestamp, // Remote modification time (ms since epoch)
    fileName,        // Name of the conflicting file
  } = event.detail;
  // Resolve manually, e.g. by keeping one side or merging
});
```

## Events

| Event | When | Detail |
|-------|------|--------|
| `local-file-changed` | Dispatched by *you* after modifying the local file | — |
| `cloud-file-changed` | The remote file changed (detected by polling) | `{ reason, remoteHash }` |
| `opfs-cloud-error` | A sync operation failed (after retries) | `{ error }` or `{ warning: true, failures }` for resource-cleanup warnings |
| `conflict-detected` | Local and remote changed with equal timestamps | `{ localChecksum, remoteChecksum, localTimestamp, remoteTimestamp, fileName }` |

When running inside a Web Worker, all events are forwarded to the main thread
via `postMessage` using the format
`{ type: 'opfs-event', eventType: string, detail: object }`.

## Resource Management

Open OPFS access handles are tracked internally and closed automatically when
`stop()` is called. You can also trigger cleanup explicitly:

```javascript
cloudFile.cleanup(); // Close all tracked OPFS access handles
cloudFile.stop();    // Stop polling, clean up handles, dispose the provider
```

If any handle fails to close, a warning is logged and an `opfs-cloud-error`
event is emitted with `{ warning: true, failures }`.

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
   * @returns {Promise<void>}
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
   * Returns the checksum of the remote file.
   * @returns {Promise<string>}
   */
  async getRemoteFileChecksum() {
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
   * Optional: Returns the remote file's modification time (ms since epoch).
   * Used for conflict resolution; return null when unavailable.
   * @returns {Promise<number | null>}
   */
  async getRemoteModifiedTime() {
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

## Release Process

This project follows Semantic Versioning (SemVer) 2.0.0. Pre-release versions (alpha, beta, rc) are **OPTIONAL** and not mandatory for the release workflow.

### Release Requirements

- **CHANGELOG.md is REQUIRED** - All releases must include a CHANGELOG.md file documenting the changes
- **Version Consistency** - The git tag version must match the package.json version exactly
- **All Tests Must Pass** - All tests with coverage must pass before release
- **Coverage Thresholds** - Minimum 80% coverage for statements, branches, functions, and lines

### Publishing

Releases are automatically published to npm when a new version tag is pushed to the repository. The publish workflow performs the following validations:

1. Validates entry points (ESM, UMD, TypeScript declarations)
2. Verifies CHANGELOG.md exists
3. Verifies version consistency between git tag and package.json
4. Runs all tests with coverage
5. Validates coverage thresholds (80% minimum for statements, branches, functions, lines)
6. Validates package contents for errors, sensitive files, and unnecessary files
7. Scans for credentials in repository
8. Builds the package
9. Publishes to npm registry with fail-closed behavior

### Safe Publishing Verification

To verify the publishing process **WITHOUT** actually publishing, use the Verify Publish workflow:

```bash
# Manually trigger verification
gh workflow run verify-publish

# Or use npm publish --dry-run locally
npm publish --dry-run
```

**IMPORTANT**: Never use actual `npm publish` for verification or testing. Always use `npm publish --dry-run` to prevent accidental production releases.

