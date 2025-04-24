import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { parse } from "jsonc-parser";

// Get the schema directory path
const getSchemaDirectory = () => {
  return path.join(process.cwd(), "schemas", "v1");
};

interface Context {
  params: {
    name: string;
  };
}

export async function GET(
  request: NextRequest,
  { params }: Context
) {
  console.log("[API /api/schemas/[name]] Received params:", params);
  
  // Validate that params.name is a string and not an object
  if (
    !params.name ||
    typeof params.name !== "string" ||
    params.name === "[object Object]"
  ) {
    console.log(
      "[API /api/schemas/[name]] Invalid name received:",
      params.name,
    );
    return NextResponse.json(
      { error: "Invalid schema name provided" },
      { status: 400 },
    );
  }

  // Ensure the file has .json extension
  const schemaName = params.name.endsWith(".json") 
    ? params.name 
    : `${params.name}.json`;
    
  console.log(
    `[API /api/schemas/${schemaName}] Reading file: ${path.join(getSchemaDirectory(), schemaName)}`,
  );

  try {
    const filePath = path.join(getSchemaDirectory(), schemaName);

    // Check if file exists first
    try {
      await fs.access(filePath);
    } catch (error) {
      console.log(
        `[API /api/schemas/${schemaName}] Error reading schema file: ${error}`,
      );
      return NextResponse.json(
        { error: `Schema file not found: ${schemaName}` },
        { status: 404 },
      );
    }

    const fileContent = await fs.readFile(filePath, "utf-8");

    // Parse JSONC (JSON with comments) for validation
    try {
      const parsedSchema = parse(fileContent);
      return NextResponse.json(parsedSchema);
    } catch (error) {
      console.error(
        `[API /api/schemas/${schemaName}] JSON parsing error:`,
        error,
      );
      return NextResponse.json(
        { error: "Invalid JSON schema format" },
        { status: 400 },
      );
    }
  } catch (error) {
    console.error(`[API /api/schemas/${schemaName}] Server error:`, error);
    return NextResponse.json(
      { error: "Failed to read schema file" },
      { status: 500 },
    );
  }
}
