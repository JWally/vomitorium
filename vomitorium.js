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
    outputFile: 'output.sick'
};

// Read config from file or use default
const configFile = explorer.search();
const config = configFile ? { ...defaultConfig, ...configFile.config } : defaultConfig;

// Command-line options
program
    .option('--scan <dir>', 'Directory to scan. Defaults to current working directory', config.scan)
    .option('--include <dirs>', 'Comma-separated list of directories to include', (val) => val.split(','))
    .option('--exclude <patterns>', 'Comma-separated list of directories or files to exclude', (val) => val.split(','))
    .option('--extensions <exts>', 'Comma-separated list of file extensions to include', (val) => val.split(','))
    .option('--show-excluded', 'Show excluded files in the output', config.showExcluded)
    .option('--show-skipped', 'Show skipped files without listing their contents', config.showSkipped)
    .option('--output <file>', 'Specify the output file name', config.outputFile);

program.addHelpText('after', `
  Examples:
    $ vomitorium --scan ./myproject --include src,tests
    $ vomitorium --exclude node_modules,dist,package.json --extensions .js,.ts
    $ vomitorium --scan /path/to/project --show-excluded --show-skipped
    $ vomitorium --output my-custom-output.txt
  `);

program.parse(process.argv);

const options = program.opts();
const scanDir = options.scan || config.scan;
const includeDirs = options.include || config.include;
const excludePatterns = options.exclude || [...config.exclude, ...config.excludeFiles];
const includeExtensions = options.extensions || config.extensions;
const showExcluded = options.showExcluded === undefined ? config.showExcluded : options.showExcluded;
const showSkipped = options.showSkipped === undefined ? config.showSkipped : options.showSkipped;
const outputFile = options.output || config.outputFile;

const OUTPUT_FILE = 'output.sick';

/**
 * Checks if a file should be excluded based on the excludePatterns.
 * @param {string} filePath - The path of the file to check.
 * @returns {boolean} True if the file should be excluded, false otherwise.
 */
function isExcluded(filePath) {
    const relativePath = path.relative(process.cwd(), filePath);
    return excludePatterns.some(pattern => {
        const test1 = relativePath.includes(pattern)
        const test2 = path.basename(filePath) === pattern;
        if (test1 || test2) {
            return true;
        } else {
            return false
        }
    });
}

/**
 * Recursively traverses a directory and processes its files.
 * @param {string} dirPath - The path of the directory to traverse.
 * @param {string} outputFilePath - The path of the output file.
 * @returns {Promise<void>}
 */
async function traverseDirectory(dirPath, outputFilePath) {
    try {
        const files = await fs.readdir(dirPath, { withFileTypes: true });

        for (const file of files) {
            const fullPath = path.join(dirPath, file.name);

            if (isExcluded(fullPath)) {
                if (showExcluded) {
                    await logSkippedFile(fullPath, outputFilePath, 'Excluded');
                }
                continue;
            }

            if (file.isDirectory()) {
                if (includeDirs.length === 0 || includeDirs.some(d => fullPath.includes(d))) {
                    await traverseDirectory(fullPath, outputFilePath);
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
 * Processes a single file, reading its content and appending it to the output file.
 * @param {string} filePath - The path of the file to process.
 * @param {string} outputFilePath - The path of the output file.
 * @returns {Promise<void>}
 */
async function processFile(filePath, outputFilePath) {
    try {
        const fileContent = await fs.readFile(filePath, 'utf-8');
        const relativePath = path.relative(process.cwd(), filePath);

        await fs.appendFile(outputFilePath, `\n\n--- File: ${relativePath} ---\n\n${fileContent}\n`);
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
    await fs.appendFile(outputFilePath, `\n\n--- File: ${relativePath} ---\n(${reason})\n`);
    console.log(`Skipped file: ${relativePath} (${reason})`);
}

/**
 * Main function to execute the script.
 * @returns {Promise<void>}
 */
async function main() {
    const targetDir = path.resolve(scanDir);
    const outputFilePath = path.join(process.cwd(), outputFile);

    try {
        await fs.access(targetDir);
    } catch (err) {
        console.error(`Error: Directory "${targetDir}" does not exist or is inaccessible.`);
        process.exit(1);
    }

    await fs.writeFile(outputFilePath, '');

    console.log(`Traversing directory: ${targetDir}`);

    await traverseDirectory(targetDir, outputFilePath);
    console.log(`Done. All file contents written to: ${outputFilePath}`);
}

main().catch(console.error);