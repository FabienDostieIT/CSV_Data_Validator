import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
  try {
    const schemasDir = path.join(process.cwd(), 'schemas', 'v1');
    const files = fs.readdirSync(schemasDir).filter(f => f.endsWith('.json'));
    const schemas = files.map(filename => ({
      name: filename.replace(/\.json$/, ''),
      filename,
      path: `/schemas/v1/${filename}`
    }));
    return NextResponse.json({ schemas });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}