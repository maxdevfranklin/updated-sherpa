// config.ts
import { config } from "dotenv";
config();

export const DEEPGRAM_WS_URL = "wss://agent.deepgram.com/v1/agent/converse";
export const DEEPGRAM_API_KEY = process.env.DEEPGRAM_API_KEY!;

// Browser-compatible prompts (no fs access needed)
export function loadDescription(filePath: string): string {
  const prompts: Record<string, string> = {
    "prompts/main/main-prompt.txt": "You are a helpful AI assistant for Ava Sales AI. Help customers with their questions and guide them through the sales process. Be friendly, professional, and concise.",
    "prompts/trust-building.txt": "Build trust with the customer by collecting their personal information: firstName, lastName, locationInfo, and lovedOneName.",
    "prompts/situation-discovery.txt": "Discover the customer's situation by collecting: reasonForContact, lovedOneConcern, familyImpact, and currentAddress.",
    "prompts/lifestyle-discovery.txt": "Learn about the customer's lifestyle by collecting: dailyRoutine and hobbies.",
    "prompts/readiness-discovery.txt": "Assess customer readiness by collecting: isLovedOneAware, lovedOneFeelings, and decisionMakers.",
    "prompts/verify_identity.txt": "Understand customer priorities by collecting: communityPriorities.",
    "prompts/schedule-visit.txt": "Schedule a visit by collecting: meetingTime."
  };
  return prompts[filePath] || "";
}

// Agent configuration
export const AGENT_CONFIG = {
  type: "Settings",
  audio: {
    input: { encoding: "linear16", sample_rate: 16000 },
    output: { encoding: "linear16", sample_rate: 16000, container: "none" }
  },
  agent: {
    language: "en",
    listen: {
      provider: { type: "deepgram", model: "nova-3" }
    },
    think: {
      provider: { type: "open_ai", model: "gpt-4.1", temperature: 0.7 },
      prompt: loadDescription("prompts/main/main-prompt.txt"),
      functions: [
        {
          name: "trustBuilding",
          description: loadDescription("prompts/trust-building.txt"),
          parameters: {
            type: "object",
            properties: {
              firstName: { type: "string" },
              lastName: { type: "string" },
              locationInfo: { type: "string" },
              lovedOneName: { type: "string" },
            },
            required: ["firstName", "lastName", "locationInfo", "lovedOneName"]
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
    greeting: "Hello! Thank you for calling Ava Sales AI. How may I assist you today?"
  }
};