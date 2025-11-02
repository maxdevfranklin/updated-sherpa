// app/api/agent-config/route.ts
// Server-side API route to get agent configuration with prompts loaded from .txt files
import { NextResponse } from 'next/server';
import { getAgentConfig } from '@/src/config/config';

export async function GET() {
  try {
    // Build config server-side with prompts from .txt files
    const config = getAgentConfig();
    return NextResponse.json(config);
  } catch (error) {
    console.error('[API] Error building agent config:', error);
    return NextResponse.json(
      { error: 'Failed to build agent config' },
      { status: 500 }
    );
  }
}

