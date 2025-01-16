#!/usr/bin/env node

import { promises as fs } from 'fs';
import path from 'path';
import { program } from 'commander';
import { cosmiconfigSync } from 'cosmiconfig';

/**
 * Cosmiconfig explorer for 'vomitorium' configuration.
 * @type {import('cosmiconfig').ExplorerSync}
 */
const explorer = cosmiconfigSync('vomitorium');

/**
 * Default configuration for the script.
 * @type {Object}
 */
const defaultConfig = {
  scan: '.',
  include: [],
  exclude: ['node_modules', '.git', 'dist', 'build'],
  excludeFiles: ['package.json', 'package-lock.json'],
  extensions: ['.js', '.ts', '.json'],
  showExcluded: true,
  showSkipped: true,
  outputFile: 'output.sick',
};

/**
 * Attempt to read and parse JSON config from a file path.
 * Returns null if the file does not exist or is invalid.
 * @param {string} filePath 
 * @returns {Promise<Object|null>}
 */
async function readJsonConfig(filePath) {
  try {
    await fs.access(filePath);
    const contents = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(contents);
  } catch {
    return null;
  }
}

// Define the CLI options.
program
  .option('--config <path>', 'Path to a JSON config file', 'sick.json')
  .option('--scan <dir>', 'Directory to scan. Defaults to current working directory')
  .option('--include <dirs>', 'Comma-separated list of directories to include', (val) => val.split(','))
  .option('--exclude <patterns>', 'Comma-separated list of directories or files to exclude', (val) => val.split(','))
  .option('--extensions <exts>', 'Comma-separated list of file extensions to include', (val) => val.split(','))
  .option('--show-excluded', 'Show excluded files in the output')
  .option('--show-skipped', 'Show skipped files without listing their contents')
  .option('--output <file>', 'Specify the output file name');

program.addHelpText(
  'after',
  `
  Examples:
    $ vomitorium --scan ./myproject --include src,tests
    $ vomitorium --exclude node_modules,dist,package.json --extensions .js,.ts
    $ vomitorium --scan /path/to/project --show-excluded --show-skipped
    $ vomitorium --output my-custom-output.txt
    $ vomitorium --config myconfig.json
`
);

program.parse(process.argv);

(async function main() {
  // 1. Load config from --config (defaulting to sick.json).
  const cliOptions = program.opts();
  const configPath = path.resolve(cliOptions.config); // e.g. "sick.json"
  let fileConfig = await readJsonConfig(configPath);

  // 2. If no config found from that file, fall back to cosmiconfig (vomitorium).
  if (!fileConfig) {
    const cosmicSearch = explorer.search();
    if (cosmicSearch && cosmicSearch.config) {
      fileConfig = cosmicSearch.config;
    }
  }

  // 3. Merge file config (if any) with defaults.
  const mergedConfig = { ...defaultConfig, ...(fileConfig || {}) };

  // 4. Override with CLI if provided.
  const scanDir = cliOptions.scan ?? mergedConfig.scan;
  const includeDirs = cliOptions.include ?? mergedConfig.include;
  const excludePatterns = cliOptions.exclude
    ? [...cliOptions.exclude, ...mergedConfig.excludeFiles]
    : [...mergedConfig.exclude, ...mergedConfig.excludeFiles];
  const includeExtensions = cliOptions.extensions ?? mergedConfig.extensions;
  const showExcluded = typeof cliOptions.showExcluded === 'boolean'
    ? cliOptions.showExcluded
    : mergedConfig.showExcluded;
  const showSkipped = typeof cliOptions.showSkipped === 'boolean'
    ? cliOptions.showSkipped
    : mergedConfig.showSkipped;
  const outputFile = cliOptions.output ?? mergedConfig.outputFile;

  const targetDir = path.resolve(scanDir);
  const outputFilePath = path.join(process.cwd(), outputFile);

  // Ensure the target directory is accessible.
  try {
    await fs.access(targetDir);
  } catch (err) {
    console.error(`Error: Directory "${targetDir}" does not exist or is inaccessible.`);
    process.exit(1);
  }

  // Clear (or create) the output file.
  await fs.writeFile(outputFilePath, '');

  console.log(`Traversing directory: ${targetDir}`);

  await traverseDirectory(targetDir, outputFilePath, {
    includeDirs,
    excludePatterns,
    includeExtensions,
    showExcluded,
    showSkipped,
  });

  console.log(`Done. All file contents written to: ${outputFilePath}`);
})().catch(console.error);

/**
 * Recursively traverses a directory and processes its files.
 * @param {string} dirPath - The path of the directory to traverse.
 * @param {string} outputFilePath - The path of the output file.
 * @param {Object} options - Various options controlling scanning behavior.
 * @returns {Promise<void>}
 */
async function traverseDirectory(dirPath, outputFilePath, options) {
  const { includeDirs, excludePatterns, includeExtensions, showExcluded, showSkipped } = options;
  try {
    const files = await fs.readdir(dirPath, { withFileTypes: true });

    for (const file of files) {
      const fullPath = path.join(dirPath, file.name);

      if (isExcluded(fullPath, excludePatterns)) {
        if (showExcluded) {
          await logSkippedFile(fullPath, outputFilePath, 'Excluded');
        }
        continue;
      }

      if (file.isDirectory()) {
        // If includeDirs is empty, we include all directories.
        // Otherwise, we only recurse if the current path matches one of them.
        if (includeDirs.length === 0 || includeDirs.some((d) => fullPath.includes(d))) {
          await traverseDirectory(fullPath, outputFilePath, options);
        }
      } else {
        const ext = path.extname(file.name);

        if (!includeExtensions.includes(ext)) {
          if (showSkipped) {
            await logSkippedFile(fullPath, outputFilePath, 'Skipped (non-matching extension)');
          }
          continue;
        }

        await processFile(fullPath, outputFilePath);
      }
    }
  } catch (error) {
    console.error(`Error traversing directory ${dirPath}:`, error);
  }
}

/**
 * Checks if a file should be excluded based on the exclude patterns.
 * @param {string} filePath - The path of the file to check.
 * @param {string[]} excludePatterns - The patterns of directories/files to exclude.
 * @returns {boolean} True if the file should be excluded, false otherwise.
 */
function isExcluded(filePath, excludePatterns) {
  const relativePath = path.relative(process.cwd(), filePath);
  return excludePatterns.some((pattern) => {
    // If the pattern appears anywhere in the relative path, or
    // if the filename exactly matches the pattern, we exclude it.
    const test1 = relativePath.includes(pattern);
    const test2 = path.basename(filePath) === pattern;
    return test1 || test2;
  });
}

/**
 * Processes a single file, reading its content and appending it to the output file.
 * @param {string} filePath - The path of the file to process.
 * @param {string} outputFilePath - The path of the output file.
 * @returns {Promise<void>}
 */
async function processFile(filePath, outputFilePath) {
  try {
    const fileContent = await fs.readFile(filePath, 'utf-8');
    const relativePath = path.relative(process.cwd(), filePath);

    await fs.appendFile(
      outputFilePath,
      `\n\n--- File: ${relativePath} ---\n\n${fileContent}\n`
    );
    console.log(`Processed file: ${relativePath}`);
  } catch (error) {
    console.error(`Error processing file ${filePath}:`, error);
  }
}

/**
 * Logs a skipped file to the output file.
 * @param {string} filePath - The path of the skipped file.
 * @param {string} outputFilePath - The path of the output file.
 * @param {string} reason - The reason for skipping the file.
 * @returns {Promise<void>}
 */
async function logSkippedFile(filePath, outputFilePath, reason) {
  const relativePath = path.relative(process.cwd(), filePath);
  await fs.appendFile(
    outputFilePath,
    `\n\n--- File: ${relativePath} ---\n(${reason})\n`
  );
  console.log(`Skipped file: ${relativePath} (${reason})`);
}
