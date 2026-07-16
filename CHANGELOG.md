# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.4] - 2025-11-22

### Added

- Initial release of OpfsCloudFile library
- Support for Google Drive V2 and V3 providers
- Web Worker support for non-blocking file operations
- OPFS synchronous access handle support for high-performance operations
- BaseCloudProvider class for extensible cloud provider support

### Features

- Automatic synchronization between OPFS and cloud storage
- Event-based architecture for local and remote file changes
- MD5 checksum for file integrity verification
- Configurable polling intervals for cloud changes

## [Unreleased]

### Added

- Infrastructure hardening for improved reliability and security
- Comprehensive test coverage with explicit metrics (statements, branches, functions, lines at 80% minimum)
- OPFS mock implementations for test environment
- Entry point validation scripts
- Package contents validation
- Version consistency checks in publish workflow
- CHANGELOG.md requirement enforcement

### Changed

- Clarified prerelease versions are OPTIONAL
- Clarified CHANGELOG.md is REQUIRED for releases
- Clarified version tag must match package.json version exactly
- Updated Jest configuration with explicit coverage thresholds
- Added OPFS mock setup for test environment

### Security

- Added credential detection in pre-publish validation
- Implemented fail-closed behavior for publishing workflow
- Configured CI/CD to mask credentials in logs
- Prohibited actual npm publish for verification (dry-run only)

---

**Note**: This changelog is REQUIRED for all releases. Pre-release versions (alpha, beta, rc) are OPTIONAL and not mandatory for the release workflow.
