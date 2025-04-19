import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

export async function GET() {
  try {
    const schemasDir = path.join(process.cwd(), "schemas", "v1");
    console.log(`[API /api/schemas] Reading directory: ${schemasDir}`);

    const allFiles = await fs.readdir(schemasDir);
    console.log(`[API /api/schemas] Found files: ${allFiles.join(', ')}`);

    const jsonFiles = allFiles.filter((f) => typeof f === 'string' && f.endsWith(".json"));
    console.log(`[API /api/schemas] Filtered JSON files: ${jsonFiles.join(', ')}`);

    const schemas = jsonFiles.map((filename) => ({
      name: filename.replace(/\.json$/, ""),
      filename,
    }));

    console.log(`[API /api/schemas] Mapped schemas:`, schemas);

    return NextResponse.json({ schemas: schemas });
  } catch (error: unknown) {
    console.error("[API /api/schemas] Error:", error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: "Failed to retrieve schemas", details: message },
      { status: 500 },
    );
  }
}
