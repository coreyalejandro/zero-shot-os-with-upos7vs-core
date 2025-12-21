import { NextResponse } from 'next/server';
import { readFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const handoffPath = join(process.cwd(), '..', 'HANDOFF.md');

function parseStatus(content: string): string | null {
  const match = content.match(/^\*\*Status:\*\*\s*(.+)$/m);
  return match?.[1]?.trim() ?? null;
}

function parseAllTestsPassing(content: string): { passed: number; total: number; suitesPassed?: number; suitesTotal?: number } | null {
  // Example line:
  // - ✅ All tests passing: 255/255 tests across 14 test suites
  const match = content.match(/All tests passing:\s*(\d+)\s*\/\s*(\d+)\s*tests(?:\s*across\s*(\d+)\s*test suites)?/i);
  if (!match) return null;
  const passed = Number(match[1]);
  const total = Number(match[2]);
  const suitesTotal = match[3] ? Number(match[3]) : undefined;
  return {
    passed,
    total,
    suitesPassed: suitesTotal,
    suitesTotal,
  };
}

export async function GET() {
  try {
    if (!existsSync(handoffPath)) {
      return NextResponse.json({ error: 'HANDOFF.md not found' }, { status: 404 });
    }
    const content = await readFile(handoffPath, 'utf-8');
    const fileStats = await stat(handoffPath);
    return NextResponse.json({
      content,
      lastUpdatedMs: fileStats.mtimeMs,
      statusText: parseStatus(content),
      tests: parseAllTestsPassing(content),
    });
  } catch (error) {
    console.error('[handoff] GET error', error);
    return NextResponse.json({ error: 'Failed to read HANDOFF.md' }, { status: 500 });
  }
}
