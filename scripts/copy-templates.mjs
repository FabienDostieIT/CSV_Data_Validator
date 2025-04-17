import fs from 'fs-extra'; // Use fs-extra for reliable recursive copy
import path from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

async function copyTemplates() {
    try {
        // Construct the direct path within .pnpm based on discovery
        const projectRoot = process.cwd();
        const sourceTemplatePath = path.join(
            projectRoot,
            'node_modules',
            '.pnpm',
            'json-schema-static-docs@0.28.1',
            'node_modules',
            'json-schema-static-docs',
            'templates' // Templates are at the root, not inside lib
        );

        // Define the destination path within the public directory
        const destinationPath = path.join(projectRoot, 'public', '__schema_templates'); // Use a specific subfolder

        console.log(`Attempting to copy templates from: ${sourceTemplatePath}`);
        console.log(`Attempting to copy templates to:   ${destinationPath}`);

        // Ensure source exists
        if (!await fs.pathExists(sourceTemplatePath)) {
            console.error(`Error: Source template directory not found at ${sourceTemplatePath}`);
            process.exit(1); // Exit with error
        }

        // Remove existing destination directory first to ensure clean copy
        await fs.remove(destinationPath);
        console.log(`Removed existing directory: ${destinationPath}`);

        // Copy the templates directory
        await fs.copy(sourceTemplatePath, destinationPath);

        console.log(`Successfully copied templates to ${destinationPath}`);

    } catch (error) {
        console.error("Error copying schema templates:", error);
        process.exit(1); // Exit with error
    }
}

copyTemplates(); 