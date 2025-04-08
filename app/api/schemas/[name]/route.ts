import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ name: string }> }
) {
  console.log("[API /api/schemas/[name]] Waiting for params...");

  // Await the params promise
  const awaitedParams = await params;
  console.log("[API /api/schemas/[name]] Incoming params resolved:", awaitedParams);

  // Extract name from awaited params
  const { name } = awaitedParams;

  // Optional: Basic safety check on the name string
  if (!name || !name.endsWith('.json') || name.includes('/') || name.includes('\\')) {
      console.error(`[API /api/schemas/[name]] Invalid name received: ${name}`);
      return NextResponse.json({ error: 'Invalid schema name format.' }, { status: 400 });
  }

  try {
    // Using path.join for potentially better relative path handling
    const schemasDir = path.join(process.cwd(), 'schemas', 'v1');
    const filePath = path.join(schemasDir, name);

    console.log(`[API /api/schemas/${name}] Reading file: ${filePath}`);

    // Security check: Ensure the resolved path is still within the intended directory
    if (!filePath.startsWith(schemasDir)) {
        console.error(`[API /api/schemas/${name}] Attempted path traversal: ${filePath}`);
        return NextResponse.json({ error: 'Invalid schema name' }, { status: 400 });
    }

    const fileContent = await fs.readFile(filePath, 'utf-8');

    // Optionally validate if it's valid JSON before returning
    try {
        JSON.parse(fileContent);
    } catch (parseError) {
        console.error(`[API /api/schemas/${name}] File is not valid JSON: ${filePath}`);
        return NextResponse.json({ error: 'Schema file is not valid JSON' }, { status: 500 });
    }

    return NextResponse.json({ content: fileContent });

  } catch (error: any) {
    console.error(`[API /api/schemas/${name}] Error reading schema file:`, error);
    if (error.code === 'ENOENT') {
      return NextResponse.json({ error: 'Schema not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Failed to read schema file', details: error.message }, { status: 500 });
  }
} 