import { NextResponse } from 'next/server';
// import { JsonSchemaStaticDocs } from 'json-schema-static-docs'; // Original import
import * as JsonSchemaStaticDocsLib from 'json-schema-static-docs'; // Use namespace import
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { createRequire } from 'module'; // Import createRequire

// Helper to resolve package paths
const require = createRequire(import.meta.url);

// Recursive copy function (fs.cp might not be available everywhere or handle nested dirs reliably)
async function copyDirRecursive(src: string, dest: string) {
    await fs.mkdir(dest, { recursive: true });
    const entries = await fs.readdir(src, { withFileTypes: true });
    for (let entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);
        if (entry.isDirectory()) {
            await copyDirRecursive(srcPath, destPath);
        } else {
            await fs.copyFile(srcPath, destPath);
        }
    }
}

// Helper to create a temporary file
async function writeTempSchemaFile(schema: any): Promise<string> {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'schema-'));
    const tempFilePath = path.join(tempDir, 'schema.json');
    await fs.writeFile(tempFilePath, JSON.stringify(schema, null, 2));
    console.log(`API: Wrote temp schema to ${tempFilePath}`);
    return tempFilePath;
}

// Helper to read the generated markdown file
async function readGeneratedMarkdown(outputPath: string, schemaFileName: string): Promise<string> {
    const mdFileName = schemaFileName.replace(/\.json$/, '.md'); // Assuming input was .json
    const mdFilePath = path.join(outputPath, mdFileName);
    console.log(`API: Reading generated markdown from ${mdFilePath}`);
    try {
        const markdownContent = await fs.readFile(mdFilePath, 'utf-8');
        return markdownContent;
    } catch (error) {
        console.error(`API: Error reading generated markdown file ${mdFilePath}:`, error);
        throw new Error(`Could not read generated markdown file.`);
    }
}

// Helper to clean up temporary directories
async function cleanupTempDirs(pathsToClean: string[]) {
    for (const dirPath of pathsToClean) {
        try {
            if (dirPath) { // Check if path is defined
                console.log(`API: Cleaning up temp dir: ${dirPath}`);
                await fs.rm(dirPath, { recursive: true, force: true });
            }
        } catch (error) {
            console.error(`API: Error during temp cleanup of ${dirPath}:`, error);
            // Don't throw error here, cleanup failure shouldn't fail the request
        }
    }
}

export async function POST(request: Request) {
    let tempInputPath: string | undefined;
    let tempOutputPath: string | undefined;
    let tempTemplatePath: string | undefined; // Path for copied templates
    const cleanupPaths: string[] = []; // Keep track of all paths to clean

    try {
        const { schema } = await request.json();

        if (!schema) {
            return NextResponse.json({ error: 'Missing schema in request body' }, { status: 400 });
        }

        // 1. Write the received schema to a temporary file
        tempInputPath = await writeTempSchemaFile(schema);
        const tempInputDirectory = path.dirname(tempInputPath);
        cleanupPaths.push(tempInputDirectory); // Add for cleanup
        console.log(`API: Created temp input dir ${tempInputDirectory}`);

        // 2. Create a temporary output directory
        tempOutputPath = await fs.mkdtemp(path.join(os.tmpdir(), 'schema-docs-'));
        cleanupPaths.push(tempOutputPath); // Add for cleanup
        console.log(`API: Created temp output dir ${tempOutputPath}`);

        // 3. Resolve source template path and create/copy to temp template path
        // Use the path to the copied templates in the public directory
        const projectRoot = process.cwd();
        const sourceTemplatePath = path.join(projectRoot, 'public', '__schema_templates');

        // Check if source template path exists before copying
        try {
            await fs.access(sourceTemplatePath);
            console.log(`API: Source template path found: ${sourceTemplatePath}`);
        } catch (accessError) {
            console.error(`API: Source template path NOT FOUND: ${sourceTemplatePath}`, accessError);
            throw new Error(`Could not find source template directory at ${sourceTemplatePath}. Check path resolution.`);
        }

        tempTemplatePath = await fs.mkdtemp(path.join(os.tmpdir(), 'schema-templates-'));
        cleanupPaths.push(tempTemplatePath); // Add for cleanup
        console.log(`API: Copying templates from ${sourceTemplatePath} to ${tempTemplatePath}`);
        await copyDirRecursive(sourceTemplatePath, tempTemplatePath);
        console.log(`API: Finished copying templates.`);

        // 4. Instantiate and run json-schema-static-docs
        const Constructor = JsonSchemaStaticDocsLib.default || JsonSchemaStaticDocsLib;

        const generator = new Constructor({
            inputPath: tempInputDirectory,
            outputPath: tempOutputPath,
            templatePath: tempTemplatePath, // <-- Use the path with copied templates
            createIndex: false, // We only want the single doc
            addFrontMatter: false, // No frontmatter needed
            // Add any other options needed for styling/generation
            // ajvOptions: { allowUnionTypes: true }, // Example ajv option
            // enableMetaEnum: true, // Example meta enum option
        });

        console.log(`API: Running generator. Input: ${tempInputDirectory}, Output: ${tempOutputPath}, Templates: ${tempTemplatePath}`);
        await generator.generate();
        console.log("API: Generator finished.");

        // 5. Read the generated Markdown file
        const markdown = await readGeneratedMarkdown(tempOutputPath, path.basename(tempInputPath));

        // 6. Clean up temporary files/directories (do this *before* returning)
        await cleanupTempDirs(cleanupPaths);

        // 7. Return the Markdown content
        return NextResponse.json({ markdown });

    } catch (error: any) {
        console.error("API Error generating schema doc:", error);

        // Ensure cleanup happens even on error
        await cleanupTempDirs(cleanupPaths);

        return NextResponse.json(
            { error: 'Failed to generate schema documentation', details: error.message },
            { status: 500 }
        );
    }
} 