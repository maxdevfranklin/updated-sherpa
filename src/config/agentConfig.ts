import { AGENT_CONFIG } from './config';

export function getAgentSettingsOptions() {
  return {
    type: "Settings",
    audio: {
      input: { encoding: "mulaw", sample_rate: 8000 },
      output: { encoding: "mulaw", sample_rate: 8000, container: "none" }
    },
    agent: AGENT_CONFIG.agent
  };
}
