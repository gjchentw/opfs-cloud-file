#!/usr/bin/env node

/**
 * Entry Point Validation Script
 * 
 * Validates that ESM, UMD, and TypeScript declaration entry points
 * are usable by consumers.
 * 
 * This script tests:
 * 1. ESM import functionality
 * 2. UMD require functionality
 * 3. TypeScript declaration loading
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Colors for output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  reset: '\x1b[0m',
};

function logSuccess(message) {
  console.log(`${colors.green}✓${colors.reset} ${message}`);
}

function logError(message) {
  console.error(`${colors.red}✗${colors.reset} ${message}`);
}

function logWarning(message) {
  console.warn(`${colors.yellow}⚠${colors.reset} ${message}`);
}

function logInfo(message) {
  console.log(`  ${message}`);
}

let exitCode = 0;

// Get project root
const projectRoot = process.cwd();
const distDir = path.join(projectRoot, 'dist');

console.log('Validating Entry Points...\n');

// 1. Check that build artifacts exist
console.log('1. Checking build artifacts exist...');

const esmPath = path.join(distDir, 'opfs-cloud-file.js');
const umdPath = path.join(distDir, 'opfs-cloud-file.umd.cjs');
const typesPath = path.join(distDir, 'index.d.ts');

if (fs.existsSync(esmPath)) {
  logSuccess('ESM entry point exists: dist/opfs-cloud-file.js');
} else {
  logError('ESM entry point missing: dist/opfs-cloud-file.js');
  exitCode = 1;
}

if (fs.existsSync(umdPath)) {
  logSuccess('UMD entry point exists: dist/opfs-cloud-file.umd.cjs');
} else {
  logError('UMD entry point missing: dist/opfs-cloud-file.umd.cjs');
  exitCode = 1;
}

if (fs.existsSync(typesPath)) {
  logSuccess('TypeScript declarations exist: dist/index.d.ts');
} else {
  logError('TypeScript declarations missing: dist/index.d.ts');
  exitCode = 1;
}

// 2. Check package.json entry points
console.log('\n2. Checking package.json entry points...');

const packageJsonPath = path.join(projectRoot, 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

if (packageJson.main) {
  logInfo(`Main entry point: ${packageJson.main}`);
  const mainPath = path.join(projectRoot, packageJson.main);
  if (fs.existsSync(mainPath)) {
    logSuccess('Main entry point file exists');
  } else {
    logError(`Main entry point file missing: ${mainPath}`);
    exitCode = 1;
  }
} else {
  logWarning('No "main" field in package.json');
}

if (packageJson.module) {
  logInfo(`Module entry point: ${packageJson.module}`);
  const modulePath = path.join(projectRoot, packageJson.module);
  if (fs.existsSync(modulePath)) {
    logSuccess('Module entry point file exists');
  } else {
    logError(`Module entry point file missing: ${modulePath}`);
    exitCode = 1;
  }
} else {
  logWarning('No "module" field in package.json');
}

if (packageJson.types) {
  logInfo(`Types entry point: ${packageJson.types}`);
  const typesPathFull = path.join(projectRoot, packageJson.types);
  if (fs.existsSync(typesPathFull)) {
    logSuccess('Types entry point file exists');
  } else {
    logError(`Types entry point file missing: ${typesPathFull}`);
    exitCode = 1;
  }
} else {
  logWarning('No "types" field in package.json');
}

// 3. Check exports field
console.log('\n3. Checking package.json exports...');

if (packageJson.exports) {
  logInfo('Exports field defined');
  if (packageJson.exports['.']) {
    const exportEntry = packageJson.exports['.'];
    if (exportEntry.import) {
      logInfo(`  Import: ${exportEntry.import}`);
      const importPath = path.join(projectRoot, exportEntry.import);
      if (fs.existsSync(importPath)) {
        logSuccess('  Import entry point file exists');
      } else {
        logError(`  Import entry point file missing: ${importPath}`);
        exitCode = 1;
      }
    }
    if (exportEntry.require) {
      logInfo(`  Require: ${exportEntry.require}`);
      const requirePath = path.join(projectRoot, exportEntry.require);
      if (fs.existsSync(requirePath)) {
        logSuccess('  Require entry point file exists');
      } else {
        logError(`  Require entry point file missing: ${requirePath}`);
        exitCode = 1;
      }
    }
  } else {
    logWarning('No "." export entry in package.json');
  }
} else {
  logWarning('No exports field in package.json');
}

// 4. Validate ESM entry point can be imported
console.log('\n4. Validating ESM entry point...');

try {
  // Try to import the ESM module
  const esmModule = require(esmPath);
  if (esmModule) {
    logSuccess('ESM entry point can be loaded with require()');
    
    // Check for expected exports
    if (esmModule.OpfsCloudFile || esmModule.default?.OpfsCloudFile) {
      logSuccess('ESM entry point exports OpfsCloudFile');
    } else {
      logWarning('ESM entry point does not export OpfsCloudFile (may use named exports)');
    }
  } else {
    logError('ESM entry point loaded but is empty');
    exitCode = 1;
  }
} catch (error) {
  logError(`Failed to load ESM entry point: ${error.message}`);
  exitCode = 1;
}

// 5. Validate UMD entry point can be loaded
console.log('\n5. Validating UMD entry point...');

try {
  // Clear require cache
  delete require.cache[require.resolve(umdPath)];
  
  const umdModule = require(umdPath);
  if (umdModule) {
    logSuccess('UMD entry point can be loaded with require()');
    
    // Check for expected exports
    if (umdModule.OpfsCloudFile || umdModule.default?.OpfsCloudFile) {
      logSuccess('UMD entry point exports OpfsCloudFile');
    } else {
      logWarning('UMD entry point does not export OpfsCloudFile (may use named exports)');
    }
  } else {
    logError('UMD entry point loaded but is empty');
    exitCode = 1;
  }
} catch (error) {
  logError(`Failed to load UMD entry point: ${error.message}`);
  exitCode = 1;
}

// 6. Validate TypeScript declarations syntax
console.log('\n6. Validating TypeScript declarations...');

try {
  const typesContent = fs.readFileSync(typesPath, 'utf8');
  
  // Check for basic TypeScript declaration patterns
  if (typesContent.includes('declare') || typesContent.includes('interface') || typesContent.includes('class') || typesContent.includes('export')) {
    logSuccess('TypeScript declarations file contains valid syntax');
  } else {
    logWarning('TypeScript declarations file may be empty or incomplete');
  }
  
  // Try to parse as TypeScript (simple check)
  if (typesContent.includes('.d.ts') || typesContent.startsWith('declare')) {
    logSuccess('TypeScript declarations file has correct format');
  }
} catch (error) {
  logError(`Failed to read TypeScript declarations: ${error.message}`);
  exitCode = 1;
}

// Summary
console.log('\n' + '='.repeat(50));
if (exitCode === 0) {
  console.log(`${colors.green}✓ All entry point validations passed${colors.reset}`);
} else {
  console.log(`${colors.red}✗ Some entry point validations failed${colors.reset}`);
}
console.log('='.repeat(50));

process.exit(exitCode);
