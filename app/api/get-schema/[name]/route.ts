import { NextResponse, NextRequest } from "next/server";
import fs from "fs/promises";
import path from "path";

// Remove unused interface definition
// interface RouteContext {
//   params: {
//     name: string;
//   };
// }

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

export async function GET(
  // Remove the request parameter as it's unused
  // request: NextRequest,
  { params }: { params: { name: string } } // Use standard destructuring for the context/params
) {
  const schemaName = params.name; // Access name via params

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

    console.log(`Attempting to read schema file: ${filePath}`); // Add logging

    const fileContent = await fs.readFile(filePath, "utf-8");
    // Assert the type after parsing JSON to satisfy eslint
    const schemaJson = JSON.parse(fileContent) as Record<string, unknown>;

    return NextResponse.json(schemaJson);
  } catch (error) {
    console.error(`Error fetching schema ${safeSchemaName}:`, error);
    if (
      error instanceof Error &&
      (error as NodeJS.ErrnoException).code === "ENOENT"
    ) {
      return NextResponse.json(
        { error: `Schema '${safeSchemaName}' not found.` },
        { status: 404 },
      );
    }
    return NextResponse.json(
      { error: `Failed to fetch schema '${safeSchemaName}'` },
      { status: 500 },
    );
  }
}

// Ensure this route is always dynamic and not cached
export const dynamic = "force-dynamic"; 