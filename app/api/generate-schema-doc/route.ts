import { NextResponse } from "next/server";
// import { JsonSchemaStaticDocs } from 'json-schema-static-docs'; // Original import
import * as JsonSchemaStaticDocsLib from "json-schema-static-docs"; // Use namespace import
import fs from "fs/promises";
import path from "path";
import os from "os";
import prettier from "prettier";
import parserTypescript from "prettier/parser-typescript";
// import { DocGenerator } from "json-schema-static-docs"; // Removed

// Helper to resolve package paths
// const require = createRequire(import.meta.url);

// Recursive copy function (fs.cp might not be available everywhere or handle nested dirs reliably)
async function copyDirRecursive(src: string, dest: string) {
  await fs.mkdir(dest, { recursive: true });
  const entries = await fs.readdir(src, { withFileTypes: true });
  for (const entry of entries) {
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
async function writeTempSchemaFile(schema: Record<string, unknown>): Promise<string> {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "schema-"));
  const tempFilePath = path.join(tempDir, "schema.json");
  await fs.writeFile(tempFilePath, JSON.stringify(schema, null, 2));
  console.log(`API: Wrote temp schema to ${tempFilePath}`);
  return tempFilePath;
}

// Helper to read the generated markdown file
async function readGeneratedMarkdown(
  outputPath: string,
  schemaFileName: string,
): Promise<string> {
  const mdFileName = schemaFileName.replace(/\.json$/, ".md"); // Assuming input was .json
  const mdFilePath = path.join(outputPath, mdFileName);
  console.log(`API: Reading generated markdown from ${mdFilePath}`);
  try {
    const markdownContent = await fs.readFile(mdFilePath, "utf-8");
    return markdownContent;
  } catch (error) {
    console.error(
      `API: Error reading generated markdown file ${mdFilePath}:`,
      error,
    );
    throw new Error(`Could not read generated markdown file.`);
  }
}

// Helper to clean up temporary directories
async function cleanupTempDirs(pathsToClean: string[]) {
  for (const dirPath of pathsToClean) {
    try {
      if (dirPath) {
        // Check if path is defined
        console.log(`API: Cleaning up temp dir: ${dirPath}`);
        await fs.rm(dirPath, { recursive: true, force: true });
      }
    } catch (error) {
      console.error(`API: Error during temp cleanup of ${dirPath}:`, error);
      // Don't throw error here, cleanup failure shouldn't fail the request
    }
  }
}

// Define an interface for the expected structure of the imported library module if possible
// If the exact structure is unknown, we might have to keep `any` casts but minimize them.
interface JsonSchemaStaticDocsOptions {
  inputPath: string;
  outputPath: string;
  templatePath: string;
  createIndex: boolean;
  addFrontMatter: boolean;
  // Replace 'any' with 'unknown' for stricter checking
  [key: string]: unknown; 
}

interface JsonSchemaStaticDocsInstance {
  generate: () => Promise<void>;
  // Add other known methods/properties if available
  [key: string]: unknown; 
}

// Type for the constructor, assuming it's the default export or the module itself
type JsonSchemaStaticDocsConstructor = new (
  options: JsonSchemaStaticDocsOptions,
) => JsonSchemaStaticDocsInstance;

// Type for the dynamically imported module
type JsonSchemaStaticDocsModule =
  | JsonSchemaStaticDocsConstructor // Case: Module is the constructor
  | { default: JsonSchemaStaticDocsConstructor } // Case: Constructor is default export
  | { JsonSchemaStaticDocs: JsonSchemaStaticDocsConstructor } // Case: Constructor is named export 'JsonSchemaStaticDocs'
  | { DocGenerator: JsonSchemaStaticDocsConstructor } // Case: Constructor is named export 'DocGenerator'
  | { [key: string]: unknown }; // Fallback for other structures

// Custom Type Guard for the Constructor
function isDocConstructor(obj: unknown): obj is JsonSchemaStaticDocsConstructor {
  return typeof obj === 'function' && obj.prototype !== undefined;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function formatMarkdown(markdown: string): Promise<string> {
  try {
    const result: string = await prettier.format(markdown, { 
      parser: "markdown",
      plugins: [parserTypescript], 
      printWidth: 80,
      proseWrap: "always",
    });
    return result;
  } catch (error: unknown) { // Type error as unknown
    console.warn("Could not parse error response from generate-schema-doc");
    // Safe access to properties
    let statusText = "Unknown status";
    if (typeof error === 'object' && error !== null && 'statusText' in error) {
        statusText = String((error as { statusText: unknown }).statusText);
    }
    const errorDetails = `: ${statusText}`; // Use const as errorDetails is not reassigned after this block
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Markdown formatting failed${errorDetails}. Original error: ${message}`);
  }
}

export async function POST(request: Request) {
  let tempInputPath: string | undefined;
  let tempOutputPath: string | undefined;
  let tempTemplatePath: string | undefined; // Path for copied templates
  const cleanupPaths: string[] = []; // Keep track of all paths to clean

  try {
    const { schema } = (await request.json()) as { schema: Record<string, unknown> }; // Added type assertion

    if (!schema) {
      return NextResponse.json(
        { error: "Missing schema in request body" },
        { status: 400 },
      );
    }

    // 1. Write the received schema to a temporary file
    tempInputPath = await writeTempSchemaFile(schema);
    const tempInputDirectory = path.dirname(tempInputPath);
    cleanupPaths.push(tempInputDirectory); // Add for cleanup
    console.log(`API: Created temp input dir ${tempInputDirectory}`);

    // 2. Create a temporary output directory
    tempOutputPath = await fs.mkdtemp(path.join(os.tmpdir(), "schema-docs-"));
    cleanupPaths.push(tempOutputPath); // Add for cleanup
    console.log(`API: Created temp output dir ${tempOutputPath}`);

    // 3. Resolve source template path and create/copy to temp template path
    // Use the path to the copied templates in the public directory
    const projectRoot = process.cwd();
    const sourceTemplatePath = path.join(
      projectRoot,
      "public",
      "__schema_templates",
    );

    // Check if source template path exists before copying
    try {
      await fs.access(sourceTemplatePath);
      console.log(`API: Source template path found: ${sourceTemplatePath}`);
    } catch (accessError) {
      console.error(
        `API: Source template path NOT FOUND: ${sourceTemplatePath}`,
        accessError,
      );
      throw new Error(
        `Could not find source template directory at ${sourceTemplatePath}. Check path resolution.`,
      );
    }

    tempTemplatePath = await fs.mkdtemp(
      path.join(os.tmpdir(), "schema-templates-"),
    );
    cleanupPaths.push(tempTemplatePath); // Add for cleanup
    console.log(
      `API: Copying templates from ${sourceTemplatePath} to ${tempTemplatePath}`,
    );
    await copyDirRecursive(sourceTemplatePath, tempTemplatePath);
    console.log(`API: Finished copying templates.`);

    // 4. Instantiate and run json-schema-static-docs
    // Attempt to find the constructor more safely
    const LibraryModule: JsonSchemaStaticDocsModule = JsonSchemaStaticDocsLib; 
    let Constructor: JsonSchemaStaticDocsConstructor | null = null;

    // Use the type guard first for the direct constructor case
    if (isDocConstructor(LibraryModule)) {
         Constructor = LibraryModule;
    // Check if it's an object before checking properties
    } else if (LibraryModule && typeof LibraryModule === 'object') { 
        // Use 'in' operator for safer property checking
        if ('default' in LibraryModule && LibraryModule.default && isDocConstructor(LibraryModule.default)) {
            // Add type assertion
            Constructor = LibraryModule.default as JsonSchemaStaticDocsConstructor;
        } else if ('JsonSchemaStaticDocs' in LibraryModule && LibraryModule.JsonSchemaStaticDocs && isDocConstructor(LibraryModule.JsonSchemaStaticDocs)) {
           // Add type assertion
           Constructor = LibraryModule.JsonSchemaStaticDocs as JsonSchemaStaticDocsConstructor;
        } else if ('DocGenerator' in LibraryModule && LibraryModule.DocGenerator && isDocConstructor(LibraryModule.DocGenerator)) {
           // Add type assertion
           Constructor = LibraryModule.DocGenerator as JsonSchemaStaticDocsConstructor;
        }
    }

    if (!Constructor) {
        console.error("API: Could not find JsonSchemaStaticDocs constructor in the imported module.", LibraryModule);
        throw new Error("Failed to load the documentation generator library correctly.");
    }

    // Instantiate using the found constructor
    // Cast options object at point of use due to [key: string]: unknown
    const options: JsonSchemaStaticDocsOptions = {
      inputPath: tempInputDirectory,
      outputPath: tempOutputPath,
      templatePath: tempTemplatePath,
      createIndex: false,
      addFrontMatter: false,
    };
    const generator: JsonSchemaStaticDocsInstance = new Constructor(options);

    console.log(
      `API: Running generator. Input: ${tempInputDirectory}, Output: ${tempOutputPath}, Templates: ${tempTemplatePath}`,
    );
    // Wrap generate call in try-catch
    try {
      // Call generate method (type safety from interface)
      await generator.generate();
      console.log("API: Generator finished.");
    } catch (genError: unknown) { // Ensure genError is unknown
      console.error("API: Error during generator.generate():", genError);
      // Use type guard for message
      const message = genError instanceof Error ? genError.message : "Generator failed";
        
        throw new Error(`Schema documentation generation failed: ${message}`); 
    }

    // 5. Read the generated Markdown file
    const markdown = await readGeneratedMarkdown(
      tempOutputPath,
      path.basename(tempInputPath),
    );

    // 6. Clean up temporary files/directories (do this *before* returning)
    await cleanupTempDirs(cleanupPaths);

    // 7. Return the Markdown content
    return NextResponse.json({ markdown });
  } catch (error: unknown) { // Changed to unknown
    console.error("API Error generating schema doc:", error);

    // Ensure cleanup happens even on error
    await cleanupTempDirs(cleanupPaths);

    // Add type guard before accessing message
    const details = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      {
        error: "Failed to generate schema documentation",
        details: details, // Use guarded details
      },
      { status: 500 },
    );
  }
}
