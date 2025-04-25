import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

const SCHEMAS_DIR = path.join(process.cwd(), "public", "schemas", "v1");

// Interface for the response items
interface SchemaObject {
  name: string;
  filename: string;
}

export async function GET() {
  // This route should only be used in development
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "Endpoint not available in production. Use static index.json." },
      { status: 404 },
    );
  }

  try {
    const files = await fs.readdir(SCHEMAS_DIR);

    // Filter to only include JSON files and exclude Zone.Identifier files
    const schemaFiles = files.filter(
      (file) => file.endsWith(".json") && !file.includes(":Zone.Identifier"),
    );

    // Map to the expected SchemaObject format
    const schemas: SchemaObject[] = schemaFiles.map((filename) => ({
      name: filename.replace(".json", ""),
      filename,
    }));

    return NextResponse.json(schemas);
  } catch (error) {
    console.error("Error listing schemas:", error);
    // Check if the error is because the directory doesn't exist
    if (
      error instanceof Error &&
      (error as NodeJS.ErrnoException).code === "ENOENT"
    ) {
      return NextResponse.json(
        { error: "Schema directory not found." },
        { status: 404 },
      );
    }
    return NextResponse.json(
      { error: "Failed to list schemas" },
      { status: 500 },
    );
  }
}

// Ensure this route is always dynamic and not cached in dev
export const dynamic = "force-dynamic";
