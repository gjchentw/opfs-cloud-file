## Context

This design addresses all weaknesses identified in the opfs-cloud-file analysis. The current implementation has critical issues that affect reliability and data integrity. This hardening change will implement fixes for all identified problems while maintaining backward compatibility.

**Analysis Source**: Previous opfs-cloud-file codebase analysis identified 6 key weaknesses:
1. MD5 Dependency Issue (HIGH PRIORITY)
2. Limited Error Recovery (MEDIUM PRIORITY)
3. No Conflict Resolution (MEDIUM PRIORITY)
4. Memory Management (LOW PRIORITY)
5. Worker Event Forwarding Missing (LOW PRIORITY)
6. Google Apps File Handling (LOW PRIORITY)

## Goals / Non-Goals

**Goals:**
- Fix MD5 implementation to ensure reliable checksums
- Add error recovery with configurable retry logic
- Implement conflict detection and resolution
- Improve memory management for long-running operations
- Enable full worker functionality with event forwarding
- Enhance error messages for Google Apps files
- Maintain backward compatibility

**Non-Goals:**
- Change the BaseCloudProvider interface
- Modify existing provider authentication mechanisms
- Add new cloud storage providers
- Change the core synchronization algorithm

## Decisions

### Decision: MD5 Implementation Strategy
**Chosen**: Bundle SparkMD5 library as a dependency
**Rationale**: SparkMD5 is lightweight, well-tested, and widely used. Bundling ensures consistent checksum computation across all environments.
**Implementation**: Add SparkMD5 as a dependency and use it in utils/md5.js
**Alternatives Considered**:
- Pure JS MD5 implementation: More code to maintain
- External dependency: Requires consumers to include it

### Decision: Error Recovery Mechanism
**Chosen**: Configurable retry with exponential backoff
**Rationale**: Transient errors (network issues, rate limits) should be retried automatically with increasing delays.
**Configuration**:
- `maxRetries`: Maximum number of retry attempts (default: 3)
- `retryDelayMs`: Base delay between retries (default: 1000ms)
- `backoffMultiplier`: Multiplier for exponential backoff (default: 2)
- `retryableErrors`: List of error types to retry (network errors, 429, 500-599)
**Alternatives Considered**:
- Fixed retry count: Less flexible
- No retry: Current behavior, poor user experience
- Infinite retry: Could cause infinite loops

### Decision: Conflict Resolution Strategy
**Chosen**: Timestamp-based with manual resolution option
**Rationale**: When both local and remote changes are detected, use timestamps to determine which is newer, with option for manual resolution.
**Strategy**:
- If local timestamp > remote timestamp: Local wins
- If remote timestamp > local timestamp: Remote wins
- If timestamps equal: Emit conflict event for manual resolution
- Store conflict information for user inspection
**Alternatives Considered**:
- Last-write-wins only: Current behavior, may lose data
- Always local wins: Biased towards client
- Always remote wins: Biased towards server, may lose local changes
- Three-way merge: Complex to implement, requires history

### Decision: Memory Management Approach
**Chosen**: Explicit cleanup with resource tracking
**Rationale**: Prevent resource leaks in long-running applications by explicitly tracking and cleaning up OPFS access handles.
**Implementation**:
- Track all open access handles in a Set
- Add explicit cleanup method
- Auto-cleanup on stop()
- Log warnings for leaked handles
**Alternatives Considered**:
- Garbage collection only: May not catch all leaks
- No tracking: Current behavior, potential leaks

### Decision: Worker Event Forwarding
**Chosen**: Forward all events to main thread via postMessage
**Rationale**: Enable full library functionality when used in Web Worker context by forwarding events back to the main thread.
**Implementation**:
- Wrap event listeners in worker to forward via postMessage
- Include event type and detail in message
- Main thread can listen to worker messages and re-emit as needed
**Alternatives Considered**:
- Limited forwarding: Only forward selected events
- No forwarding: Current behavior, limited worker functionality

### Decision: Google Apps File Error Messages
**Chosen**: Enhance error messages with actionable guidance
**Rationale**: Help users understand why download failed and what they can do about it.
**Error Message**: Include file type, suggest export options, link to documentation
**Implementation**:
- Detect Google Apps mimeType
- Throw descriptive error with context
- Suggest using Google Drive web interface for export
**Alternatives Considered**:
- Simple error: Current behavior, less helpful
- Silent skip: Confusing user experience

## Risks / Trade-offs

### Risk: MD5 Library Size
**Risk**: Bundling SparkMD5 may increase library size
**Mitigation**: SparkMD5 is ~4KB minified, acceptable overhead for reliability
**Likelihood**: Low  
**Impact**: Low

### Risk: Retry Logic Complexity
**Risk**: Adding retry logic may introduce complexity and edge cases
**Mitigation**: Keep retry configuration simple, use sensible defaults, document behavior
**Likelihood**: Medium  
**Impact**: Medium

### Risk: Conflict Resolution Errors
**Risk**: Automated conflict resolution may make wrong decisions
**Mitigation**: Use conservative approach (favor data safety), emit events for ambiguous cases, allow manual override
**Likelihood**: Low  
**Impact**: Medium

### Risk: Memory Tracking Overhead
**Risk**: Resource tracking may add performance overhead
**Mitigation**: Use lightweight tracking (Set of handles), only track in development mode by default
**Likelihood**: Low  
**Impact**: Low

### Risk: Worker Communication Latency
**Risk**: Event forwarding may add latency to worker operations
**Mitigation**: Forward events asynchronously, batch events where possible
**Likelihood**: Low  
**Impact**: Low

## Migration Plan

**For All Consumers**: No migration needed - all changes are backward compatible

**For Library Maintainers**:
1. Add SparkMD5 dependency to package.json
2. Update utils/md5.js to use SparkMD5
3. Add retry configuration options to OpfsCloudFile
4. Implement conflict detection and resolution
5. Add resource tracking for access handles
6. Implement worker event forwarding
7. Enhance Google Apps file error messages

**For Provider Maintainers**: No changes needed for existing providers

## Open Questions

1. **Retry Configuration Scope**: Should retry configuration be global or per-operation?
   - Current: Planning global configuration
   - Consideration: Per-operation may be more flexible

2. **Conflict Storage**: Should conflicts be stored for later resolution?
   - Current: Planning to emit event only
   - Consideration: Store conflict data with metadata for manual resolution

3. **Resource Tracking Mode**: Should resource tracking be enabled by default?
   - Current: Planning development mode only by default
   - Consideration: Always on for production reliability
