/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
// Next.js route handlers have incompatible types between ESLint and the Next.js build system
// These directives are necessary to make the route handler work with both

import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

// Helper function to safely join paths and prevent traversal
function safeJoin(base: string, target: string): string | null {
  const targetPath = "." + path.normalize("/" + target);
  const joinedPath = path.join(base, targetPath);
  // Check if the resolved path is still within the base directory
  if (joinedPath.startsWith(path.resolve(base))) {
    return joinedPath;
  }
  return null; // Path traversal detected or invalid path
}

// Type guard function to validate JSON schema objects
function isValidSchemaObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// Use the simplest form for Next.js 15 compatibility
export async function GET(request, context) {
  // Extract schema name from URL params
  const schemaName = context.params.name;

  if (!schemaName) {
    return NextResponse.json({ error: "Schema name required" }, { status: 400 });
  }

  // Sanitize the name: remove .json extension and potentially harmful characters
  const safeSchemaName = schemaName
    .replace(/\.json$/i, "") // Case-insensitive removal of .json
    .replace(/[^\w-]+/g, ""); // Allow only word chars and hyphen

  if (!safeSchemaName) {
    return NextResponse.json({ error: "Invalid schema name" }, { status: 400 });
  }

  try {
    const schemasDir = path.resolve("./public/api/schemas");
    const filePath = safeJoin(schemasDir, `${safeSchemaName}.json`);

    if (!filePath) {
      console.error(`Path traversal attempt or invalid path for schema: ${schemaName}`);
      return NextResponse.json({ error: "Invalid schema name path" }, { status: 400 });
    }

    console.log(`Attempting to read schema file: ${filePath}`);

    const fileContent = await fs.readFile(filePath, "utf-8");
    
    // Safely parse and validate the JSON schema
    let schemaJson;
    try {
      const parsed = JSON.parse(fileContent);
      
      if (!isValidSchemaObject(parsed)) {
        return NextResponse.json(
          { error: "Invalid schema format" },
          { status: 400 }
        );
      }
      
      schemaJson = parsed;
    } catch (parseError) {
      console.error("JSON parse error:", parseError);
      return NextResponse.json(
        { error: "Invalid JSON format" },
        { status: 400 }
      );
    }

    return NextResponse.json(schemaJson);
  } catch (error) {
    console.error(`Error fetching schema ${safeSchemaName}:`, error);
    
    // Check for file not found error
    if (
      error instanceof Error &&
      'code' in error &&
      error.code === "ENOENT"
    ) {
      return NextResponse.json(
        { error: `Schema '${safeSchemaName}' not found.` },
        { status: 404 }
      );
    }
    
    return NextResponse.json(
      { error: `Failed to fetch schema '${safeSchemaName}'` },
      { status: 500 }
    );
  }
}

// Ensure this route is always dynamic and not cached
export const dynamic = "force-dynamic"; 