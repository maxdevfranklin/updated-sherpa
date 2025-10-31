import {
  trustBuilding,
  situationDiscovery,
  lifestyleDiscovery,
  readinessDiscovery,
  prioritiesDiscovery
} from './functionService';
import { VoiceSession } from '../models/VoiceSession';
import { FunctionArgs, FunctionResult } from '../types/FunctionTypes';

async function executeFunctionCall(funcName: string, args: FunctionArgs, session: VoiceSession): Promise<FunctionResult> {
  if (['trustBuilding', 'situationDiscovery', 'lifestyleDiscovery', 'readinessDiscovery', 'prioritiesDiscovery'].includes(funcName)) {
    switch (funcName) {
      case 'trustBuilding':
        return await trustBuilding(args, session);
      case 'situationDiscovery':
        return await situationDiscovery(args, session);
      case 'lifestyleDiscovery':
        return await lifestyleDiscovery(args, session);
      case 'readinessDiscovery':
        return await readinessDiscovery(args, session);
      case 'prioritiesDiscovery':
        return await prioritiesDiscovery(args, session);
      default:
        throw new Error(`Unknown function: ${funcName}`);
    }
  }
  console.warn(`[Function] Unknown function: ${funcName}`);
  return { error: `Unknown function: ${funcName}` };
}

function createFunctionCallResponse(funcId: string, funcName: string, result: any) {
  return {
    type: "FunctionCallResponse",
    id: funcId,
    name: funcName,
    content: JSON.stringify(result),
  };
}

export async function handleFunctionCallRequest(decoded: any, session: VoiceSession): Promise<any[]> {
  const responses: any[] = [];
  
  for (const functionCall of decoded.functions ?? []) {
    const funcName = functionCall.name;
    const funcId = functionCall.id;
    const args = JSON.parse(functionCall.arguments || "{}");
    console.log(`[Function call request] ${funcName}, arguments:`, args);

    const result = await executeFunctionCall(funcName, args, session);
    const response = createFunctionCallResponse(funcId, funcName, result);

    if (funcName === "finish_call" && args.client_wants_to_finish) {
      console.log(`[Function call response] Sent finish_call`);
    }

    responses.push(response);
  }
  
  return responses;
}

export { createFunctionCallResponse, executeFunctionCall };