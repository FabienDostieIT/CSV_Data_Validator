import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { parse } from "jsonc-parser";

// Get the schema directory path
const getSchemaDirectory = () => {
  return path.join(process.cwd(), "schemas", "v1");
};

// Generate static paths for all schemas (for preloading in Vercel)
export async function generateStaticParams() {
  try {
    const directory = getSchemaDirectory();
    const files = await fs.readdir(directory);
    
    // Filter to only include JSON files and exclude Zone.Identifier files
    const schemaNames = files.filter(file => 
      file.endsWith('.json') && !file.includes(':Zone.Identifier')
    );
    
    // Return the list of params for each schema
    return schemaNames.map(filename => ({
      name: filename.replace('.json', ''),
    }));
  } catch (error) {
    console.error("Error generating static params:", error);
    return []; // Return empty array if error occurs
  }
}

// Updated type signature for Next.js 15.3.1
export async function GET(
  request: Request,
  context: { params: { name: string } }
) {
  try {
    const { params } = context;
    
    // Ensure params.name is a string
    const schemaName = typeof params.name === 'string'
      ? params.name.endsWith('.json') 
        ? params.name 
        : `${params.name}.json`
      : '';
    
    if (!schemaName) {
      console.log("[API /api/schemas/[name]] Invalid or missing name parameter");
      return NextResponse.json(
        { error: "Invalid schema name provided" },
        { status: 400 },
      );
    }
    
    console.log(`[API /api/schemas/${schemaName}] Reading file: ${path.join(getSchemaDirectory(), schemaName)}`);
    
    const filePath = path.join(getSchemaDirectory(), schemaName);

    // Check if file exists first
    try {
      await fs.access(filePath);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.log(
        `[API /api/schemas/${schemaName}] Error reading schema file: ${errorMsg}`,
      );
      return NextResponse.json(
        { error: `Schema file not found: ${schemaName}` },
        { status: 404 },
      );
    }

    const fileContent = await fs.readFile(filePath, "utf-8");

    // Parse JSONC (JSON with comments) for validation
    try {
      const parsedSchema = parse(fileContent) as Record<string, unknown>;
      return NextResponse.json(parsedSchema);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(
        `[API /api/schemas/${schemaName}] JSON parsing error:`,
        errorMsg,
      );
      return NextResponse.json(
        { error: "Invalid JSON schema format" },
        { status: 400 },
      );
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`[API /api/schemas/[name]] Server error:`, errorMsg);
    return NextResponse.json(
      { error: "Failed to read schema file" },
      { status: 500 },
    );
  }
}

// Use static in production for export compatibility
export const dynamic = 'force-static';
