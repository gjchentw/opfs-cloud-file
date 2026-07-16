## Why

This change addresses critical weaknesses identified in the opfs-cloud-file implementation analysis. The current implementation has several issues that affect reliability, data integrity, and functionality. This hardening change will improve the robustness of the core library and provider implementations by addressing all identified weaknesses.

## What Changes

This change modifies the existing opfs-cloud-file core library and provider implementations to address the following critical issues:

### Critical Issues
- **MD5 Implementation**: Current fallback returns fake checksums, breaking change detection
- **Error Recovery**: No automatic retry mechanism for transient errors
- **Conflict Resolution**: Last-write-wins strategy may cause data loss

### Quality Improvements
- **Memory Management**: Proactive resource cleanup and tracking
- **Worker Event Forwarding**: Enable full functionality in Web Worker context
- **Error Messages**: Improved Google Apps file error messages

**Note**: This is a DELTA change that MODIFIES existing capabilities (opfs-cloud-file, google-drive-v2-provider, google-drive-v3-provider) to add new requirements and modify existing behavior.

## Capabilities

### Modified Capabilities
- `opfs-cloud-file`: Core library modifications for MD5 implementation, error recovery, conflict resolution, memory management, and worker event forwarding
- `google-drive-v2-provider`: Provider-specific improvements for Google Apps file handling
- `google-drive-v3-provider`: Provider-specific improvements for Google Apps file handling

### New Capabilities

## Impact

**Affected Components:**
- Core: `utils/md5.js` (MD5 implementation fix)
- Core: `src/OpfsCloudFile.js` (error recovery, conflict resolution, worker events)
- Core: `src/worker.ts` (event forwarding implementation)
- Providers: `providers/google-drive-v2/GoogleDriveV2Provider.js` (error messages)
- Providers: `providers/google-drive-v3/GoogleDriveV3Provider.js` (error messages)

**Affected Systems:**
- All consumers using opfs-cloud-file library
- All provider implementations
- Test infrastructure (new test cases needed)

**Dependencies:**
- Existing opfs-cloud-file baseline specification
- Existing google-drive-v2-provider specification
- Existing google-drive-v3-provider specification
- Existing infrastructure specification

**Breaking Changes:** NONE - All changes are backward compatible
