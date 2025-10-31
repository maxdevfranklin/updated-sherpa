import * as WebSocket from 'ws';

/**
 * Enhanced VoiceSession combining voice-only app's performance-focused design
 * with main app's business logic integration
 */
export interface VoiceSession {
  // ===== VOICE-ONLY CORE (PRIORITY) =====
  id: string;
  deepgramWs: WebSocket.WebSocket | null;

  // ===== Parameters =====
  firstName?: string;
  lastName?: string;
  locationInfo?: string;
  lovedOneName?: string;
  reasonForContact?: string;
  lovedOneConcern?: string;
  familyImpact?: string;
  currentAddress?: string;
  dailyRoutine?: string;
  hobbies?: string;
  isLovedOneAware?: string;
  lovedOneFeelings?: string;
  decisionMakers?: string;
  communityPriorities?: string;
  meetingTime?: string;
}

/**
 * VoiceSession class with voice-only app's direct, performance-focused approach
 */
export class VoiceSessionManager {
  private sessions: Map<string, VoiceSession> = new Map();

  createSession(sessionId: string): VoiceSession {
    const session: VoiceSession = {
        // Voice-only core initialization
        id: sessionId,
        deepgramWs: null,
        firstName: "",
        lastName: "",
        locationInfo: "",
        lovedOneName: "",
        reasonForContact: "",
        lovedOneConcern: "",
        familyImpact: "",
        currentAddress: "",
        dailyRoutine: "",
        hobbies: "",
        isLovedOneAware: "",
        lovedOneFeelings: "",
        decisionMakers: "",
        communityPriorities: "",
        meetingTime: "",
    };

    this.sessions.set(sessionId, session);

    console.log(`[VoiceSession] Created session ${sessionId}`);

    return session;
  }

  getSession(sessionId: string): VoiceSession | undefined {
    return this.sessions.get(sessionId);
  }

  updateSession(sessionId: string, updates: Partial<VoiceSession>): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      Object.assign(session, updates);
      console.log(`[VoiceSession] Updated session ${sessionId}`);
    }
  }

  deleteSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      if (session.deepgramWs && session.deepgramWs.readyState === 1) { // WebSocket.OPEN = 1
        session.deepgramWs.close();
      }

      this.sessions.delete(sessionId);
      console.log(`[VoiceSession] Deleted session ${sessionId}`);
    }
  }

  getAllSessions(): VoiceSession[] {
    return Array.from(this.sessions.values());
  }

  getSessionCount(): number {
    return this.sessions.size;
  }
}
