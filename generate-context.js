const fs = require('fs');
const path = require('path');

// --- Configuration ---
const OUTPUT_FILENAME = 'project-context.txt';

// Directories to completely ignore
const IGNORE_DIRS = new Set([
    'node_modules', '.git', 'dist', 'build', 'coverage', '.vscode', '.idea'
]);

// Specific files to ignore (prevents token bloat from lockfiles)
const IGNORE_FILES = new Set([
    '.env', 'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml', OUTPUT_FILENAME, 'generate-context.js'
]);

// Only read files with these extensions to avoid binary files (images, fonts, etc.)
const ALLOWED_EXTENSIONS = new Set([
    '.ts', '.tsx', '.js', '.jsx', '.json', '.md', '.css', '.html'
]);

// Also include specific files that might lack standard extensions
const ALLOWED_EXACT_FILES = new Set([
    'Dockerfile', '.prettierrc', '.eslintrc'
]);

function getProjectStructure(dir, prefix = '') {
    let structure = '';
    const files = fs.readdirSync(dir);

    // Filter out ignored directories and files early for the tree view
    const visibleFiles = files.filter(file => !IGNORE_DIRS.has(file) && !IGNORE_FILES.has(file));

    visibleFiles.forEach((file, index) => {
        const filePath = path.join(dir, file);
        const isLast = index === visibleFiles.length - 1;
        const stats = fs.statSync(filePath);

        if (stats.isDirectory()) {
            structure += `${prefix}${isLast ? '└── ' : '├── '}${file}/\n`;
            structure += getProjectStructure(filePath, prefix + (isLast ? '    ' : '│   '));
        } else {
            structure += `${prefix}${isLast ? '└── ' : '├── '}${file}\n`;
        }
    });
    return structure;
}

function getFileContents(dir) {
    let contents = '';
    const files = fs.readdirSync(dir);

    files.forEach((file) => {
        const filePath = path.join(dir, file);
        const stats = fs.statSync(filePath);

        if (stats.isDirectory()) {
            if (!IGNORE_DIRS.has(file)) {
                contents += getFileContents(filePath);
            }
        } else {
            const ext = path.extname(file);
            const isAllowedExt = ALLOWED_EXTENSIONS.has(ext);
            const isAllowedExact = ALLOWED_EXACT_FILES.has(file);

            if (!IGNORE_FILES.has(file) && (isAllowedExt || isAllowedExact)) {
                const relativePath = path.relative(__dirname, filePath);
                const fileContent = fs.readFileSync(filePath, 'utf-8');

                contents += `\n\n========================================\n`;
                contents += `FILE: ${relativePath}\n`;
                contents += `========================================\n\n`;
                contents += fileContent;
            }
        }
    });
    return contents;
}

// --- Main Execution ---
try {
    console.log('Gathering project context...');

    let finalOutput = '========================================\n';
    finalOutput += 'PROJECT STRUCTURE\n';
    finalOutput += '========================================\n\n';
    finalOutput += getProjectStructure(__dirname);

    finalOutput += '\n\n========================================\n';
    finalOutput += 'FILE CONTENTS\n';
    finalOutput += '========================================\n';
    finalOutput += getFileContents(__dirname);

    fs.writeFileSync(path.join(__dirname, OUTPUT_FILENAME), finalOutput);
    console.log(`✅ Successfully generated ${OUTPUT_FILENAME}`);
} catch (error) {
    console.error('❌ Error generating context:', error);
}