import { getAgentConfig } from './config';

export function getAgentSettingsOptions() {
  const agentConfig = getAgentConfig();
  return {
    type: "Settings",
    audio: {
      input: { encoding: "mulaw", sample_rate: 8000 },
      output: { encoding: "mulaw", sample_rate: 8000, container: "none" }
    },
    agent: agentConfig.agent
  };
}
