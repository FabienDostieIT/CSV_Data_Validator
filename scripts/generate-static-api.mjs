/**
 * This script generates static JSON files that replicate the API responses
 * for use in the static GitHub Pages deployment.
 */
import fs from "fs/promises";
import path from "path";
import { parse } from "jsonc-parser";

const SCHEMAS_DIR = path.join(process.cwd(), "public", "schemas", "v1");
const PUBLIC_API_DIR = path.join(process.cwd(), "public", "api");
const SCHEMAS_PUBLIC_API_DIR = path.join(PUBLIC_API_DIR, "schemas");

async function main() {
  try {
    console.log("Generating static API files...");

    // Create directories if they don't exist
    await fs.mkdir(PUBLIC_API_DIR, { recursive: true });
    await fs.mkdir(SCHEMAS_PUBLIC_API_DIR, { recursive: true });

    // Read the schema directory
    const files = await fs.readdir(SCHEMAS_DIR);
    console.log(`Found ${files.length} files in schemas directory`);

    // Filter JSON files
    const jsonFiles = files.filter(
      (file) => file.endsWith(".json") && !file.includes(":Zone.Identifier"),
    );
    console.log(`Filtered to ${jsonFiles.length} JSON files`);

    // Generate the schemas index file (replicating /api/schemas GET response)
    const schemas = jsonFiles.map((filename) => ({
      name: filename.replace(".json", ""),
      filename,
    }));

    await fs.writeFile(
      path.join(SCHEMAS_PUBLIC_API_DIR, "index.json"),
      JSON.stringify(schemas, null, 2),
    );
    console.log("Generated schemas index file");

    // Generate individual schema files (replicating /api/schemas/[name] GET responses)
    for (const filename of jsonFiles) {
      const schemaName = filename.replace(".json", "");
      const filePath = path.join(SCHEMAS_DIR, filename);
      const fileContent = await fs.readFile(filePath, "utf-8");

      try {
        // Parse JSONC (JSON with comments)
        const parsedSchema = parse(fileContent);

        // Write to the public directory
        await fs.writeFile(
          path.join(SCHEMAS_PUBLIC_API_DIR, `${schemaName}.json`),
          JSON.stringify(parsedSchema, null, 2),
        );

        console.log(`Generated static API file for ${schemaName}`);
      } catch (error) {
        console.error(`Error processing schema ${filename}:`, error);
      }
    }

    console.log("Static API generation complete!");
  } catch (error) {
    console.error("Error generating static API files:", error);
    process.exit(1);
  }
}

main();
