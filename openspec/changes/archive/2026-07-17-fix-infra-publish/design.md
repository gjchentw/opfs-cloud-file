# Design: Fix Infrastructure Publish

## Context

### Current State
The project has two GitHub Actions workflows for publishing:
- `publish.yml`: Triggers on `release: created`, performs validations, then executes `npm publish`
- `verify-publish.yml`: Triggers on `workflow_dispatch` or PR to main, performs validations with `npm publish --dry-run`

Both workflows perform similar validation steps but have different triggers and final actions. The `publish.yml` workflow violates the Safe Publishing requirement by using actual `npm publish` instead of dry-run.

### Governing Specification
The infrastructure specification (`openspec/specs/infrastructure/spec.md`) defines strict requirements:
- **CI/CD Pipeline** (166-222): Must trigger publish on version tags
- **Release Management** (276-341): Must follow semver, publish to npm registry
- **Safe Publishing** (593-626): MUST NEVER use actual `npm publish` for verification
- **Release Validation** (527-590): MUST validate tests, coverage, build, and package contents before publish

### Constraints
- Must maintain OIDC authentication for npm registry access
- Must preserve existing validation scripts
- Must support semantic versioning tag pattern (`v*`)
- Must enforce fail-closed behavior (no partial publishing)
- Must use Node.js 24.x (Node.js 20 is deprecated on GitHub Actions runners)

## Goals / Non-Goals

### Goals
- Achieve 100% compliance with infrastructure specification
- Consolidate duplicate validation logic into single workflow
- Implement fail-closed publishing behavior
- Trigger publishing on semantic version tag pushes
- Maintain all existing pre-publish validation checks

### Non-Goals
- Change the npm package name or ownership
- Modify package.json structure or scripts (except as needed for compliance)
- Add new validation checks beyond those specified
- Change the authentication mechanism (OIDC remains)

## Decisions

### Decision 1: Single Unified Workflow
**Chosen**: Consolidate `publish.yml` and `verify-publish.yml` into a single `publish.yml` workflow.

**Rationale**: 
- Eliminates redundancy and maintenance overhead
- Ensures consistent validation logic across all publishing paths
- Simplifies the CI/CD configuration
- The existing `verify-publish.yml` can be removed as its functionality is subsumed

**Alternatives Considered**:
- Keep both workflows: Creates potential for divergence and confusion
- Rename and restructure: Adds complexity without clear benefit

### Decision 2: Trigger on Tag Push
**Chosen**: Change trigger from `release: created` to `push: tags` with pattern `v*`.

**Rationale**:
- Aligns with specification requirement (215-217): "Publish workflow executes on release" meaning version tag push
- Semantic version tags (`v1.0.0`, `v1.2.3-alpha.1`) are the standard for npm publishing
- GitHub releases are a separate concept from version tags
- Maintains compatibility with existing tag-based release process

**Alternatives Considered**:
- Keep `release: created`: Does not match specification requirement
- Trigger on both: Unnecessary complexity

### Decision 3: Fail-Closed Publishing
**Chosen**: Implement fail-closed behavior where any validation failure blocks publication completely.

**Rationale**:
- Explicitly required by Security Boundaries requirement (477-514)
- Ensures no partial or accidental publishing
- Each validation step must pass before proceeding to next
- Final publish step only executes if all validations pass

**Implementation**: Use workflow step dependencies - if any step fails, subsequent steps are skipped.

### Decision 4: Validation Order
**Chosen**: Execute validations in this order:
1. Run tests with coverage
2. Validate coverage thresholds
3. Run build
4. Validate package contents
5. Validate entry points
6. Verify CHANGELOG.md exists
7. Verify version consistency
8. Security scan for credentials
9. Dry-run publish validation
10. Actual publish (only if all above pass)

**Rationale**:
- Matches Release Validation requirement (527-590) which lists tests, coverage, build, package validation
- Logical progression from fastest to slowest operations
- Security checks before any publishing action
- Dry-run as final verification before actual publish

### Decision 5: Remove verify-publish.yml
**Chosen**: Delete `verify-publish.yml` and migrate its validation logic to `publish.yml`.

**Rationale**:
- The dry-run validation from verify-publish.yml can be a step in publish.yml
- Manual verification can be achieved by pushing a test tag
- Reduces workflow count and maintenance burden
- Single source of truth for publishing logic

### Decision 6: Node.js Version Update to 24.x
**Chosen**: Update all workflows and specifications from Node.js 20.x to Node.js 24.x.

**Rationale**:
- GitHub Actions has deprecated Node.js 20 on their runners (as of 2025-09-19)
- Workflows using Node.js 20 are forced to run on Node.js 24, causing version mismatches
- Node.js 24 is the current LTS and recommended version for GitHub Actions
- Ensures compatibility with current GitHub Actions infrastructure
- Reference: https://github.blog/changelog/2025-09-19-deprecation-of-node-20-on-github-actions-runners/

**Implementation**: Update node-version from '20.x' to '24.x' in:
- `.github/workflows/publish.yml`
- `.github/workflows/test.yml`
- `.github/workflows/build.yml`
- Infrastructure specification (`openspec/specs/infrastructure/spec.md`)

**Alternatives Considered**:
- Keep Node.js 20: Will cause deprecation warnings and may break in future
- Use Node.js 22: Intermediate version, but 24 is current LTS

## Risks / Trade-offs

### Risk: Trigger Mechanism Change
**Risk**: Changing from `release: created` to `push: tags` may break existing release processes that rely on GitHub releases.
**Mitigation**: Document the change; GitHub releases can still be created manually after tag push; the tag push is the authoritative trigger.

### Risk: Workflow Consolidation Complexity
**Risk**: Combining two workflows into one may create a complex workflow file that is harder to maintain.
**Mitigation**: Use clear step naming and comments; group related steps; consider breaking into jobs if it exceeds ~100 lines.

### Risk: Dry-Run vs Actual Publish
**Risk**: The specification requires dry-run for verification but actual publish for release. Need to ensure the workflow correctly handles both.
**Mitigation**: The actual `npm publish` is only executed as the final step after all validations pass; dry-run can be a separate validation step or the workflow can use a condition to determine if it's a real publish or verification.

### Risk: Credential Exposure
**Risk**: The workflow uses `NODE_AUTH_TOKEN` secret for publishing. If validation steps fail, the secret is still exposed in logs.
**Mitigation**: This is inherent to GitHub Actions; the specification's Safe Publishing requirement is about not using actual publish for verification, which we address by ensuring validation steps don't perform actual publish.

### Risk: Node.js 24 Compatibility
**Risk**: Project dependencies or code may not be fully compatible with Node.js 24.x, causing build or test failures.
**Mitigation**: Test project on Node.js 24 locally before deploying to CI/CD. All dependencies should be compatible with Node.js 24 as it's the current LTS. If issues are found, update dependencies or polyfill as needed.

## Migration Plan

### Phase 1: Preparation
1. Create backup of current workflows
2. Document current publishing process
3. Notify stakeholders of upcoming changes

### Phase 2: Implementation
1. Create new unified `publish.yml` with corrected trigger and validation logic
2. Update all workflows (`publish.yml`, `test.yml`, `build.yml`) to use Node.js 24.x
3. Update infrastructure specification to reference Node.js 24.x
4. Delete `verify-publish.yml`
5. Commit changes to repository

### Phase 3: Validation
1. Push a test tag (e.g., `v0.1.6-test`) to verify workflow triggers correctly
2. Verify all validation steps execute in correct order
3. Verify workflow blocks on validation failure
4. Verify successful publish on all validations passing

### Rollback Strategy
If issues are detected:
1. Revert the commit containing workflow changes
2. Restore `verify-publish.yml` from backup
3. Investigate and fix issues
4. Re-attempt migration

## Open Questions

1. Should we maintain a separate manual verification workflow for testing purposes, or is the unified approach sufficient?
2. How should pre-release versions (alpha, beta, rc) be handled - should they use a different workflow or the same workflow with different tag patterns?
3. Should the workflow support publishing to a test registry for validation before production npm registry?
