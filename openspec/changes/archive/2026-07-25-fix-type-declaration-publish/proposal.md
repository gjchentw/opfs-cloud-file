# Proposal: Fix Type Declaration Publish

**Change Name**: fix-type-declaration-publish  
**Created**: 2026-07-25  
**Status**: Approved  
**Version**: 1.0.0  
**Implementation Commit**: c6b76e3  
**Tag**: v0.1.6  

---

## 1. Problem Statement

Type declarations for the `opfs-cloud-file` package are not being published correctly. When consumers import the package in TypeScript projects, type information is unavailable, leading to poor developer experience and lack of IDE autocompletion.

### 1.1 Current Behavior

- The package.json `exports` field does not include a `types` entry
- The `vite-plugin-dts` plugin is enabled but not configured correctly
- Type declaration files are not being copied to the `dist/` directory during build
- Consumers cannot access type definitions when importing the package

### 1.2 Impact

- **Developer Experience**: TypeScript consumers lose IDE autocompletion and type checking
- **Type Safety**: Applications using the package cannot leverage TypeScript's type system
- **Adoption**: Reduced likelihood of adoption by TypeScript-based projects

---

## 2. Proposed Solution

Implement proper TypeScript type declaration publishing by:

1. Adding explicit `types` entry to the `exports` field in package.json
2. Copying type declaration files to the build output directory
3. Disabling `vite-plugin-dts` which is not generating correct declarations

---

## 3. Acceptance Criteria

- [x] Type declarations MUST be available when package is imported in TypeScript projects
- [x] IDE autocompletion MUST work for package exports
- [x] `npm install opfs-cloud-file` MUST include type declaration files
- [x] Build process MUST successfully generate and copy type declarations

---

## 4. Stakeholders

| Role | Description |
|------|-------------|
| Package Consumers | TypeScript developers using opfs-cloud-file |
| Maintainers | Project maintainers responsible for package publishing |
| CI/CD Pipeline | Automated build and publish workflows |

---

## 5. Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Build process fails | Low | High | Test build locally before publishing |
| Type declarations incomplete | Medium | Medium | Verify all exports have corresponding types |
| Breaking changes for consumers | Low | Low | Changes are additive only |

---

## 6. Dependencies

- No external dependencies required
- Uses existing build toolchain (Vite, TypeScript)
- Requires `index.d.ts` file to exist at project root

---

## 7. Out of Scope

- Creating new type declarations (existing index.d.ts is sufficient)
- Modifying TypeScript compiler configuration
- Updating consumer projects
- Automating type declaration generation beyond current approach

---

## 8. References

- [TypeScript Package Type Declarations](https://www.typescriptlang.org/docs/handbook/declaration-files/publishing.html)
- [Node.js Package Exports](https://nodejs.org/api/packages.html#packages_package_entry_points)
- Implementation: [`c6b76e3`](https://github.com/gjchentw/opfs-cloud-file/commit/c6b76e3edf9c0245030ded5588d45448ff6c4dc0)
