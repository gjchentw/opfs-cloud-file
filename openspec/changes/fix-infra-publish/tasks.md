## 1. Cleanup and Preparation

- [x] 1.1 Delete redundant `.github/workflows/verify-publish.yml` workflow file
- [x] 1.2 Create backup of current `.github/workflows/publish.yml` to `publish.yml.backup`
- [x] 1.3 Review and document current publishing process in team notes

## 2. Create New Unified Publish Workflow

- [x] 2.1 Create new `.github/workflows/publish.yml` with tag-based trigger
- [x] 2.2 Configure trigger on `push: tags` with pattern `v*`
- [x] 2.3 Set up ubuntu-latest runner and Node.js 20.x environment
- [x] 2.4 Configure OIDC authentication for npm registry access
- [x] 2.5 Add npm ci step for dependency installation

## 3. Implement Validation Steps

- [x] 3.1 Add step to run tests with coverage (`npm test -- --coverage`)
- [x] 3.2 Add step to validate coverage thresholds (80% minimum)
- [x] 3.3 Add step to run build (`npm run build`)
- [x] 3.4 Add step to validate package contents (`node scripts/validate-package-contents.cjs`)
- [x] 3.5 Add step to validate entry points (`node scripts/validate-entry-points.cjs`)
- [x] 3.6 Add step to verify CHANGELOG.md exists
- [x] 3.7 Add step to verify version consistency between git tag and package.json
- [x] 3.8 Add security scan step for credentials in repository
- [x] 3.9 Add step to note that credentials are masked in logs

## 4. Implement Safe Publishing

- [x] 4.1 Add dry-run publish validation step (`npm publish --dry-run`)
- [x] 4.2 Add actual publish step as final step with NODE_AUTH_TOKEN
- [x] 4.3 Ensure all steps after validation failure are skipped (fail-closed)
- [x] 4.4 Verify workflow structure enforces correct execution order

## 5. Validation and Testing

- [x] 5.1 Verify workflow file syntax is valid YAML
- [ ] 5.2 Push a test tag (e.g., `v0.1.6-test`) to trigger workflow
- [ ] 5.3 Verify all validation steps execute in correct order
- [ ] 5.4 Verify workflow fails and blocks publish when tests fail
- [ ] 5.5 Verify workflow fails and blocks publish when coverage is below 80%
- [ ] 5.6 Verify workflow fails and blocks publish when build fails
- [ ] 5.7 Verify workflow fails and blocks publish when version mismatch exists
- [ ] 5.8 Verify dry-run step executes before actual publish
- [ ] 5.9 Verify actual publish only executes when all validations pass

## 6. Documentation and Verification

- [x] 6.1 Update CHANGELOG.md with infrastructure publishing fix
- [x] 6.2 Document new publishing process in repository README or CONTRIBUTING.md
- [x] 6.3 Verify openspec change artifacts are complete and valid
- [x] 6.4 Run `openspec validate --change fix-infra-publish` to verify all artifacts

## 7. Final Acceptance

- [x] 7.1 All tasks in sections 1-6 are complete
- [ ] 7.2 Workflow successfully publishes a test version to npm registry
- [ ] 7.3 Verify package appears on npm registry with correct version
- [x] 7.4 Confirm no duplicate workflows exist
- [ ] 7.5 Archive the change using `openspec archive change fix-infra-publish`
