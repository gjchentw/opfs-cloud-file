# Publishing Process Documentation

## Current State (Before fix-infra-publish)

### Workflows
- **`publish.yml`**: Triggers on `release: created` event
  - Sets up Node.js 20.x with npm registry URL
  - Runs `npm ci`
  - Runs build (`npm run build --if-present`)
  - Runs tests with coverage (`npm test -- --coverage`)
  - Validates coverage thresholds
  - Validates package contents (`node scripts/validate-package-contents.cjs`)
  - Validates entry points (`node scripts/validate-entry-points.cjs`)
  - Verifies CHANGELOG.md exists
  - Verifies version consistency between tag and package.json
  - Security scan for credentials
  - **Publishes to npm registry** (actual `npm publish`)
  
- **`verify-publish.yml`** (DELETED as part of fix-infra-publish): 
  - Triggered on `workflow_dispatch` or PR to main
  - Similar validation steps but used `npm publish --dry-run`

### Trigger Mechanism
- Uses GitHub Release creation as trigger
- Requires creating a GitHub Release to trigger publishing

### Issues Identified
1. Trigger does not match semver tag push pattern
2. Uses actual `npm publish` in verification context
3. Redundant workflow with similar logic
4. Does not enforce fail-closed behavior consistently

---

## Target State (After fix-infra-publish)

### Unified Workflow
- Single `publish.yml` workflow
- Triggers on `push: tags` with pattern `v*`
- All validations in correct order
- Dry-run as validation step
- Actual publish only as final step after all validations pass

### Validation Order
1. Run tests with coverage
2. Validate coverage thresholds (80%+)
3. Run build
4. Validate package contents
5. Validate entry points
6. Verify CHANGELOG.md exists
7. Verify version consistency
8. Security scan
9. Dry-run publish
10. Actual publish (if all pass)

### Compliance
- Matches infrastructure spec requirements
- Safe publishing enforced
- Fail-closed behavior guaranteed
- No redundant workflows

---

*Document created: 2026-07-17*
*Related change: fix-infra-publish*
