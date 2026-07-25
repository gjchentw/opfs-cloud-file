# Proposal: Fix Infrastructure Publish

## Why

The current GitHub Actions publish workflow (`publish.yml`) contains critical compliance violations with the infrastructure specification defined in `openspec/specs/infrastructure/spec.md`. Specifically:

1. **Trigger Mechanism Misalignment**: The workflow triggers on `release: created` event, but the specification requires publishing when semantic version tags are pushed (requirements 215-217, 334-336, 636).

2. **Safe Publishing Violation**: The workflow executes actual `npm publish` command (line 77 in publish.yml), which violates the Safe Publishing requirement (593-626) that mandates verification systems SHALL NEVER use actual `npm publish` and SHALL use only `npm publish --dry-run` for validation purposes.

3. **Workflow Redundancy**: Both `publish.yml` and `verify-publish.yml` perform similar pre-publish validations, creating maintenance overhead and potential for inconsistency.

4. **Incomplete Pre-Publish Validation**: The current workflow does not fully implement all validation checks required by the Release Validation requirement (527-590), particularly the comprehensive coverage of all four mandatory checks (tests, coverage, build, package contents).

5. **Node.js Version Deprecation**: GitHub Actions has deprecated Node.js 20 on their runners, forcing workflows to run on Node.js 24. The infrastructure specification and workflows must be updated to use Node.js 24.x to avoid compatibility issues.

This change is required to bring the implementation into compliance with the governing infrastructure specification and ensure reliable, secure package publishing on current GitHub Actions runners.

## What Changes

- **Modified Capabilities**: `infrastructure` - Update CI/CD Pipeline Configuration to trigger on semantic version tag pushes instead of GitHub release creation
- **Modified Capabilities**: `infrastructure` - Update CI/CD Pipeline Configuration to use Node.js 24.x instead of deprecated Node.js 20.x
- **Modified Capabilities**: `infrastructure` - Update Safe Publishing implementation to enforce fail-closed behavior and prevent actual publish during verification
- **Modified Capabilities**: `infrastructure` - Consolidate publish and verify-publish workflows into a single, compliant publishing workflow
- **Modified Capabilities**: `infrastructure` - Enhance Release Validation to include all four mandatory pre-publish checks in the correct order
- **Modified Capabilities**: `infrastructure` - Update Testing System Configuration to use Node.js 24.x environment

**BREAKING**: None - These are infrastructure-only changes that do not affect the public API, consumer code, or package behavior.

## Capabilities

### New Capabilities
None - This change modifies existing infrastructure capability only.

### Modified Capabilities
- `infrastructure`: Update CI/CD Pipeline Configuration (sections 166-222, 174) to fix publish workflow trigger mechanism and use Node.js 24.x
- `infrastructure`: Update Safe Publishing requirements (sections 593-626) to enforce dry-run only verification in CI/CD workflows
- `infrastructure`: Update Release Validation (sections 527-590) to ensure all four mandatory checks are performed before publication
- `infrastructure`: Update Release Management (sections 276-341) to ensure version consistency between git tags and package.json
- `infrastructure`: Update Testing System Configuration (sections 51-66, 58) to use Node.js 24.x environment

## Impact

- **Files Modified**: `.github/workflows/publish.yml`, `.github/workflows/test.yml`, `.github/workflows/build.yml`
- **Files Deleted**: `.github/workflows/verify-publish.yml` (consolidated into publish.yml)
- **Files Referenced**: `package.json` (prepublishOnly script), `CHANGELOG.md`, `scripts/validate-entry-points.cjs`, `scripts/validate-package-contents.cjs`
- **Dependencies**: npm registry access, GitHub Actions OIDC authentication, Node.js 24.x
- **Systems**: CI/CD pipeline, npm publishing workflow
- **Related Specs**: `openspec/specs/infrastructure/spec.md` (multiple sections)
