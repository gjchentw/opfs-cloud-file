#!/usr/bin/env node

/**
 * Package Contents Validation Script
 * 
 * Validates that package contents are valid before publication:
 * - No error files (logs, crash dumps, etc.)
 * - No sensitive files (credentials, keys, etc.)
 * - No unnecessary files (devDependencies, build artifacts, etc.)
 */

const fs = require('fs');
const path = require('path');

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

console.log('Validating Package Contents...\n');

// Error file patterns (logs, crash dumps, error reports)
const errorPatterns = [
  /\.err$/i,
  /\.log$/i,
  /crash\.dmp$/i,
  /core\.dump$/i,
  /error\.log$/i,
  /stacktrace\.txt$/i,
  /\.stack$/i,
];

// Sensitive file patterns (credentials, keys, secrets)
const sensitivePatterns = [
  /\.env$/i,
  /\.env\./i,
  /\.pem$/i,
  /\.key$/i,
  /\.crt$/i,
  /\.cer$/i,
  /credentials\.json$/i,
  /secrets\.json$/i,
  /config\.json$/i,
  /\.private$/i,
  /id_rsa$/i,
  /id_ed25519$/i,
  /auth\.json$/i,
  /tokens\.json$/i,
];

// Sensitive content patterns (scan file contents)
// Only look for actual credential values, not variable names in code
const sensitiveContentPatterns = [
  // Actual AWS keys (with realistic values)
  /AKIA[0-9A-Z]{16}/,
  /[a-zA-Z0-9\/+]{40}/,
  // Base64 encoded secrets
  /eyJ[0-9a-zA-Z\-_]+\.[0-9a-zA-Z\-_]+\.[0-9a-zA-Z\-_]+/,
  // Actual password strings (with quotes)
  /["'][^"']*password[^"']*["']/i,
  // Actual secret strings (with quotes)
  /["'][^"']*secret[^"']*["']/i,
  // API keys in quotes
  /["']sk-[0-9a-zA-Z]{20,}["']/i,
  /["']pk-[0-9a-zA-Z]{20,}["']/i,
];

// Unnecessary file patterns (should not be in published package)
const unnecessaryPatterns = [
  /^\.git$/,
  /^\.github$/,
  /^\.vscode$/,
  /^\.nyc_output$/,
  /^coverage$/,
  /^dist$/,
  /^node_modules$/,
  /^openspec$/,
  /^\.DS_Store$/,
  /^\.idea$/,
  /^\.vibe$/,
  /\.test\.js$/i,
  /\.spec\.js$/i,
  /babel\.config\.json$/i,
  /jest\.config\.cjs$/i,
  /vite\.config\.js$/i,
  /tsconfig\.json$/i,
  /\.eslintrc/,
  /\.prettierrc/,
  /\.gitignore$/,
  /\.npmrc$/,
  /package\-lock\.json$/,
  /CHANGELOG\.md$/,
  /README\.md$/,
  /LICENSE$/,
  /\.editorconfig$/,
];

// Scan a directory for problematic files
function scanDirectory(dirPath, relativePath = '') {
  const files = fs.readdirSync(dirPath);
  
  for (const file of files) {
    const fullPath = path.join(dirPath, file);
    const fullRelativePath = relativePath ? `${relativePath}/${file}` : file;
    
    try {
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        // Skip node_modules
        if (file === 'node_modules') {
          continue;
        }
        scanDirectory(fullPath, fullRelativePath);
      } else if (stat.isFile()) {
        // Check for error files
        for (const pattern of errorPatterns) {
          if (pattern.test(file)) {
            logError(`Error file found: ${fullRelativePath}`);
            exitCode = 1;
            break;
          }
        }
        
        // Check for sensitive files by name
        for (const pattern of sensitivePatterns) {
          if (pattern.test(file)) {
            logError(`Sensitive file found: ${fullRelativePath}`);
            exitCode = 1;
            break;
          }
        }
        
        // Check for unnecessary files
        for (const pattern of unnecessaryPatterns) {
          if (pattern.test(fullRelativePath)) {
            logError(`Unnecessary file found: ${fullRelativePath}`);
            exitCode = 1;
            break;
          }
        }
        
        // Check file contents for sensitive information
        // Only check text files
        if (file.endsWith('.json') || file.endsWith('.js') || file.endsWith('.ts') || 
            file.endsWith('.md') || file.endsWith('.txt') || file.endsWith('.yml') || 
            file.endsWith('.yaml') || file.endsWith('.env')) {
          try {
            const content = fs.readFileSync(fullPath, 'utf8');
            for (const pattern of sensitiveContentPatterns) {
              if (pattern.test(content)) {
                logError(`Sensitive content found in: ${fullRelativePath}`);
                exitCode = 1;
                break;
              }
            }
          } catch (error) {
            // Skip binary files
          }
        }
      }
    } catch (error) {
      // Skip files we can't read
    }
  }
}

// Step 1: Check if package.json exists
console.log('1. Checking package.json...');

const packageJsonPath = path.join(projectRoot, 'package.json');
if (!fs.existsSync(packageJsonPath)) {
  logError('package.json not found');
  process.exit(1);
}

const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
logSuccess('package.json exists');

// Step 2: Check files field in package.json
console.log('\n2. Checking package.json files field...');

if (packageJson.files) {
  logInfo(`Files to include: ${JSON.stringify(packageJson.files)}`);
  
  // Validate that files patterns are reasonable
  const validPatterns = packageJson.files.filter(f => 
    !f.includes('*') || f.startsWith('dist/') || f.startsWith('lib/')
  );
  
  if (validPatterns.length > 0) {
    logSuccess('Files field configured');
  } else {
    logWarning('Files field may be too permissive');
  }
} else {
  logWarning('No files field in package.json - all files will be published');
}

// Step 3: Determine what would be published
console.log('\n3. Determining files to be published...');

// Get files that would be published based on package.json files field
let filesToPublish = [];
if (packageJson.files) {
  filesToPublish = packageJson.files;
} else {
  // If no files field, everything would be published (except .npmignore)
  logWarning('No files field in package.json - defaulting to dist/');
  filesToPublish = ['dist'];
}

// Step 4: Scan only the files that would be published
console.log('\n4. Scanning files to be published...');

for (const filePattern of filesToPublish) {
  // For now, only scan dist directory which is the main published content
  if (filePattern === 'dist' || filePattern.startsWith('dist/')) {
    const distDir = path.join(projectRoot, 'dist');
    if (fs.existsSync(distDir)) {
      scanDirectory(distDir, 'dist');
      if (exitCode === 0) {
        logSuccess('No problematic files found in dist/');
      }
    } else {
      logWarning(`Directory not found: ${filePattern}`);
    }
  } else if (filePattern === 'README.md' || filePattern === 'LICENSE.md') {
    // These are documentation files, just check they exist
    const filePath = path.join(projectRoot, filePattern);
    if (fs.existsSync(filePath)) {
      logSuccess(`Documentation file exists: ${filePattern}`);
    } else {
      logWarning(`Documentation file missing: ${filePattern}`);
    }
  }
}

// Step 5: Check for common sensitive files in root that would be published
console.log('\n5. Checking root for files that would be published...');

// Only check files that are in the files field of package.json
if (packageJson.files) {
  for (const filePattern of packageJson.files) {
    if (!filePattern.includes('/') && !filePattern.includes('*')) {
      // Simple filename pattern
      const filePath = path.join(projectRoot, filePattern);
      if (fs.existsSync(filePath)) {
        const stat = fs.statSync(filePath);
        if (stat.isFile()) {
          // Check file name patterns
          for (const pattern of sensitivePatterns) {
            if (pattern.test(filePattern)) {
              logError(`Sensitive file would be published: ${filePattern}`);
              exitCode = 1;
              break;
            }
          }
          for (const pattern of errorPatterns) {
            if (pattern.test(filePattern)) {
              logError(`Error file would be published: ${filePattern}`);
              exitCode = 1;
              break;
            }
          }
        }
      }
    }
  }
}

// Step 6: Check for files that should not be published
console.log('\n6. Checking for files that should not be published...');

if (fs.existsSync(path.join(projectRoot, 'package-lock.json'))) {
  // Check if package-lock.json is in .npmignore
  const npmignorePath = path.join(projectRoot, '.npmignore');
  if (fs.existsSync(npmignorePath)) {
    const npmignore = fs.readFileSync(npmignorePath, 'utf8');
    if (npmignore.includes('package-lock.json')) {
      logSuccess('package-lock.json is in .npmignore');
    } else {
      logWarning('package-lock.json exists but not in .npmignore');
    }
  } else {
    logWarning('package-lock.json exists - consider adding to .npmignore');
  }
}

if (fs.existsSync(path.join(projectRoot, 'node_modules'))) {
  // node_modules should not be published, but it's a warning not an error
  // since it's typically excluded by default
  logWarning('node_modules exists - will be excluded by npm publish');
}

// Summary
console.log('\n' + '='.repeat(50));
if (exitCode === 0) {
  console.log(`${colors.green}✓ All package content validations passed${colors.reset}`);
} else {
  console.log(`${colors.red}✗ Some package content validations failed${colors.reset}`);
}
console.log('='.repeat(50));

process.exit(exitCode);
