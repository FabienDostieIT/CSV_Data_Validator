import { NextResponse } from 'next/server';
import fs from 'fs/promises'; // Use promises version of fs
import path from 'path';

export async function GET() {
  try {
    // Construct the absolute path relative to the current file's directory
    // Adjust __dirname depending on deployment environment if necessary, but this works for local dev
    // Using path.join for potentially better relative path handling
    const schemasDir = path.join(process.cwd(), 'schemas', 'v1'); // Corrected path relative to root

    console.log(`[API /api/schemas] Reading directory: ${schemasDir}`); // Log the path being read

    const dirents = await fs.readdir(schemasDir, { withFileTypes: true });
    const jsonFiles = dirents
      .filter(dirent => dirent.isFile() && dirent.name.endsWith('.json'))
      .map(dirent => dirent.name);

    console.log(`[API /api/schemas] Found files: ${jsonFiles.join(', ')}`); // Log found files

    return NextResponse.json({ schemas: jsonFiles });

  } catch (error: any) {
    console.error('[API /api/schemas] Error reading schema directory:', error);
    // Check for specific error types, like ENOENT (directory not found)
    if (error.code === 'ENOENT') {
        return NextResponse.json({ error: 'Schema directory not found.' }, { status: 500 });
    }
    return NextResponse.json({ error: 'Failed to list schemas', details: error.message }, { status: 500 });
  }
} 