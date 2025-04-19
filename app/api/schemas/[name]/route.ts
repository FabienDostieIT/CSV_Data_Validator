import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
// Import 'parse' as a named export with an alias
import { parse as jsoncParse } from "jsonc";

// Remove the explicit RouteContext interface
// interface RouteContext {
//   params: {
//     name: string;
//   };
// }

export async function GET(
  _request: Request, // Prefix with _ if not used
  // Use the correct Next.js 15 type signature with Promise
  { params }: { params: Promise<{ name: string }> }, 
) {
  // Remove the explicit destructuring added in the previous step
  // const { params } = context;
  console.log("[API /api/schemas/[name]] Waiting for params...");

  // Ensure params is awaited (was likely correct before, but confirming)
  const awaitedParams = await params;
  console.log(
    "[API /api/schemas/[name]] Incoming params resolved:",
    awaitedParams,
  );

  // Extract name from awaited params
  const { name } = awaitedParams;

  // Optional: Basic safety check on the name string
  if (
    !name ||
    !name.endsWith(".json") ||
    name.includes("/") ||
    name.includes("\\")
  ) {
    console.error(`[API /api/schemas/[name]] Invalid name received: ${name}`);
    return NextResponse.json(
      { error: "Invalid schema name format." },
      { status: 400 },
    );
  }

  try {
    // Using path.join for potentially better relative path handling
    const schemasDir = path.join(process.cwd(), "schemas", "v1");
    const filePath = path.join(schemasDir, name);

    console.log(`[API /api/schemas/${name}] Reading file: ${filePath}`);

    // Security check: Ensure the resolved path is still within the intended directory
    if (!filePath.startsWith(schemasDir)) {
      console.error(
        `[API /api/schemas/${name}] Attempted path traversal: ${filePath}`,
      );
      return NextResponse.json(
        { error: "Invalid schema name" },
        { status: 400 },
      );
    }

    const fileContent = await fs.readFile(filePath, "utf-8");

    // Parse JSONC (JSON with comments) for validation
    try {
      // Check if jsoncParse is a function before calling (optional safety)
      if (typeof jsoncParse === 'function') {
        // Use the imported jsoncParse function directly
        jsoncParse(fileContent);
      } else {
        // Handle the case where jsonc or jsonc.parse is not loaded correctly
        console.error(`[API /api/schemas/${name}] jsonc.parse function not found.`);
        throw new Error("JSONC parsing library failed to load.");
      }
    } catch (parseError: unknown) { // Catch specific parsing error
      // Handle JSON parsing errors
      console.error(`Error parsing schema file ${name}:`, parseError);
      // Provide a more specific error message
      // const message = parseError instanceof Error ? parseError.message : "Invalid JSONC format"; // Removed unused variable
      // Check if parseError has a relevant property like 'message' before using it
      let details = "Invalid JSONC format";
      if (parseError instanceof Error) {
        details = parseError.message;
      } else if (typeof parseError === 'object' && parseError !== null && 'message' in parseError) {
        // Handle cases where it might be an error-like object but not an Error instance
        details = String((parseError as { message: unknown }).message);
      }
      return NextResponse.json(
        { error: "Schema file is not valid JSON", details: details }, // Use checked details
        { status: 500 },
      );
    }
    // Return the original content if parsing succeeded
    return NextResponse.json({ content: fileContent });
  } catch (error: unknown) {
    console.error(
      `[API /api/schemas/${name}] Error reading schema file:`,
      error,
    );
    // Add type guards for accessing properties
    let errorCode: string | undefined;
    let errorMessage: string | undefined = "Unknown error reading file";

    if (typeof error === 'object' && error !== null) {
      if ('code' in error) {
        errorCode = String(error.code); // Convert potential non-string code
      }
      if (error instanceof Error) {
        errorMessage = error.message;
      }
    }

    if (errorCode === "ENOENT") {
      return NextResponse.json({ error: "Schema not found" }, { status: 404 });
    }
    return NextResponse.json(
      { error: "Failed to read schema file", details: errorMessage }, // Use guarded message
      { status: 500 },
    );
  }
}
