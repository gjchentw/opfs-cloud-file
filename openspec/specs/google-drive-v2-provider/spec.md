# Google Drive V2 Provider Specification

## Purpose

This specification defines the requirements for the **Google Drive V2 Provider**, which is a concrete implementation of the BaseCloudProvider interface for Google Drive API v2. This provider enables file synchronization between OPFS and Google Drive using API v2 endpoints. This specification explicitly implements the interface defined in the opfs-cloud-file baseline specification and does not modify that baseline.

## Scope

This specification covers:
- Google Drive API v2 provider implementation
- Authentication and authorization requirements
- API endpoints and request formats
- File metadata management
- File download and upload operations
- Change detection mechanisms

This specification does NOT cover:
- Core opfs-cloud-file library behavior (covered by opfs-cloud-file baseline spec)
- Google Drive API v3 (separate provider specification)
- OAuth 2.0 token acquisition flow
- Build, test, or CI/CD infrastructure (covered by infrastructure spec)

```mermaid
classDiagram
    class BaseCloudProvider {
        <<abstract>>
        +supportsPolling()
        +getFileName()
        +poll()
        +checksum(data)
        +upload(data)
        +download()
        +getRemoteFileChecksum()
        +dispose()
    }
    class GoogleDriveV2Provider {
        +fileId: string
        +accessToken: string
        +pollIntervalMs: number
        +_lastRemoteMD5: string
        +_meta: object
        +supportsPolling()
        +getFileMetadata()
        +getFileName()
        +poll()
        +checksum(data)
        +upload(data)
        +download()
        +getRemoteFileChecksum()
        +dispose()
    }
    BaseCloudProvider <|-- GoogleDriveV2Provider : implements
```
*Caption: Google Drive V2 Provider class diagram showing inheritance from BaseCloudProvider*

## Requirements

### Requirement: Provider Instantiation

The Google Drive V2 Provider SHALL be instantiated with a configuration object containing required properties.

The configuration object SHALL contain the following required properties:
- `fileId`: A string containing the Google Drive file ID
- `accessToken`: A string containing the Bearer access token for authentication

The configuration object MAY contain the following optional properties:
- `pollIntervalMs`: A number specifying the polling interval in milliseconds (defaults to 8000)

The constructor SHALL throw an error with a descriptive message if `fileId` or `accessToken` is missing.

**Implementation**: `providers/google-drive-v2/GoogleDriveV2Provider.js:5-14`
**Verification**: Unit tests for constructor validation

```mermaid
sequenceDiagram
    participant Consumer
    participant GoogleDriveV2Provider
    
    Consumer->>GoogleDriveV2Provider: new GoogleDriveV2Provider(config)
    GoogleDriveV2Provider->>GoogleDriveV2Provider: Validate fileId and accessToken
    alt Valid config
        GoogleDriveV2Provider->>GoogleDriveV2Provider: Store config
        GoogleDriveV2Provider->>GoogleDriveV2Provider: Initialize state
        GoogleDriveV2Provider-->>Consumer: Provider instance
    else Invalid config
        GoogleDriveV2Provider-->>Consumer: Throw Error
    end
```
*Caption: Google Drive V2 Provider instantiation sequence with validation*

#### Scenario: Successful instantiation with required config
- **WHEN** `new GoogleDriveV2Provider({ fileId: 'abc123', accessToken: 'xyz789' })` is called
- **THEN** system creates and returns a GoogleDriveV2Provider instance

#### Scenario: Missing fileId throws error
- **WHEN** `new GoogleDriveV2Provider({ accessToken: 'xyz789' })` is called
- **THEN** system throws an error with message 'fileId and accessToken required for Google Drive v2'

#### Scenario: Missing accessToken throws error
- **WHEN** `new GoogleDriveV2Provider({ fileId: 'abc123' })` is called
- **THEN** system throws an error with message 'fileId and accessToken required for Google Drive v2'

#### Scenario: Custom pollIntervalMs used
- **WHEN** `new GoogleDriveV2Provider({ fileId: 'abc123', accessToken: 'xyz789', pollIntervalMs: 5000 })` is called
- **THEN** system uses 5000 as the polling interval

#### Scenario: Default pollIntervalMs used
- **WHEN** `new GoogleDriveV2Provider({ fileId: 'abc123', accessToken: 'xyz789' })` is called
- **THEN** system uses 8000 as the default polling interval

---

### Requirement: Polling Support

The Google Drive V2 Provider SHALL support polling for remote file changes.

The `supportsPolling()` method SHALL return `true`.

**Implementation**: `providers/google-drive-v2/GoogleDriveV2Provider.js:16`
**Verification**: Unit tests for polling support

```mermaid
flowchart TD
    A[supportsPolling] --> B[Return true]
```
*Caption: Simple flowchart for polling support*

#### Scenario: Polling support returns true
- **WHEN** `provider.supportsPolling()` is called
- **THEN** system returns true

---

### Requirement: Metadata Fetching

The Google Drive V2 Provider SHALL provide a method to fetch file metadata from Google Drive API v2.

The `getFileMetadata()` method SHALL:
- Construct the API URL as `https://www.googleapis.com/drive/v2/files/{fileId}`
- Send a GET request with the Authorization header: `Bearer {accessToken}`
- If the response is not OK, throw an error with the status code
- Store the metadata response in the `_meta` property
- Return the metadata object

**Implementation**: `providers/google-drive-v2/GoogleDriveV2Provider.js:18-24`
**Verification**: Unit tests for metadata fetching

```mermaid
sequenceDiagram
    participant Provider
    participant GoogleDriveAPI
    
    Provider->>GoogleDriveAPI: GET /drive/v2/files/{fileId}
    Note over Provider,GoogleDriveAPI: Headers: Authorization: Bearer {accessToken}
    GoogleDriveAPI-->>Provider: Response (metadata JSON)
    alt Response OK
        Provider->>Provider: Store metadata in _meta
        Provider-->>Provider: Return metadata
    else Response not OK
        Provider-->>Provider: Throw Error
    end
```
*Caption: Metadata fetching sequence with error handling*

#### Scenario: Metadata fetched successfully
- **WHEN** `provider.getFileMetadata()` is called with valid fileId and accessToken
- **THEN** system makes GET request to Google Drive API v2 and returns metadata object

#### Scenario: Metadata fetch with correct URL
- **WHEN** `provider.getFileMetadata()` is called with fileId 'test-file-id'
- **THEN** system makes request to `https://www.googleapis.com/drive/v2/files/test-file-id`

#### Scenario: Metadata fetch with correct headers
- **WHEN** `provider.getFileMetadata()` is called with accessToken 'test-token'
- **THEN** system includes header `Authorization: Bearer test-token` in the request

#### Scenario: Metadata fetch error handling
- **WHEN** Google Drive API returns non-OK response with status 404
- **THEN** system throws error with message 'metadata fetch failed: 404'

---

### Requirement: File Name Retrieval

The Google Drive V2 Provider SHALL retrieve the file name from Google Drive metadata.

The `getFileName()` method SHALL:
- Call `getFileMetadata()` to fetch the metadata
- Return the `title` property from the metadata if it exists
- Return `null` if the metadata or title is missing

**Implementation**: `providers/google-drive-v2/GoogleDriveV2Provider.js:26-29`
**Verification**: Unit tests for file name retrieval

```mermaid
flowchart TD
    A[getFileName] --> B[getFileMetadata]
    B --> C{Metadata has title?}
    C -->|Yes| D[Return metadata.title]
    C -->|No| E[Return null]
```
*Caption: File name retrieval flowchart with metadata fetching*

#### Scenario: Return file title from metadata
- **WHEN** `provider.getFileName()` is called and metadata contains `{ title: 'test.txt', ... }`
- **THEN** system returns 'test.txt'

#### Scenario: Return null when metadata has no title
- **WHEN** `provider.getFileName()` is called and metadata contains `{ md5Checksum: 'abc' }` without title
- **THEN** system returns null

#### Scenario: Return null when metadata is null
- **WHEN** `provider.getFileName()` is called and getFileMetadata returns null
- **THEN** system returns null

---

### Requirement: File Download

The Google Drive V2 Provider SHALL download file content from Google Drive.

The `download()` method SHALL:
- Check if the file is a Google Apps file by examining `_meta.mimeType`
- If the mimeType starts with `application/vnd.google-apps.`, throw an error with an **enhanced error message** containing the file type name (e.g., 'Google Docs'), an explanation (not downloadable as binary content), and an actionable suggestion (use the Google Drive web interface to export)
- Construct the download URL as `https://www.googleapis.com/drive/v2/files/{fileId}?alt=media`
- Send a GET request with the Authorization header: `Bearer {accessToken}`
- If the response is not OK, throw an error with the status code
- Return the response as an ArrayBuffer

**Implementation**: `providers/google-drive-v2/GoogleDriveV2Provider.js:41-55`
**Verification**: Unit tests for file download with enhanced error messages

```mermaid
sequenceDiagram
    participant Provider
    participant GoogleDriveAPI
    
    Provider->>Provider: Check mimeType
    alt Is Google Apps file
        Provider->>Provider: Create enhanced error
        Provider-->>Provider: Throw Error with guidance
    else Is downloadable
        Provider->>GoogleDriveAPI: GET /drive/v2/files/{fileId}?alt=media
        Note over Provider,GoogleDriveAPI: Headers: Authorization: Bearer {accessToken}
        GoogleDriveAPI-->>Provider: Response (ArrayBuffer)
        alt Response OK
            Provider-->>Provider: Return ArrayBuffer
        else Response not OK
            Provider-->>Provider: Throw Error
        end
    end
```
*Caption: File download sequence with enhanced Google Apps file error handling*

#### Scenario: Download file content successfully
- **WHEN** `provider.download()` is called with valid fileId and accessToken
- **THEN** system makes GET request to Google Drive API v2 with alt=media and returns ArrayBuffer

#### Scenario: Download non-Google Apps file successfully
- **WHEN** `provider.download()` is called for non-Google Apps file
- **THEN** system downloads and returns ArrayBuffer as before

#### Scenario: Download with correct URL
- **WHEN** `provider.download()` is called with fileId 'test-file-id'
- **THEN** system makes request to `https://www.googleapis.com/drive/v2/files/test-file-id?alt=media`

#### Scenario: Download with correct headers
- **WHEN** `provider.download()` is called with accessToken 'test-token'
- **THEN** system includes header `Authorization: Bearer test-token` in the request

#### Scenario: Throw enhanced error for Google Apps files
- **WHEN** `provider.download()` is called and _meta.mimeType is 'application/vnd.google-apps.document'
- **THEN** system throws error with message containing file type, explanation, and suggestion

#### Scenario: Enhanced error message format
- **WHEN** download fails for Google Apps file
- **THEN** error message includes: file type (e.g., 'Google Docs'), reason (not downloadable as binary), and suggestion (use Google Drive web interface to export)

#### Scenario: Download error handling for API errors
- **WHEN** Google Drive API returns non-OK response with status 500
- **THEN** system throws error with message 'download failed: 500'

---

### Requirement: File Upload

The Google Drive V2 Provider SHALL upload file content to Google Drive.

The `upload(data)` method SHALL:
- Construct the upload URL as `https://www.googleapis.com/upload/drive/v2/files/{fileId}?uploadType=media`
- Send a PUT request with:
  - The Authorization header: `Bearer {accessToken}`
  - The Content-Type header: `_meta.mimeType` or 'application/octet-stream' if mimeType is not available
  - The request body containing the data (ArrayBuffer)
- If the response is not OK, throw an error with the status code
- Store the response metadata in the `_meta` property
- Store the `md5Checksum` from the response in the `_lastRemoteMD5` property

**Implementation**: `providers/google-drive-v2/GoogleDriveV2Provider.js:42-57`
**Verification**: Unit tests for file upload

```mermaid
sequenceDiagram
    participant Provider
    participant GoogleDriveAPI
    
    Provider->>GoogleDriveAPI: PUT /upload/drive/v2/files/{fileId}?uploadType=media
    Note over Provider,GoogleDriveAPI: Headers: Authorization: Bearer {accessToken}
    Note over Provider,GoogleDriveAPI: Headers: Content-Type: {mimeType}
    Note over Provider,GoogleDriveAPI: Body: ArrayBuffer data
    GoogleDriveAPI-->>Provider: Response (metadata JSON)
    alt Response OK
        Provider->>Provider: Store metadata in _meta
        Provider->>Provider: Store md5Checksum in _lastRemoteMD5
    else Response not OK
        Provider-->>Provider: Throw Error
    end
```
*Caption: File upload sequence with PUT method and metadata storage*

#### Scenario: Upload file content successfully
- **WHEN** `provider.upload(data)` is called with valid data, fileId, and accessToken
- **THEN** system makes PUT request to Google Drive API v2 upload endpoint and stores response metadata

#### Scenario: Upload with correct URL
- **WHEN** `provider.upload(data)` is called with fileId 'test-file-id'
- **THEN** system makes request to `https://www.googleapis.com/upload/drive/v2/files/test-file-id?uploadType=media`

#### Scenario: Upload with correct method
- **WHEN** `provider.upload(data)` is called
- **THEN** system uses HTTP PUT method for the request

#### Scenario: Upload with correct headers
- **WHEN** `provider.upload(data)` is called with accessToken 'test-token' and _meta.mimeType 'text/plain'
- **THEN** system includes headers `Authorization: Bearer test-token` and `Content-Type: text/plain` in the request

#### Scenario: Upload with default Content-Type
- **WHEN** `provider.upload(data)` is called and _meta.mimeType is not available
- **THEN** system uses 'application/octet-stream' as Content-Type header

#### Scenario: Upload stores metadata and checksum
- **WHEN** `provider.upload(data)` is called and API returns `{ md5Checksum: 'abc123', ... }`
- **THEN** system stores metadata in _meta and 'abc123' in _lastRemoteMD5

#### Scenario: Upload error handling
- **WHEN** Google Drive API returns non-OK response with status 403
- **THEN** system throws error with message 'upload failed: 403'

---

### Requirement: Change Polling

The Google Drive V2 Provider SHALL detect remote file changes using MD5 checksum comparison.

The `poll()` method SHALL:
- Call `getFileMetadata()` to fetch current metadata
- Extract the `md5Checksum` from the metadata
- If `_lastRemoteMD5` is null (first poll), store the checksum and return `false`
- Compare the current checksum with `_lastRemoteMD5`
- Update `_lastRemoteMD5` with the current checksum
- Return `true` if checksums differ, `false` if they match

**Implementation**: `providers/google-drive-v2/GoogleDriveV2Provider.js:59-69`
**Verification**: Unit tests for change polling

```mermaid
stateDiagram-v2
    [*] --> Polling
    Polling --> FirstPoll: _lastRemoteMD5 is null
    Polling --> Compare: _lastRemoteMD5 exists
    
    FirstPoll --> StoreChecksum: Fetch metadata
    StoreChecksum --> NoChange: Store md5Checksum
    
    Compare --> Changed: Checksum differs
    Compare --> NoChange: Checksum matches
    
    Changed --> UpdateChecksum: Return true
    UpdateChecksum --> Polling
    NoChange --> Polling
```
*Caption: Change polling state machine with first poll and comparison logic*

#### Scenario: First poll returns false
- **WHEN** `provider.poll()` is called for the first time
- **THEN** system stores the remote MD5 checksum and returns false

#### Scenario: Polling detects change
- **WHEN** `provider.poll()` is called and remote checksum differs from _lastRemoteMD5
- **THEN** system updates _lastRemoteMD5 and returns true

#### Scenario: Polling detects no change
- **WHEN** `provider.poll()` is called and remote checksum matches _lastRemoteMD5
- **THEN** system returns false

#### Scenario: Polling with null md5Checksum
- **WHEN** `provider.poll()` is called and metadata has no md5Checksum field
- **THEN** system stores null in _lastRemoteMD5 and returns false

---

### Requirement: Remote File Checksum

The Google Drive V2 Provider SHALL provide access to the last known remote file checksum.

The `getRemoteFileChecksum()` method SHALL:
- Return the value stored in `_lastRemoteMD5`
- Return `null` if no checksum has been stored yet

**Implementation**: `providers/google-drive-v2/GoogleDriveV2Provider.js:71-73`
**Verification**: Unit tests for remote checksum retrieval

```mermaid
flowchart TD
    A[getRemoteFileChecksum] --> B{_lastRemoteMD5 exists?}
    B -->|Yes| C[Return _lastRemoteMD5]
    B -->|No| D[Return null]
```
*Caption: Remote checksum retrieval flowchart*

#### Scenario: Return stored remote checksum
- **WHEN** `provider.getRemoteFileChecksum()` is called and _lastRemoteMD5 is 'abc123'
- **THEN** system returns 'abc123'

#### Scenario: Return null when no checksum available
- **WHEN** `provider.getRemoteFileChecksum()` is called and _lastRemoteMD5 is null
- **THEN** system returns null

---

### Requirement: Local Data Checksum

The Google Drive V2 Provider SHALL compute checksums for local data using the MD5 algorithm.

The `checksum(data)` method SHALL:
- Accept ArrayBuffer data as input
- Call `md5FromArrayBuffer(data)` from the utils module
- Return the resulting checksum string
- Return `null` if an error occurs during checksum computation

**Implementation**: `providers/google-drive-v2/GoogleDriveV2Provider.js:75-81`
**Verification**: Unit tests for local checksum computation

```mermaid
sequenceDiagram
    participant Provider
    participant MD5Util
    
    Provider->>MD5Util: md5FromArrayBuffer(data)
    alt Success
        MD5Util-->>Provider: Checksum string
        Provider-->>Provider: Return checksum
    else Error
        MD5Util-->>Provider: Throw Error
        Provider-->>Provider: Return null
    end
```
*Caption: Local checksum computation sequence with error handling*

#### Scenario: Compute checksum for data successfully
- **WHEN** `provider.checksum(data)` is called with valid ArrayBuffer data
- **THEN** system calls md5FromArrayBuffer and returns the checksum string

#### Scenario: Return null on checksum error
- **WHEN** `provider.checksum(data)` is called and md5FromArrayBuffer throws an error
- **THEN** system returns null

---

### Requirement: Resource Cleanup

The Google Drive V2 Provider SHALL provide a method for resource cleanup.

The `dispose()` method SHALL:
- Be defined to satisfy the BaseCloudProvider interface
- Not throw errors if called
- May perform cleanup operations (currently a no-op in this implementation)

**Implementation**: `providers/BaseCloudProvider.js:11` (inherited)
**Verification**: Interface compliance check

```mermaid
flowchart TD
    A[dispose] --> B[No-op]
```
*Caption: Resource cleanup flowchart - currently a no-op*

#### Scenario: Dispose method exists
- **WHEN** `provider.dispose()` is called
- **THEN** system executes without errors

---

### Requirement: Interface Compliance

The Google Drive V2 Provider SHALL fully implement the BaseCloudProvider interface.

The provider SHALL implement all required methods:
- `constructor(config)` - Initializes with fileId and accessToken
- `supportsPolling()` - Returns true
- `getFileName()` - Returns Promise<string|null> with file title
- `poll()` - Returns Promise<bool> indicating if file changed
- `checksum(data)` - Returns Promise<string> with MD5 hash
- `upload(data)` - Returns Promise<void> for uploading data
- `download()` - Returns Promise<ArrayBuffer> with file content
- `getRemoteFileChecksum()` - Returns Promise<string> with remote MD5
- `dispose()` - Cleans up resources

**Implementation**: `providers/google-drive-v2/GoogleDriveV2Provider.js:5-82`
**Verification**: Provider interface validation, unit tests

```mermaid
classDiagram
    class BaseCloudProvider {
        <<abstract>>
        +constructor(config)
        +supportsPolling() bool
        +getFileName() Promise~string~
        +poll() Promise~bool~
        +checksum(data) Promise~string~
        +upload(data) Promise~void~
        +download() Promise~ArrayBuffer~
        +getRemoteFileChecksum() Promise~string~
        +dispose() void
    }
    class GoogleDriveV2Provider {
        +constructor(config)
        +supportsPolling() bool
        +getFileName() Promise~string~
        +poll() Promise~bool~
        +checksum(data) Promise~string~
        +upload(data) Promise~void~
        +download() Promise~ArrayBuffer~
        +getRemoteFileChecksum() Promise~string~
        +dispose() void
        +getFileMetadata() Promise~object~ (internal)
    }
    BaseCloudProvider <|-- GoogleDriveV2Provider : implements all methods
```
*Caption: Interface compliance class diagram showing all implemented methods*

#### Scenario: All required methods implemented
- **WHEN** provider is instantiated
- **THEN** all BaseCloudProvider methods are available and callable

---

### Requirement: Provider Type Registration

The Google Drive V2 Provider SHALL be registered as a valid provider type in the core library.

Consumers SHALL be able to instantiate the provider using:
- Type: `'google-drive-v2'`
- Configuration: `{ fileId: string, accessToken: string, pollIntervalMs?: number }`

The core library SHALL create an instance of GoogleDriveV2Provider when type `'google-drive-v2'` is specified.

**Implementation**: `providers/google-drive-v2/index.js:1`, `src/OpfsCloudFile.js:13-14`
**Verification**: Integration tests with provider type

```mermaid
sequenceDiagram
    participant Consumer
    participant OpfsCloudFile
    participant GoogleDriveV2Provider
    
    Consumer->>OpfsCloudFile: new OpfsCloudFile({
    Consumer->>OpfsCloudFile:   type: 'google-drive-v2',
    Consumer->>OpfsCloudFile:   provider: { config: { fileId: '...', accessToken: '...' } }
    Consumer->>OpfsCloudFile: })
    OpfsCloudFile->>GoogleDriveV2Provider: new GoogleDriveV2Provider(config.provider.config)
    GoogleDriveV2Provider-->>OpfsCloudFile: Provider instance
    OpfsCloudFile-->>Consumer: OpfsCloudFile instance
```
*Caption: Provider type registration sequence for google-drive-v2 type*

#### Scenario: Provider created via type string
- **WHEN** `new OpfsCloudFile({ type: 'google-drive-v2', provider: { config: { fileId: 'abc', accessToken: 'xyz' } } })` is called
- **THEN** system creates GoogleDriveV2Provider instance and initializes OpfsCloudFile

---

## Traceability

| Requirement | Implementation | Verification |
|-------------|----------------|--------------|
| Provider Instantiation | `providers/google-drive-v2/GoogleDriveV2Provider.js:5-14` | Unit tests for constructor validation |
| Polling Support | `providers/google-drive-v2/GoogleDriveV2Provider.js:16` | Unit tests for polling support |
| Metadata Fetching | `providers/google-drive-v2/GoogleDriveV2Provider.js:18-24` | Unit tests for metadata fetching |
| File Name Retrieval | `providers/google-drive-v2/GoogleDriveV2Provider.js:26-29` | Unit tests for file name retrieval |
| File Download | `providers/google-drive-v2/GoogleDriveV2Provider.js:41-55` | Unit tests for enhanced error messages |
| File Upload | `providers/google-drive-v2/GoogleDriveV2Provider.js:42-57` | Unit tests for file upload |
| Change Polling | `providers/google-drive-v2/GoogleDriveV2Provider.js:59-69` | Unit tests for change polling |
| Remote File Checksum | `providers/google-drive-v2/GoogleDriveV2Provider.js:71-73` | Unit tests for remote checksum |
| Local Data Checksum | `providers/google-drive-v2/GoogleDriveV2Provider.js:75-81` | Unit tests for local checksum |
| Resource Cleanup | `providers/BaseCloudProvider.js:11` (inherited) | Interface compliance check |
| Interface Compliance | `providers/google-drive-v2/GoogleDriveV2Provider.js:5-82` | Provider interface validation |
| Provider Type Registration | `providers/google-drive-v2/index.js:1`, `src/OpfsCloudFile.js:13-14` | Integration tests |

---

*Document Version: 1.1.0*  
*Last Updated: 2026-07-16*  
*Status: Draft*  
*Author: Mistral Vibe*  
*Dependencies: opfs-cloud-file baseline specification*
