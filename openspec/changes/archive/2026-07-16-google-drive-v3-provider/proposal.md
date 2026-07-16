## Why

This change establishes the baseline specification for the **Google Drive V3 Provider** implementation, which is a concrete cloud storage provider for the opfs-cloud-file library. The Google Drive V3 Provider implements the BaseCloudProvider interface defined in the opfs-cloud-file baseline specification, providing synchronization between OPFS and Google Drive using API v3 endpoints. This specification is needed to formally document the provider's behavior, API contract, and integration requirements, separate from the core library specification and distinct from the Google Drive V2 provider.

## What Changes

This change introduces the formal specification for the Google Drive V3 provider capability. The specification will:

- Define the Google Drive V3-specific implementation of the BaseCloudProvider interface
- Specify the authentication and API endpoints for Google Drive V3
- Document the provider's behavior for metadata fetching, file download, and file upload
- Establish change detection mechanisms using Google Drive V3 checksums
- Highlight differences between V2 and V3 implementations
- Clarify the relationship between this provider and the core opfs-cloud-file library

**Note**: This specification depends on and implements the BaseCloudProvider interface defined in the opfs-cloud-file baseline specification. It is a separate capability from google-drive-v2-provider, as they use different API versions with different endpoints and behaviors.

## Capabilities

### New Capabilities
- `google-drive-v3-provider`: Google Drive API v3 cloud storage provider implementation that conforms to the BaseCloudProvider interface, including authentication, metadata management, file operations, and change detection using Google Drive API v3 endpoints.

### Modified Capabilities

## Impact

**Affected Components:**
- Provider file: `providers/google-drive-v3/GoogleDriveV3Provider.js`
- Provider exports: `providers/google-drive-v3/index.js`
- Test file: `providers/google-drive-v3/GoogleDriveV3Provider.test.js`

**Affected Systems:**
- Consumers using Google Drive V3 as their cloud storage provider
- Test infrastructure (via existing infrastructure spec)

**Dependencies:**
- This capability depends on the opfs-cloud-file baseline specification for the BaseCloudProvider interface
- This capability depends on the existing infrastructure specification for build, test, and CI/CD requirements

**Integration:**
- Consumers will instantiate this provider via: `{ type: 'google-drive-v3', provider: { config: { fileId: '...', accessToken: '...' } } }`
- Provider implements all methods required by BaseCloudProvider
