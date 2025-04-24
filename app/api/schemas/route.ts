import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

// Get the schemas directory path
const getSchemasDirectory = () => {
  return path.join(process.cwd(), "schemas", "v1");
};

export async function GET(request: Request) {
  console.log("[API /api/schemas] Getting list of schemas");
  
  try {
    const directory = getSchemasDirectory();
    const files = await fs.readdir(directory);
    
    // Filter to only include JSON files and exclude Zone.Identifier files
    const schemaNames = files.filter(file => 
      file.endsWith('.json') && !file.includes(':Zone.Identifier')
    );
    
    console.log(`[API /api/schemas] Found ${schemaNames.length} schemas:`, schemaNames);
    
    // Format the response to match what the client expects
    const schemas = schemaNames.map(filename => ({
      name: filename.replace('.json', ''),
      filename,
    }));
    
    return NextResponse.json(schemas);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error("[API /api/schemas] Error reading schemas directory:", errorMsg);
    
    return NextResponse.json(
      { error: "Failed to read schemas directory" },
      { status: 500 }
    );
  }
}
