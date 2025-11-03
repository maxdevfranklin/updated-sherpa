import { createClient } from '@deepgram/sdk';
import { EventEmitter } from 'events';
import { getAgentConfig, getAgentConfigCached } from '../config/config';
import { logger } from '../../utils/logger';
import { KnowledgeBaseService } from './KnowledgeBaseService';

/**
 * Deepgram Voice Agent - Using SDK exactly as per documentation
 * Based on https://developers.deepgram.com/docs/voice-agent
 */
export class DeepgramAgent extends EventEmitter {
  private deepgram: any;
  private agent: any;
  private apiKey: string;
  private isConnected: boolean = false;
  private isConfigured: boolean = false;
  private agentConfig: any = null;
  private knowledgeBaseService: KnowledgeBaseService;

  constructor(apiKey: string, agentConfig?: any) {
    super();
    this.apiKey = apiKey;
    this.deepgram = createClient(apiKey);
    this.agentConfig = agentConfig;
    this.knowledgeBaseService = new KnowledgeBaseService();
  }

  /**
   * Connect to Deepgram Voice Agent API using SDK
   */
  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        logger.log('[DeepgramAgent] 🚀 Starting connection process...');
        logger.log(`[DeepgramAgent] Using API key: ${this.apiKey ? `${this.apiKey.substring(0, 8)}...` : 'MISSING'}`);

        // Create agent using the correct SDK method
        console.log('[DeepgramAgent] 📡 Creating agent instance...');
        this.agent = this.deepgram.agent();
        console.log('[DeepgramAgent] ✅ Agent instance created:', !!this.agent);

        // Setup the connection first
        console.log('[DeepgramAgent] 🔌 Setting up connection...');
        this.agent.setupConnection();
        console.log('[DeepgramAgent] ✅ Connection setup initiated');

        // Set up event handlers after connection is initiated
        console.log('[DeepgramAgent] 🔧 Setting up event handlers...');
        this.setupEventHandlers();

        // Set up configuration listener
        const settingsAppliedHandler = () => {
          logger.log('[DeepgramAgent] ✅ Configuration accepted - Ready to send audio');
          this.isConfigured = true;
          this.removeListener('settings_applied', settingsAppliedHandler);
          resolve();
        };
        this.once('settings_applied', settingsAppliedHandler);

        // Set up timeout
        const timeout = setTimeout(() => {
          this.removeListener('settings_applied', settingsAppliedHandler);
          logger.error('[DeepgramAgent] ❌ Timeout waiting for SettingsApplied after 10 seconds');
          logger.error(`[DeepgramAgent] Current state - isConnected: ${this.isConnected}, isConfigured: ${this.isConfigured}`);
          reject(new Error('Timeout waiting for SettingsApplied'));
        }, 10000);

        // Clear timeout when settings are applied
        this.once('settings_applied', () => clearTimeout(timeout));

        console.log('[DeepgramAgent] 🔄 Waiting for connection and configuration...');

      } catch (error) {
        console.error('[DeepgramAgent] ❌ Failed to connect:', error);
        reject(error);
      }
    });
  }

  /**
   * Set up event handlers for the Deepgram agent
   * Based on official Deepgram JavaScript SDK documentation
   */
  private setupEventHandlers(): void {
    if (!this.agent) {
      console.error('[DeepgramAgent] ❌ Cannot setup event handlers - no agent instance');
      return;
    }

    console.log('[DeepgramAgent] 🔧 Setting up event handlers for agent...');

    // Use WebSocket native event listeners since the agent uses WebSocket internally
    if (this.agent.conn) {
      console.log('[DeepgramAgent] 🔌 Setting up WebSocket event handlers...');

      this.agent.conn.addEventListener('open', () => {
        console.log('[DeepgramAgent] ✅ WebSocket opened - Connected to Deepgram');
        console.log('[DeepgramAgent] ✅ WebSocket URL:', this.agent.conn.url);
        console.log('[DeepgramAgent] ✅ WebSocket readyState:', this.agent.conn.readyState);
        console.log('[DeepgramAgent] ✅ WebSocket protocol:', this.agent.conn.protocol);
        this.isConnected = true;
        this.emit('open');
        // Send configuration after connection is established
        console.log('[DeepgramAgent] 🔧 Connection established, sending configuration...');
        this.configure().catch(error => {
          console.error('[DeepgramAgent] ❌ Error during configuration:', error);
        });
      });

      this.agent.conn.addEventListener('close', (event: any) => {
        console.log('[DeepgramAgent] ❌ WebSocket closed');
        console.log('[DeepgramAgent] ❌ Close event code:', event.code);
        console.log('[DeepgramAgent] ❌ Close event reason:', event.reason);
        console.log('[DeepgramAgent] ❌ Close event wasClean:', event.wasClean);
        this.isConnected = false;
        this.isConfigured = false;
        this.emit('close');
      });

      this.agent.conn.addEventListener('error', (err: any) => {
        console.error('[DeepgramAgent] ❌ WebSocket error occurred');
        console.error('[DeepgramAgent] ❌ Error type:', typeof err);
        console.error('[DeepgramAgent] ❌ Error message:', err.message);
        console.error('[DeepgramAgent] ❌ Error stack:', err.stack);

        // Attempt to reconnect on certain error types
        if (this.shouldAttemptReconnect(err)) {
          console.log('[DeepgramAgent] 🔄 Attempting to reconnect...');
          this.attemptReconnect();
        }

        this.emit('deepgram_error', err);
      });

      this.agent.conn.addEventListener('message', (event: any) => {
        // Check if it's binary data (audio) or text (JSON message)
        if (event.data instanceof ArrayBuffer || event.data instanceof Buffer || event.data instanceof Uint8Array || event.data instanceof Blob) {
          // Handle Blob differently - need to convert to ArrayBuffer first
          if (event.data instanceof Blob) {
            event.data.arrayBuffer().then((arrayBuffer: ArrayBuffer) => {
              const audioBuffer = Buffer.from(arrayBuffer);
              this.emit('audio', audioBuffer);
            }).catch((error: any) => {
              console.error('[DeepgramAgent] ❌ Error converting Blob to Buffer:', error);
            });
          } else {
            const audioBuffer = Buffer.from(event.data);
            this.emit('audio', audioBuffer);
          }
        } else {
          this.handleWebSocketMessage(event.data);
        }
      });

      console.log('[DeepgramAgent] ✅ WebSocket event handlers setup complete');
    } else {
      console.error('[DeepgramAgent] ❌ No WebSocket connection available');
    }

    console.log('[DeepgramAgent] ✅ Event handlers setup complete');
  }

  /**
   * Send configuration to Deepgram
   */
  private async configure(): Promise<void> {
    if (!this.agent) {
      console.error('[DeepgramAgent] ❌ Cannot configure - no agent instance');
      return;
    }

    console.log('[DeepgramAgent] 🔧 Preparing configuration...');

    // Use dynamic agent configuration if available, otherwise fall back to static
    let config: any;
    if (this.agentConfig) {
      config = await this.buildAgentConfig(this.agentConfig);
      console.log('[DeepgramAgent] 📋 Using dynamic agent configuration for:', this.agentConfig.agentName);
      console.log('[DeepgramAgent] 📝 Custom welcome message:', this.agentConfig.welcomeMessage);
      console.log('[DeepgramAgent] 🎤 Custom voice:', this.agentConfig.agentVoice);
    } else {
      // Try to get config from cache (server-side), otherwise fetch from API
      if (typeof window === 'undefined') {
        // Server-side: use cached config with prompts from .txt files
        config = getAgentConfigCached();
        console.log('[DeepgramAgent] 📋 Using static configuration (server-side)');
      } else {
        // Client-side: fetch config from API route which builds it server-side
        console.log('[DeepgramAgent] 📋 Fetching config from API (client-side)...');
        try {
          const response = await fetch('/api/agent-config');
          if (response.ok) {
            config = await response.json();
            console.log('[DeepgramAgent] ✅ Config fetched from API with prompts');
          } else {
            console.error('[DeepgramAgent] ❌ Failed to fetch config from API');
            // Fallback to cached version (will have empty prompts)
            config = getAgentConfigCached();
          }
        } catch (error) {
          console.error('[DeepgramAgent] ❌ Error fetching config from API:', error);
          // Fallback to cached version (will have empty prompts)
          config = getAgentConfigCached();
        }
      }
    }

    console.log('[DeepgramAgent] 📋 Configuration to send:', JSON.stringify(config, null, 2));

    try {
      // Send configuration as JSON string to the WebSocket connection
      console.log('[DeepgramAgent] 📤 Sending configuration to Deepgram...');
      if (this.agent.conn && this.agent.conn.readyState === 1) { // WebSocket.OPEN
        this.agent.conn.send(JSON.stringify(config));
        console.log('[DeepgramAgent] ✅ Configuration sent successfully');
      } else {
        console.error('[DeepgramAgent] ❌ WebSocket not ready for sending configuration');
      }
    } catch (error) {
      console.error('[DeepgramAgent] ❌ Error sending configuration:', error);
    }
  }

  /**
   * Build Deepgram configuration from agent data
   */
  private async buildAgentConfig(agentData: any): Promise<any> {
    // Use cached version to ensure prompts are loaded correctly server-side
    const baseConfig = getAgentConfigCached();

    // Log base configuration details
    console.log('[DeepgramAgent] 🏗️ Building agent configuration:');
    console.log(`[DeepgramAgent] 📋 Base functions available: ${baseConfig.agent.think.functions.length}`);
    console.log('[DeepgramAgent] 📋 Base function names:', baseConfig.agent.think.functions.map((f: any) => f.name));

    // Fetch knowledge base if shop is available
    let knowledgeBase = '';
    if (agentData.shop) {
      console.log(`[DeepgramAgent] 🏪 Fetching knowledge base for shop: ${agentData.shop}`);
      knowledgeBase = await this.knowledgeBaseService.getShopKnowledgeBase(agentData.shop);
      if (knowledgeBase) {
        console.log(`[DeepgramAgent] 📚 Knowledge base loaded: ${knowledgeBase.length} characters`);
      } else {
        console.log(`[DeepgramAgent] ⚠️ No knowledge base found for shop: ${agentData.shop}`);
      }
    } else {
      console.log('[DeepgramAgent] ⚠️ No shop information available for knowledge base lookup');
    }

    // Override with agent-specific configuration
    const customConfig = {
      ...baseConfig,
      agent: {
        ...baseConfig.agent,
        // Override greeting message
        greeting: agentData.welcomeMessage || baseConfig.agent.greeting,
        // Override functions based on allowedActions
        think: {
          ...baseConfig.agent.think,
          // Filter functions based on allowedActions
          functions: this.filterFunctionsByAllowedActions(
            baseConfig.agent.think.functions,
            agentData.allowedActions || []
          ),
          // Add custom instructions and knowledge base
          prompt: this.buildCustomPrompt(
            baseConfig.agent.think.prompt,
            agentData.embeddedInstructions,
            knowledgeBase
          ),
        }
      }
    };

    // Log the final greeting message that will be used
    console.log('[DeepgramAgent] 🎯 Final greeting message:', customConfig.agent.greeting);
    console.log('[DeepgramAgent] 🎯 Agent data welcomeMessage:', agentData.welcomeMessage);
    console.log('[DeepgramAgent] 🎯 Base config greeting:', baseConfig.agent.greeting);

    // Log final configuration details
    console.log('[DeepgramAgent] 🔧 Final Configuration Summary:');
    console.log(`[DeepgramAgent] 📝 Prompt length: ${customConfig.agent.think.prompt.length} characters`);
    console.log(`[DeepgramAgent] 🔧 Functions loaded: ${customConfig.agent.think.functions.length}`);
    console.log(`[DeepgramAgent] 🎤 Voice provider: ElevenLabs (external)`);
    console.log(`[DeepgramAgent] 🎯 Greeting: "${customConfig.agent.greeting}"`);
    console.log(`[DeepgramAgent] 📚 Knowledge base included: ${knowledgeBase ? 'Yes' : 'No'}`);

    return customConfig;
  }

  /**
   * Load all functions - permission checks are handled inside each function
   */
  private filterFunctionsByAllowedActions(functions: any[], allowedActions: string[]): any[] {
    console.log('[DeepgramAgent] 🔧 Function Loading Strategy:');
    console.log('[DeepgramAgent] 📋 All available functions:', functions.map(f => f.name));
    console.log('[DeepgramAgent] 🎯 Agent allowed actions:', allowedActions);
    console.log('[DeepgramAgent] ✅ Loading ALL functions - permission checks handled internally');

    // Always return all functions - permission checks are done inside each function
    return functions;
  }

  /**
   * Build custom prompt with agent instructions and knowledge base
   */
  private buildCustomPrompt(basePrompt: string, customInstructions?: string, knowledgeBase?: string): string {
    let finalPrompt = basePrompt;

    // Add custom instructions if available
    if (customInstructions) {
      finalPrompt += `\n\nAdditional Instructions: ${customInstructions}`;
    }

    // Add knowledge base if available
    if (knowledgeBase) {
      finalPrompt += `\n\n${knowledgeBase}`;
    }

    return finalPrompt;
  }

  /**
   * Handle WebSocket messages from Deepgram
   * Based on official Deepgram Voice Agent API documentation
   */
  private handleWebSocketMessage(data: any): void {
    try {
      // Parse the WebSocket message
      const message = typeof data === 'string' ? JSON.parse(data) : data;
      console.log('deepgram message', message.type);
      // Handle different message types based on Deepgram Voice Agent API
      if (message.type === 'Welcome') {
        console.log('[DeepgramAgent] ✅ Welcome message received - connection confirmed');
        this.emit('welcome', message);
      } else if (message.type === 'SettingsApplied') {
        console.log('[DeepgramAgent] ✅ Settings applied successfully');
        // Set isConfigured to true BEFORE emitting the event
        // This ensures the event handler can send audio immediately
        this.isConfigured = true;
        console.log('[DeepgramAgent] ✅ isConfigured set to true');
        console.log('[DeepgramAgent] 📢 Emitting settings_applied event now...');
        this.emit('settings_applied', message);
        console.log('[DeepgramAgent] ✅ settings_applied event emitted');
      } else if (message.type === 'Transcript') {
        this.handleTranscript(message);
      } else if (message.type === 'ConversationText') {
        this.handleConversationText(message);
      } else if (message.type === 'UserStartedSpeaking') {
        console.log('[DeepgramAgent] 📋 UserStartedSpeaking', JSON.stringify(message));
        this.emit('user_started_speaking');
      } else if (message.type === 'AgentStartedSpeaking') {
        this.emit('agent_started_speaking');
      } else if (message.type === 'AgentAudioDone') {
        this.emit('agent_audio_done');
      } else if (message.type === 'FunctionCallRequest') {
        console.log('[DeepgramAgent] 🔧 Function call request received:', message);
        this.emit('function_call', message);
      } else if (message.type === 'Error') {
        console.error('[DeepgramAgent] ❌ Agent error message:', message);
        this.emit('deepgram_error', message);
      } else if (message.type === 'Audio') {
        // Handle audio data from Deepgram (no logging to reduce noise)
        if (message.audio) {
          const audioBuffer = Buffer.from(message.audio, 'base64');
          this.emit('audio', audioBuffer);
        }
      } else {
        // Only log unknown message types if they're not common/expected
        if (message.type !== 'Heartbeat' && message.type !== 'Ping') {
          console.log('[DeepgramAgent] 🔍 Unknown message type:', message.type);
        }
      }
    } catch (error) {
      console.error('[DeepgramAgent] ❌ Error handling WebSocket message:', error);
    }
  }

  /**
   * Handle transcript from Deepgram
   */
  private handleTranscript(transcript: any): void {
    try {
      const text = transcript.channel?.alternatives?.[0]?.transcript;
      const isFinal = transcript.is_final;
      
      // Log all transcripts for debugging (even interim ones)
      if (text && text.trim()) {
        console.log(`[DeepgramAgent] 📝 Transcript (${isFinal ? 'FINAL' : 'INTERIM'}):`, text);
      }
      
      if (isFinal && text && text.trim()) {
        // Check if this is from the user or assistant
        // In Voice Agent, user transcripts come through this channel
        // Assistant transcripts are handled separately via AgentFinishedSpeaking
        console.log('[DeepgramAgent] 👤👤👤 User said (FINAL):', text);
        this.emit('user_transcript', text, transcript);
      }
    } catch (error) {
      console.error('[DeepgramAgent] ❌ Error handling transcript:', error);
      console.error('[DeepgramAgent] ❌ Transcript data:', transcript);
    }
  }

  /**
   * Handle conversation text from Deepgram Voice Agent
   * This contains the actual conversation text that should be saved as transcripts
   */
  private handleConversationText(message: any): void {
    const { role, content } = message;

    if (content && content.trim()) {
      if (role === 'user') {
        console.log(`\x1b[34m\n[DeepgramAgent] 👤 User said:${content}\x1b[0m`);
        this.emit('user_transcript', content, message);
      } else if (role === 'assistant') {
        console.log(`\x1b[34m\n[DeepgramAgent] 🤖 Assistant said: ${content}\x1b[0m`);
        this.emit('assistant_transcript', content, message);
      }
    }
  }

  /**
   * Log assistant transcript manually
   * Since Deepgram Voice Agent doesn't provide assistant text in events,
   * we need to manually track what the assistant says
   */
  logAssistantTranscript(text: string): void {
    if (text && text.trim()) {
      console.log('[DeepgramAgent] 🤖 Assistant said:', text);
      this.emit('assistant_transcript', text, { timestamp: new Date() });
    }
  }

  /**
   * Get connection status
   */
  get connected(): boolean {
    return this.isConnected;
  }

  /**
   * Get configuration status
   */
  get configured(): boolean {
    return this.isConfigured;
  }

  /**
   * Send audio to Deepgram Agent
   * Based on official Deepgram Voice Agent API documentation
   */
  sendAudio(audioChunk: Buffer): void {
    if (!this.agent) {
      console.error('[DeepgramAgent] ❌ Cannot send audio - no agent instance');
      return;
    }

    if (!this.isConnected) {
      console.error('[DeepgramAgent] ❌ Cannot send audio - not connected');
      return;
    }

    if (!this.isConfigured) {
      console.error('[DeepgramAgent] ❌ Cannot send audio - not configured');
      return;
    }

    try {
      // Send binary audio data directly to the WebSocket connection
      // This matches the Twilio implementation approach
      if (this.agent.conn && this.agent.conn.readyState === 1) { // WebSocket.OPEN
        this.agent.conn.send(audioChunk);
        
        // Log occasionally to verify audio is being sent (matches Twilio pattern)
        if (Math.random() < 0.005) { // Log ~0.5% of chunks to reduce noise
          console.log('[DeepgramAgent] 📤 Audio chunk sent:', audioChunk.length, 'bytes');
        }
      } else {
        console.error('[DeepgramAgent] ❌ WebSocket not ready for sending audio. ReadyState:', this.agent.conn?.readyState);
      }
      
    } catch (error) {
      console.error('[DeepgramAgent] ❌ Error sending audio:', error);
    }
  }

  /**
   * Send function call response back to Deepgram
   */
  sendFunctionResponse(functionCallId: string, result: any, functionName?: string): void {
    if (!this.agent || !this.isConnected) {
      console.warn('[DeepgramAgent] Cannot send function response - not connected');
      return;
    }

    try {
      // Deepgram expects FunctionCallResponse with specific fields:
      // - type: "FunctionCallResponse" (added automatically by SDK)
      // - id: function call ID
      // - name: function name
      // - content: result as string
      const response = {
        id: functionCallId,
        name: functionName || 'unknown_function',
        content: JSON.stringify(result)
      };

      this.agent.functionCallResponse(response);
    } catch (error) {
      console.error('[DeepgramAgent] Error sending function response:', error);
    }
  }

  /**
   * Determine if we should attempt to reconnect based on error type
   */
  private shouldAttemptReconnect(error: any): boolean {
    // Don't reconnect for authentication errors or invalid API keys
    if (error.message?.includes('401') || error.message?.includes('unauthorized')) {
      return false;
    }

    // Don't reconnect for invalid requests
    if (error.message?.includes('400') || error.message?.includes('bad request')) {
      return false;
    }

    // Attempt to reconnect for network errors, timeouts, and connection issues
    return error.message?.includes('network') ||
      error.message?.includes('timeout') ||
      error.message?.includes('connection') ||
      error.code === 'ECONNRESET' ||
      error.code === 'ENOTFOUND';
  }

  /**
   * Attempt to reconnect with exponential backoff
   */
  private async attemptReconnect(): Promise<void> {
    const maxRetries = 3;
    const baseDelay = 1000; // 1 second

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const delay = baseDelay * Math.pow(2, attempt - 1); // Exponential backoff

      console.log(`[DeepgramAgent] 🔄 Reconnection attempt ${attempt}/${maxRetries} in ${delay}ms...`);

      await new Promise(resolve => setTimeout(resolve, delay));

      try {
        await this.connect();
        console.log('[DeepgramAgent] ✅ Reconnection successful');
        return;
      } catch (error) {
        console.error(`[DeepgramAgent] ❌ Reconnection attempt ${attempt} failed:`, error);

        if (attempt === maxRetries) {
          console.error('[DeepgramAgent] ❌ All reconnection attempts failed');
          this.emit('reconnection_failed', error);
        }
      }
    }
  }

  /**
   * Close the connection
   */
  close(): void {
    console.log('[DeepgramAgent] 🔄 Attempting to close agent...');

    if (this.agent && this.agent.conn) {
      try {
        // Close the WebSocket connection directly
        this.agent.conn.close();
        console.log('[DeepgramAgent] ✅ WebSocket connection closed successfully');
      } catch (error) {
        console.error('[DeepgramAgent] ❌ Error closing WebSocket connection:', error);
      }
    } else {
      console.log('[DeepgramAgent] ⚠️ No WebSocket connection to close');
    }
  }
}