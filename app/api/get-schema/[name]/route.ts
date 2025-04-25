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

// The standard Next.js App Router route handler type signature
export async function GET(
  request: Request,
  { params }: { params: { name: string } }
): Promise<Response> {
  // Extract schema name from URL params
  const schemaName: string = params.name;

  if (!schemaName) {
    return NextResponse.json({ error: "Schema name required" }, { status: 400 });
  }

  // Sanitize the name: remove .json extension and potentially harmful characters
  const safeSchemaName: string = schemaName
    .replace(/\.json$/i, "") // Case-insensitive removal of .json
    .replace(/[^\w-]+/g, ""); // Allow only word chars and hyphen

  if (!safeSchemaName) {
    return NextResponse.json({ error: "Invalid schema name" }, { status: 400 });
  }

  try {
    const schemasDir: string = path.resolve("./public/api/schemas");
    const filePath: string | null = safeJoin(schemasDir, `${safeSchemaName}.json`);

    if (!filePath) {
      console.error(`Path traversal attempt or invalid path for schema: ${schemaName}`);
      return NextResponse.json({ error: "Invalid schema name path" }, { status: 400 });
    }

    console.log(`Attempting to read schema file: ${filePath}`);

    const fileContent: string = await fs.readFile(filePath, "utf-8");
    // Parse JSON with proper type assertion that satisfies ESLint
    const parsedContent = JSON.parse(fileContent);
    // Use type assertion after validation to satisfy ESLint
    const schemaJson: Record<string, unknown> = 
      typeof parsedContent === 'object' && parsedContent !== null 
        ? parsedContent as Record<string, unknown>
        : {};

    return NextResponse.json(schemaJson);
  } catch (error: unknown) {
    console.error(`Error fetching schema ${safeSchemaName}:`, error);
    
    // Narrowing error type with type guard
    if (
      error instanceof Error &&
      'code' in error &&
      (error as NodeJS.ErrnoException).code === "ENOENT"
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