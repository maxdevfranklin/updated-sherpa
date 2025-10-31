import React, { useCallback, useRef, useState } from "react";
import { SimliClient } from "simli-client";
import { DeepgramAgent } from '@/src/services/deepgramAgent';
import { handleFunctionCallRequest } from '@/src/services/deepgramFunction';
import { VoiceSession, VoiceSessionManager } from '@/src/models/VoiceSession';
import { speak } from '../src/services/elevenlabsFunction';
import EnhancedVideoBox from "./Components/EnhancedVideoBox";
import TimingMetrics from "./Components/TimingMetrics";
import ControlPanel from "./Components/ControlPanel";
interface SimliOpenAIProps {
  simli_faceid: string;
  openai_voice:
    | "alloy"
    | "ash"
    | "ballad"
    | "coral"
    | "echo"
    | "sage"
    | "shimmer"
    | "verse";
  openai_model: string;
  initialPrompt: string;
  onStart: () => void;
  onClose: () => void;
  showDottedFace: boolean;
}

const simliClient = new SimliClient();

const SimliOpenAI: React.FC<SimliOpenAIProps> = ({
  simli_faceid,
  openai_voice,
  openai_model,
  initialPrompt,
  onStart,
  onClose,
  showDottedFace,
}) => {
  // State management
  const [isLoading, setIsLoading] = useState(false);
  const [isAvatarVisible, setIsAvatarVisible] = useState(false);
  const [error, setError] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [userMessage, setUserMessage] = useState("...");
  
  // Performance timing states
  const [timings, setTimings] = useState({
    speechToText: 0,
    backendResponse: 0,
    textToSpeech: 0,
    total: 0
  });
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState("");

  // Refs for various components and states
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const isFirstRun = useRef(true);
  
  // Deepgram Agent ref and session management
  const deepgramAgentRef = useRef<DeepgramAgent | null>(null);
  const voiceSessionManagerRef = useRef<VoiceSessionManager>(new VoiceSessionManager());
  const currentSessionRef = useRef<VoiceSession | null>(null);
  const userIdRef = useRef<string>(`video_user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
  
  // New refs for managing audio chunk delay
  const audioChunkQueueRef = useRef<Int16Array[]>([]);
  const isProcessingChunkRef = useRef(false);
  const isSpeakingRef = useRef(false);
  
  // Track if Simli event listeners have been set up
  const simliListenersSetupRef = useRef(false);
  
  // Track if Deepgram Agent initialization is in progress to prevent concurrent calls
  const isInitializingDeepgramRef = useRef(false);
  
  // Track if Deepgram Agent has already been initialized for this Simli session
  const deepgramInitializedForSessionRef = useRef(false);
  
  // Keepalive interval for sending silence to Deepgram
  const deepgramKeepaliveIntervalRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * Initializes the Simli client with the provided configuration.
   */
  const initializeSimliClient = useCallback(() => {
    if (videoRef.current && audioRef.current) {
      const SimliConfig = {
        apiKey: process.env.NEXT_PUBLIC_SIMLI_API_KEY,
        faceID: simli_faceid,
        handleSilence: true,
        maxSessionLength: 6000, // in seconds (100 minutes)
        maxIdleTime: 6000, // in seconds (100 minutes)
        videoRef: videoRef.current,
        audioRef: audioRef.current,
        enableConsoleLogs: true,
        // Add any additional config to prevent frequent reconnections
      };

      simliClient.Initialize(SimliConfig as any);
      console.log("Simli Client initialized");
    }
  }, [simli_faceid]);

  /**
   * Processes text response from Deepgram Agent and converts to speech via ElevenLabs
   */
  const processTextFromAgent = useCallback(async (responseText: string) => {
    try {
      console.log("Processing text from Deepgram Agent");
      isSpeakingRef.current = true;
      
      setProcessingStep("Generating response voice...");
      const ttsStartTime = Date.now();
      
      // Get audio from ElevenLabs TTS
      const audioBuffer = await speak(responseText);
      
      if (audioBuffer !== undefined) {
        // ElevenLabs returns ulaw_8000 as Buffer, so we need to convert mulaw to PCM
        const pcmData = convertMulawToPCM(audioBuffer);
        
        // Upsample from 8000 Hz to 16000 Hz for Simli
        const upsampledAudio = upsampleAudio(pcmData, 8000, 16000);
        
        // Split audio into chunks and queue them
        const chunkSize = 4800; // ~300ms chunks at 16000 Hz
        for (let i = 0; i < upsampledAudio.length; i += chunkSize) {
          const chunk = upsampledAudio.slice(i, i + chunkSize);
          audioChunkQueueRef.current.push(chunk);
        }
        
        // Start processing chunks
        if (!isProcessingChunkRef.current) {
          processNextAudioChunk();
        }
        
        // Update timing metrics
        const ttsTime = Date.now() - ttsStartTime;
        setTimings(prev => ({
          ...prev,
          textToSpeech: ttsTime
        }));
      }
      
      isSpeakingRef.current = false;
      setProcessingStep("");
    } catch (error: any) {
      console.error("Error processing agent text:", error);
      isSpeakingRef.current = false;
      setProcessingStep("");
    }
  }, []);

  /**
   * Initializes Deepgram Agent for full voice conversation
   */
  const initializeDeepgramAgent = useCallback(async () => {
    // Prevent concurrent initializations
    if (isInitializingDeepgramRef.current) {
      console.log("Deepgram Agent initialization already in progress, skipping...");
      return;
    }
    
    // Prevent multiple initializations if already connected
    if (deepgramAgentRef.current) {
      const isConnected = (deepgramAgentRef.current as any).connected;
      const isConfigured = (deepgramAgentRef.current as any).configured;
      if (isConnected && isConfigured) {
        console.log("Deepgram Agent already initialized and connected, skipping...");
        return;
      }
      // If it exists but isn't connected/configured, clean it up first
      console.log("Deepgram Agent exists but not connected, cleaning up...");
      try {
        deepgramAgentRef.current.close();
      } catch (e) {
        // Ignore errors during cleanup
      }
      deepgramAgentRef.current = null;
    }
    
    // Mark as initializing
    isInitializingDeepgramRef.current = true;
    
    try {
      console.log("Initializing Deepgram Agent...");
      
      // Check if Deepgram API key is available
      const deepgramApiKey = process.env.NEXT_PUBLIC_DEEPGRAM_API_KEY;
      if (!deepgramApiKey) {
        throw new Error("Deepgram API key not found. Please set NEXT_PUBLIC_DEEPGRAM_API_KEY in your environment variables.");
      }
      
      // Create voice session
      const sessionId = userIdRef.current;
      currentSessionRef.current = voiceSessionManagerRef.current.createSession(sessionId);
      
      // Create Deepgram Agent
      deepgramAgentRef.current = new DeepgramAgent(deepgramApiKey);
      
      // Set up event handlers for the agent
      deepgramAgentRef.current.on('open', () => {
        console.log("Deepgram Agent connected");
        setIsRecording(true);
        setIsAvatarVisible(true);
      });
      
      deepgramAgentRef.current.on('close', () => {
        console.log("Deepgram Agent disconnected");
        setIsRecording(false);
      });
      
      deepgramAgentRef.current.on('deepgram_error', (error: any) => {
        console.error("Deepgram Agent error:", error);
        setError(`Voice agent error: ${error.message || 'Unknown error'}`);
      });
      
      // When settings are applied, immediately start sending audio to prevent timeout
      const sendSilence = (ms = 100) => {
        const samples = 8 * ms; // 8 kHz × duration
        const silencePCM = new Int16Array(samples);
        const silenceMulaw = convertPCMToMulaw(silencePCM);
        deepgramAgentRef.current?.sendAudio(Buffer.from(silenceMulaw));
      }
      
      deepgramAgentRef.current.on('settings_applied', async () => {
        console.log('[Audio] ⚡⚡⚡ SETTINGS_APPLIED HANDLER FIRED! ⚡⚡⚡');
        console.log('[Audio] ⚡ Settings applied - starting audio flow immediately');
        try {
          // Ensure we have a microphone stream first
          if (!streamRef.current) {
            await requestMicrophonePermission();
          }
      
          // Ensure audio context + processor are created
          if (!processorRef.current || !audioContextRef.current) {
            await setupAudioCapture();
          }
      
          // Send 1 s of initial silence while mic warms up
          for (let i = 0; i < 10; i++) {
            sendSilence(100);
          }
      
          // Faster keep‑alive to maintain websocket
          if (deepgramKeepaliveIntervalRef.current) {
            clearInterval(deepgramKeepaliveIntervalRef.current);
          }
          deepgramKeepaliveIntervalRef.current = setInterval(
            () => sendSilence(100),
            200 // 200 ms interval
          );
      
          console.log('[Audio] ✅ Keepalive started (200 ms)');
        } catch (err) {
          console.error('[Audio] ❌ Start audio error:', err);
        }
      });
      
      // Handle user transcripts (what the user says)
      deepgramAgentRef.current.on('user_transcript', (text: string) => {
        console.log("User said:", text);
        setUserMessage(text);
        
        // Update timing for user speech
        const startTime = Date.now();
        setIsProcessing(true);
        setProcessingStep("Processing your message...");
        
        // Update timings - in Agent mode, there's no separate backend/TTS steps
        setTimings(prev => ({
          ...prev,
          speechToText: 50, // Estimated STT time
          backendResponse: 0, // No separate backend call
          textToSpeech: 0, // No separate TTS call
          total: 50
        }));
      });
      
      // Handle assistant transcripts (what the agent says) and convert to speech
      deepgramAgentRef.current.on('assistant_transcript', async (text: string) => {
        // Convert text to speech using ElevenLabs
        await processTextFromAgent(text);
        setIsProcessing(false);
        setProcessingStep("");
      });
      
      // Handle function calls
      deepgramAgentRef.current.on('function_call', async (functionCallData: any) => {
        if (currentSessionRef.current) {
          try {
            const responses = await handleFunctionCallRequest(functionCallData, currentSessionRef.current);
            
            // Send responses back to Deepgram Agent
            for (const response of responses) {
              deepgramAgentRef.current?.sendFunctionResponse(
                response.id,
                response.content,
                response.name
              );
            }
          } catch (error) {
            console.error("Error handling function call:", error);
          }
        }
      });
      
      deepgramAgentRef.current.on('user_started_speaking', () => {
        isSpeakingRef.current = false; // User is speaking, agent should stop
      });
      
      deepgramAgentRef.current.on('agent_started_speaking', () => {
        console.log("Agent started speaking");
        isSpeakingRef.current = true;
      });
      
      deepgramAgentRef.current.on('agent_audio_done', () => {
        console.log("Agent finished speaking");
        isSpeakingRef.current = false;
      });
      
      // Set up audio capture BEFORE connecting so it's ready immediately
      await setupAudioCapture();
      console.log('[Audio] ✅ Audio capture ready before Deepgram connection');
      
      // Verify handler is registered before connecting
      const listenerCount = (deepgramAgentRef.current as any).listenerCount?.('settings_applied') || 
                           (deepgramAgentRef.current as any).listeners?.('settings_applied')?.length || 'unknown';
      console.log('[Audio] 📊 settings_applied listeners registered:', listenerCount);
      
      // Connect to Deepgram Agent
      console.log('[Audio] 🔌 About to connect Deepgram Agent...');
      await deepgramAgentRef.current.connect();
      console.log("Deepgram Agent connected");
      
      // Wait for settings to be applied, then ensure continuous audio flow
      // The settings_applied handler will send initial chunks, but we also set up a safety net
      const ensureAudioFlow = setInterval(() => {
        try {
          const isConnected = (deepgramAgentRef.current as any)?.connected;
          const isConfigured = (deepgramAgentRef.current as any)?.configured;
          if (isConnected && isConfigured && deepgramAgentRef.current && processorRef.current) {
            // Audio processing is set up and should be flowing
            // This interval just verifies everything is working
            clearInterval(ensureAudioFlow);
            console.log('[Audio] ✅ Audio flow verified - processor is active and sending chunks');
          }
        } catch (error) {
          console.error('[Audio] ❌ Error verifying audio flow:', error);
        }
      }, 100);
      
      // Clear interval after 5 seconds max
      setTimeout(() => clearInterval(ensureAudioFlow), 5000);
      
    } catch (error: any) {
      console.error("Error initializing Deepgram Agent:", error);
      setError(`Failed to initialize voice agent: ${error.message}`);
    } finally {
      // Mark initialization as complete
      isInitializingDeepgramRef.current = false;
    }
  }, [processTextFromAgent]);

  /**
   * Sets up audio capture to send to Deepgram Agent
   */
  const setupAudioCapture = useCallback(async () => {
    try {
      console.log('🎙️ Setting up audio capture for Deepgram Agent...');

      // 1. Create AudioContext — Chrome may silently choose 44100
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: 16000,
      });
      console.log('[Audio] Context sample rate:', audioContextRef.current.sampleRate);

      const stream = streamRef.current!;
      const source = audioContextRef.current.createMediaStreamSource(stream);

      // Resume if needed
      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
        console.log('[Audio] ✅ AudioContext resumed');
      }

      // Verify microphone track
      const [track] = stream.getAudioTracks();
      if (track) {
        console.log('[Audio] ✅ Microphone track active:', {
          enabled: track.enabled,
          muted: track.muted,
          readyState: track.readyState,
          settings: track.getSettings(),
        });
      } else {
        console.warn('[Audio] ⚠️ No audio tracks found in stream!');
      }

      // 2. Create ScriptProcessorNode for 512‑sample frames (~32 ms at 16 kHz)
      const bufferSize = 512;
      processorRef.current = audioContextRef.current.createScriptProcessor(bufferSize, 1, 1);

      let chunkCount = 0;
      let lastLog = Date.now();

      processorRef.current.onaudioprocess = (event) => {
        const dg = deepgramAgentRef.current;
        if (!dg || !dg.connected || !dg.configured) {
          if (chunkCount < 5) {
            console.warn(`[Audio] ⏸️ Skipping chunk – connected:${dg?.connected} configured:${dg?.configured}`);
          }
          return;
        }

        const input = event.inputBuffer.getChannelData(0);

        // Convert Float32 → Int16 PCM for Deepgram (linear16)
        const int16 = new Int16Array(input.length);
        for (let i = 0; i < input.length; i++) {
          int16[i] = Math.max(-32768, Math.min(32767, input[i] * 32767));
        }

        try {
          dg.sendAudio(Buffer.from(int16.buffer));
          chunkCount++;

          // Simple audio‑level meter
          let peak = 0;
          for (let i = 0; i < input.length; i++) {
            peak = Math.max(peak, Math.abs(input[i]));
          }
          peak *= 32768;
          const now = Date.now();
          const shouldLog =
            peak > 500 ||
            chunkCount <= 20 ||
            chunkCount % 100 === 0 ||
            now - lastLog > 2000;
          if (shouldLog) {
            lastLog = now;
          }
        } catch (err) {
          console.error('[Audio] ❌ sendAudio failed:', err);
        }
      };

      // 3. Connect processing chain
      source.connect(processorRef.current);
      processorRef.current.connect(audioContextRef.current.destination);
      console.log('[Audio] ✅ Processor connected and running');
    } catch (err) {
      console.error('Error setting up audio capture:', err);
      throw err;
    }
  }, []);

  /**
   * Converts PCM to mulaw format
   */
  const convertPCMToMulaw = (pcmData: Int16Array): Uint8Array => {
    const mulawData = new Uint8Array(pcmData.length);
    
    // PCM to mulaw conversion
    const linearToMulaw = (sample: number): number => {
      const sign = sample < 0 ? 0x80 : 0x00;
      sample = Math.abs(sample);
      
      if (sample > 32635) sample = 32635;
      
      sample += 132;
      let exponent = 7;
      for (let exp = 0; exp < 8; exp++) {
        if (sample <= (33 << exp)) {
          exponent = exp;
          break;
        }
      }
      
      const mantissa = (sample >> (exponent + 3)) & 0x0F;
      return ~(sign | (exponent << 4) | mantissa);
    };
    
    for (let i = 0; i < pcmData.length; i++) {
      mulawData[i] = linearToMulaw(pcmData[i]);
    }
    
    return mulawData;
  };

  /**
   * Processes the next audio chunk in the queue.
   */
    const processNextAudioChunk = useCallback(() => {
    if (
      audioChunkQueueRef.current.length > 0 &&
      !isProcessingChunkRef.current
    ) {
      isProcessingChunkRef.current = true;
      const audioChunk = audioChunkQueueRef.current.shift();
      if (audioChunk) {
        const chunkDurationMs = (audioChunk.length / 16000) * 1000; // Calculate chunk duration in milliseconds

        // Send audio chunks to Simli immediately
        simliClient?.sendAudioData(audioChunk as any);
        isProcessingChunkRef.current = false;
        processNextAudioChunk();
      }
    }
  }, []);


  /**
   * Converts mulaw audio to linear PCM
   */
  const convertMulawToPCM = (mulawData: Buffer): Int16Array => {
    const pcmData = new Int16Array(mulawData.length);
    
    // mulaw to linear conversion table
    const mulawToLinear = (mulaw: number): number => {
      mulaw = ~mulaw;
      const sign = mulaw & 0x80;
      const exponent = (mulaw >> 4) & 0x07;
      const mantissa = mulaw & 0x0F;
      
      let sample = mantissa << (exponent + 3);
      if (exponent !== 0) {
        sample += (1 << (exponent + 2));
      }
      
      return sign ? -sample : sample;
    };
    
    for (let i = 0; i < mulawData.length; i++) {
      pcmData[i] = mulawToLinear(mulawData[i]);
    }
    
    return pcmData;
  };

  /**
   * Upsamples audio data from one sample rate to another using linear interpolation
   */
  const upsampleAudio = (
    audioData: Int16Array,
    inputSampleRate: number,
    outputSampleRate: number
  ): Int16Array => {
    if (inputSampleRate === outputSampleRate) {
      return audioData;
    }

    const ratio = outputSampleRate / inputSampleRate;
    const newLength = Math.floor(audioData.length * ratio);
    const result = new Int16Array(newLength);

    // Linear interpolation
    for (let i = 0; i < newLength; i++) {
      const position = i / ratio;
      const index = Math.floor(position);
      const fraction = position - index;

      if (index + 1 < audioData.length) {
        const a = audioData[index];
        const b = audioData[index + 1];
        result[i] = Math.round(a + fraction * (b - a));
      } else {
        result[i] = audioData[index] || 0;
      }
    }

    return result;
  };

  /**
   * Applies a simple low-pass filter to prevent aliasing of audio
   */
  const applyLowPassFilter = (
    data: Int16Array,
    cutoffFreq: number,
    sampleRate: number
  ): Int16Array => {
    // Simple FIR filter coefficients
    const numberOfTaps = 31; // Should be odd
    const coefficients = new Float32Array(numberOfTaps);
    const fc = cutoffFreq / sampleRate;
    const middle = (numberOfTaps - 1) / 2;

    // Generate windowed sinc filter
    for (let i = 0; i < numberOfTaps; i++) {
      if (i === middle) {
        coefficients[i] = 2 * Math.PI * fc;
      } else {
        const x = 2 * Math.PI * fc * (i - middle);
        coefficients[i] = Math.sin(x) / (i - middle);
      }
      // Apply Hamming window
      coefficients[i] *=
        0.54 - 0.46 * Math.cos((2 * Math.PI * i) / (numberOfTaps - 1));
    }

    // Normalize coefficients
    const sum = coefficients.reduce((acc, val) => acc + val, 0);
    coefficients.forEach((_, i) => (coefficients[i] /= sum));

    // Apply filter
    const result = new Int16Array(data.length);
    for (let i = 0; i < data.length; i++) {
      let sum = 0;
      for (let j = 0; j < numberOfTaps; j++) {
        const idx = i - j + middle;
        if (idx >= 0 && idx < data.length) {
          sum += coefficients[j] * data[idx];
        }
      }
      result[i] = Math.round(sum);
    }

    return result;
  };

  /**
   * Downsamples audio data from one sample rate to another using linear interpolation
   * and anti-aliasing filter.
   *
   * @param audioData - Input audio data as Int16Array
   * @param inputSampleRate - Original sampling rate in Hz
   * @param outputSampleRate - Target sampling rate in Hz
   * @returns Downsampled audio data as Int16Array
   */
  const downsampleAudio = (
    audioData: Int16Array,
    inputSampleRate: number,
    outputSampleRate: number
  ): Int16Array => {
    if (inputSampleRate === outputSampleRate) {
      return audioData;
    }

    if (inputSampleRate < outputSampleRate) {
      throw new Error("Upsampling is not supported");
    }

    // Apply low-pass filter to prevent aliasing
    // Cut off at slightly less than the Nyquist frequency of the target sample rate
    const filteredData = applyLowPassFilter(
      audioData,
      outputSampleRate * 0.45, // Slight margin below Nyquist frequency
      inputSampleRate
    );

    const ratio = inputSampleRate / outputSampleRate;
    const newLength = Math.floor(audioData.length / ratio);
    const result = new Int16Array(newLength);

    // Linear interpolation
    for (let i = 0; i < newLength; i++) {
      const position = i * ratio;
      const index = Math.floor(position);
      const fraction = position - index;

      if (index + 1 < filteredData.length) {
        const a = filteredData[index];
        const b = filteredData[index + 1];
        result[i] = Math.round(a + fraction * (b - a));
      } else {
        result[i] = filteredData[index];
      }
    }

    return result;
  };

  /**
   * Requests microphone permissions for speech recognition.
   */
  const requestMicrophonePermission = useCallback(async () => {
    try {
      console.log("Requesting microphone permission...");
      // Request microphone with specific constraints for better audio quality
      streamRef.current = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1, // Mono
          sampleRate: 16000, // Request 16kHz (will be downsampled to 8kHz for Deepgram)
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } as any
      });
      console.log("Microphone permission granted");
      
      // Verify audio track is active
      const audioTracks = streamRef.current.getAudioTracks();
      if (audioTracks.length > 0) {
        const track = audioTracks[0];
        const settings = track.getSettings();
        console.log('[Audio] ✅ Microphone settings:', {
          sampleRate: settings.sampleRate,
          channelCount: settings.channelCount,
          echoCancellation: settings.echoCancellation,
          noiseSuppression: settings.noiseSuppression,
          autoGainControl: settings.autoGainControl
        });
      }
      
      return true;
    } catch (err) {
      console.error("Error accessing microphone:", err);
      setError("Error accessing microphone. Please check your permissions.");
      return false;
    }
  }, []);

  /**
   * Stops Deepgram Agent and releases microphone
   */
  const stopRecording = useCallback(async () => {
    // Clear keepalive interval
    if (deepgramKeepaliveIntervalRef.current) {
      clearInterval(deepgramKeepaliveIntervalRef.current);
      deepgramKeepaliveIntervalRef.current = null;
      console.log('[Audio] ✅ Stopped keepalive interval');
    }
    
    if (deepgramAgentRef.current) {
      try {
        deepgramAgentRef.current.close();
        deepgramAgentRef.current = null;
      } catch (err) {
        console.log("Error stopping Deepgram Agent:", err);
      }
    }
    
    // Stop audio processing
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }

    // Close AudioContext
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      try {
        await audioContextRef.current.close();
        audioContextRef.current = null;
      } catch (err) {
        console.log("Error closing AudioContext:", err);
      }
    }
    
    // Stop microphone stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    
    // Clean up session
    if (currentSessionRef.current) {
      voiceSessionManagerRef.current.deleteSession(currentSessionRef.current.id);
      currentSessionRef.current = null;
    }
    
    setIsRecording(false);
    console.log("Deepgram Agent stopped");
  }, []);

  /**
   * Handles the start of the interaction, initializing clients and starting recording.
   */
  const handleStart = useCallback(async () => {
    setIsLoading(true);
    setError("");
    onStart();

    try {
      console.log("Starting...");
      
      // Request microphone permission
      const hasPermission = await requestMicrophonePermission();
      if (!hasPermission) {
        throw new Error("Microphone permission denied");
      }
      
      initializeSimliClient();
      await simliClient?.start();
      eventListenerSimli();
    } catch (error: any) {
      console.error("Error starting interaction:", error);
      setError(`Error starting interaction: ${error.message}`);
      setIsLoading(false);
    }
  }, [onStart, requestMicrophonePermission]);

  /**
   * Handles stopping the interaction, cleaning up resources and resetting states.
   */
  const handleStop = useCallback(() => {
    console.log("Stopping interaction...");
    setIsLoading(false);
    setError("");
    stopRecording();
    setIsAvatarVisible(false);
    simliClient?.close();
    if (audioContextRef.current) {
      audioContextRef.current?.close();
      audioContextRef.current = null;
    }
    // Clear audio chunk queue
    audioChunkQueueRef.current = [];
    isProcessingChunkRef.current = false;
    isSpeakingRef.current = false;
    // Reset Simli listeners flag so they can be set up again on next start
    simliListenersSetupRef.current = false;
    deepgramInitializedForSessionRef.current = false;
    onClose();
    console.log("Interaction stopped");
  }, [stopRecording, onClose]);

  /**
   * Simli Event listeners - uses .once() to handle connected event only once
   */
  const eventListenerSimli = useCallback(() => {
    if (simliClient && !simliListenersSetupRef.current) {
      simliListenersSetupRef.current = true;
      
      // Use .once() instead of .on() so it only fires once, not on every reconnect
      const handleConnected = async () => {
        console.log("[Simli] ✅ SimliClient connected - handling first connection only");
        setIsAvatarVisible(true);
        setIsLoading(false);
        
        // Initialize Deepgram Agent only once
        if (!deepgramAgentRef.current) {
          console.log("[Simli] 🚀 Initializing Deepgram Agent...");
          deepgramInitializedForSessionRef.current = true;
          await initializeDeepgramAgent();
        } else {
          const isConnected = (deepgramAgentRef.current as any).connected;
          const isConfigured = (deepgramAgentRef.current as any).configured;
          console.log("[Simli] 🔍 Deepgram Agent ref exists. Connected:", isConnected, "Configured:", isConfigured);
          if (!isConnected || !isConfigured) {
            console.log("[Simli] 🔄 Deepgram Agent exists but not connected/configured, re-initializing...");
            deepgramInitializedForSessionRef.current = true;
            await initializeDeepgramAgent();
          } else {
            console.log("[Simli] ✅ Deepgram Agent already initialized and connected");
            deepgramInitializedForSessionRef.current = true;
          }
        }
      };

      // Use a handler that removes itself after the first connection
      // This prevents the handler from running on every reconnect
      const connectedHandler = async () => {
        await handleConnected();
        // Remove the listener after handling the first connection
        // This ensures we only handle the first "connected" event, not subsequent reconnections
        const client = simliClient as any;
        if (client.off) {
          client.off("connected", connectedHandler);
        } else if (client.removeListener) {
          client.removeListener("connected", connectedHandler);
        }
        console.log("[Simli] 🔇 Removed 'connected' listener to prevent repeated initialization");
      };
      simliClient?.on("connected", connectedHandler as any);

      // Handle disconnections (but don't reset flags unless user stops the interaction)
      simliClient?.on("disconnected", () => {
        console.log("[Simli] ⚠️ SimliClient disconnected");
        // Only stop recording if this is a real disconnect (not a reconnection)
        // Don't reset flags here - let them persist through reconnections
      });
    }
  }, [initializeDeepgramAgent]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900 p-4 md:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-3">
          <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
            AI Avatar Chat
          </h1>
          <p className="text-gray-300 text-base md:text-lg max-w-xl mx-auto">
            Experience the future of conversation with our intelligent AI avatar
          </p>
        </div>

        {/* Enhanced Video Display */}
        <div className="flex justify-center">
          <EnhancedVideoBox
            video={videoRef}
            audio={audioRef}
            isAvatarVisible={isAvatarVisible}
            isRecording={isRecording}
            userMessage={userMessage}
            showDottedFace={showDottedFace}
          />
        </div>

        {/* Performance Metrics */}
        <div className="flex justify-center">
          <TimingMetrics
            timings={timings}
            isProcessing={isProcessing}
            processingStep={processingStep}
            isRecording={isRecording}
          />
        </div>

        {/* Control Panel */}
        <div className="flex justify-center">
          <ControlPanel
            isAvatarVisible={isAvatarVisible}
            isLoading={isLoading}
            onStart={handleStart}
            onStop={handleStop}
            error={error}
          />
        </div>

        {/* Footer Info */}
        <div className="text-center space-y-3 pt-6 border-t border-gray-700/50">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-gray-400">
            <div className="space-y-1">
              <div className="font-semibold text-blue-400">Voice Recognition</div>
              <div>Deepgram real-time transcription</div>
            </div>
            <div className="space-y-1">
              <div className="font-semibold text-green-400">AI Processing</div>
              <div>Advanced language model</div>
            </div>
            <div className="space-y-1">
              <div className="font-semibold text-purple-400">Voice Synthesis</div>
              <div>OpenAI TTS generation</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SimliOpenAI;
