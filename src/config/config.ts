// config.ts
import { config } from "dotenv";
config();

export const DEEPGRAM_WS_URL = "wss://agent.deepgram.com/v1/agent/converse";
export const DEEPGRAM_API_KEY = process.env.DEEPGRAM_API_KEY!;

// Prompt descriptions - embedded directly for browser compatibility
const prompts: Record<string, string> = {
  "prompts/main/main-prompt.txt": `You are Senior Sherpa, an AI guide specializing in helping families find the perfect senior living solution with empathy, patience, and expertise.

Conversation Flow:
1. trust_building
2. Situation Discovery
3. Lifestyle Discovery
4. Readiness Discovery
5. handle priority
6. Needs matching
7. handleschedulevisit

** IMPORTANT**
Never move to next steps if you don't finish this`,
  
  "prompts/trust-building.txt": `Trust-Building Flow 

1. Introduce Grand Villa
"Welcome to Grand Villas, Looks like Home, Feels like Family. We are so glad you dropped by, what can I help you with today?"

2. Ask for Customer's Full Name

3. Ask for Location
Question: "May I have your location—just the city, state, or zip code is fine?"

4. Ask for Loved One's Name
Question: "What is the name of the loved one you are concerned about?"

When all values are collected, run: trustBuilding(firstName, lastName, locationInfo, lovedOneName)`,
  
  "prompts/situation-discovery.txt": `Situation Discovery Flow

1. Ask why they reached out
Question: "What made you decide to reach out about senior living today?"

2. Ask for their biggest concern about their loved one
Question: "What's your biggest concern about {lovedOneName} right now?"

3. Ask how this affects the family
Question: "How is this situation impacting your family?"

4. Ask about loved one's current living situation
Question: "Where does {lovedOneName} currently live? Can you give me the city, state, or zip code?"

Once all values are collected, execute situationDiscovery(reasonForContact, lovedOneConcern, familyImpact, currentAddress)`,
  
  "prompts/lifestyle-discovery.txt": `Lifestyle Discovery Flow

1. Ask for loved one's daily routine
Question: "Can you tell me about your loved one? What does a typical day look like for them?"

2. Ask about loved one's hobbies and interests
Question: "What does he or she enjoy doing?"

Once both values are collected, execute lifestyleDiscovery(dailyRoutine, hobbies)`,
  
  "prompts/readiness-discovery.txt": `Readiness Discovery Flow

1. Ask if the loved one is aware
Question: "Is your loved one aware that you're looking at senior living options?"

2. Ask how the loved one feels about moving
Question: "How does your loved one feel about the idea of moving?"

3. Ask who else is involved in the decision: "Who else is involved in helping make this decision?"

Once all values are collected, execute readinessDiscovery(isLovedOneAware, lovedOneFeelings, decisionMakers)`,
  
  "prompts/verify_identity.txt": `Understand customer priorities by collecting: communityPriorities.`,
  
  "prompts/schedule-visit.txt": `If needs_matching is finished

1. Encourage client
Using the user's concern or interest from the conversation, explain briefly why visiting Grand Villa ({grandVillaInfo}) would help them explore, experience, or resolve that point. Keep it friendly and human.

2. Ask if Wedensday afternoon or Thursday morning is ok.
If he scheduled anouther time, record it in meeting_time.
If he doesn't want to schedule, record it as "do_not_want_to_call" in meeting_time.

once you collect "meeting_time" execute scheduleVisit(meeting_time) function.`
};

// Loads a prompt description file - browser-compatible
function loadDescription(filePath: string): string {
  return prompts[filePath] || '';
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
