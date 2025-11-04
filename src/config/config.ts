// config.ts
import { config } from "dotenv";
import { getPrompt } from './prompts';

config();

export const DEEPGRAM_WS_URL = "wss://agent.deepgram.com/v1/agent/converse";
export const DEEPGRAM_API_KEY = process.env.DEEPGRAM_API_KEY!;

/**
 * Enhanced Agent Configuration - Combining voice-only app's file-based prompts
 * with main app's comprehensive function definitions
 */

// Loads a prompt description file - now imports directly from prompts folder
function loadDescription(filePath: string): string {
  return getPrompt(filePath);
}

// Agent configuration - created as a function to ensure prompts load at runtime
// This should only be called server-side
export function getAgentConfig() {
  // Safety check - warn if called client-side
  if (typeof window !== 'undefined') {
    console.warn('[Config] ⚠️ getAgentConfig() called on client-side - prompts may be empty');
  }
  return {
    type: "Settings",
    audio: {
      input: { encoding: "linear16", sample_rate: 16000 },
      output: { encoding: "linear16", sample_rate: 16000, container: "none" }
    },
    agent: {
      language: "en",
      listen: {
        provider: { type: "deepgram", model: "nova-2" }
      },
      think: {
        provider: { type: "open_ai", model: "gpt-4.1", temperature: 0.7 },
        prompt: loadDescription("prompts/main/main-prompt.txt") + "\n\n" + loadDescription("prompts/grand-villa-info.txt"),
        functions: [
          {
            name: "trustBuilding",
            description: loadDescription("prompts/trust-building.txt"),
            parameters: {
              type: "object",
              properties: {
                name: { type: "string" },
                locationInfo: { type: "string" },
                lovedOneName: { type: "string" },
              },
              required: ["name", "locationInfo", "lovedOneName"]
            }
          },
          {
            name: "situationDiscovery",
            description: loadDescription("prompts/situation-discovery.txt"),
            parameters: {
              type: "object",
              properties: {
                reasonForContact: { type: "string" },
                lovedOneConcern: { type: "string" },
                familyImpact: { type: "string" },
                currentAddress: { type: "string" },
              },
              required: ["reasonForContact", "lovedOneConcern", "familyImpact", "currentAddress"]
            }
          },
          {
            name: "lifestyle-discovery",
            description: loadDescription("prompts/lifestyle-discovery.txt"),
            parameters: {
              type: "object",
              properties: {
                dailyRoutine: { type: "string" },
                hobbies: { type: "string" }
              },
              required: ["dailyRoutine", "hobbies"]
            }
          },
          {
            name: "readiness-discovery",
            description: loadDescription("prompts/readiness-discovery.txt"),
            parameters: {
              type: "object",
              properties: {
                isLovedOneAware: { type: "string" },
                lovedOneFeelings: { type: "string" },
                decisionMakers: { type: "string" },
              },
              required: ["isLovedOneAware", "lovedOneFeelings", "decisionMakers"]
            }
          },
          {
            name: "priorities-discovery",
            description: loadDescription("prompts/verify_identity.txt"),
            parameters: {
              type: "object",
              properties: {
                communityPriorities: { type: "string" },
              },
              required: ["communityPriorities"]
            }
          },
          {
            name: "needs-matching",
            description: "When verifying customer for placing an order, if email is not working verify by phone number",
            parameters: {
              type: "object",
              properties: {
              },
              required: []
            }
          },
          {
            name: "schedulevisit",
            description: loadDescription("prompts/schedule-visit.txt"),
            parameters: {
              type: "object",
              properties: {
                meetingTime: { type: "string" },
              },
              required: ["meetingTime"]
            }
          },
        ]
      },
      greeting: "Welcome! Glad to see you at Grand Villas — looks like home and feels like family! I'm here to help you find the perfect senior living options today."
    }
  };
}

// Pre-build config server-side at module initialization
// This ensures prompts are loaded from .txt files before any client code runs
let _agentConfigCache: ReturnType<typeof getAgentConfig> | null = null;

function buildConfigServerSide() {
  if (typeof window === 'undefined' && !_agentConfigCache) {
    console.log('[Config] 🔧 Building agent config server-side with prompts from .txt files...');
    _agentConfigCache = getAgentConfig();
    console.log('[Config] ✅ Agent config built server-side');
  }
  return _agentConfigCache;
}

// Build config on server-side module initialization
if (typeof window === 'undefined') {
  buildConfigServerSide();
}

export function getAgentConfigCached() {
  // If not cached, build it now (server-side only)
  if (!_agentConfigCache) {
    if (typeof window === 'undefined') {
      // Server-side: build config with prompts from .txt files
      _agentConfigCache = getAgentConfig();
      console.log('[Config] ✅ Config built server-side with prompts from .txt files');
    } else {
      // Client-side: This shouldn't happen - config should be pre-built server-side
      console.error('[Config] ❌ getAgentConfigCached() called client-side - config needs to be built server-side');
      console.error('[Config] ❌ Returning empty config - prompts will be empty');
      // Return config anyway (will have empty prompts)
      return getAgentConfig();
    }
  }
  return _agentConfigCache;
}

// Export as constant - only evaluate on server-side
// Use ReturnType to infer the type from getAgentConfig() to avoid circular reference
export const AGENT_CONFIG: ReturnType<typeof getAgentConfig> = typeof window === 'undefined' 
  ? (_agentConfigCache || getAgentConfig()) 
  : ({} as ReturnType<typeof getAgentConfig>); // Placeholder for client-side - should not be used

  