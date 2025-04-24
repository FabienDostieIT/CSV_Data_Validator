import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

// Get the schemas directory
const getSchemasDirectory = () => {
  return path.join(process.cwd(), "schemas", "v1");
};

// Interface for schema objects
interface SchemaInfo {
  name: string;
  filename: string;
}

export async function GET() {
  const schemasDir = path.join(process.cwd(), "schemas", "v1");
  console.log(`[API /api/schemas] Reading directory: ${schemasDir}`);

  try {
    const files = await fs.readdir(schemasDir);
    console.log(`[API /api/schemas] Found files: ${files.join(", ")}`);

    const jsonFiles = files.filter(
      (file) => file.endsWith(".json") && !file.includes(":Zone.Identifier"),
    );
    console.log(
      `[API /api/schemas] Filtered JSON files: ${jsonFiles.join(", ")}`,
    );

    const schemas = jsonFiles.map((filename) => ({
      name: filename.replace(".json", ""),
      filename,
    }));

    console.log(
      `[API /api/schemas] Mapped schemas: ${JSON.stringify(schemas, null, 2)}`,
    );

    return NextResponse.json(schemas);
  } catch (error) {
    console.error("[API /api/schemas] Error reading schema directory:", error);
    return NextResponse.json(
      { error: "Failed to read schemas directory" },
      { status: 500 },
    );
  }
}
