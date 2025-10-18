// browser-service/src/session-manager.ts
// Tracks browser session metadata, control ownership, and preview credentials
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { ensureVncServer } from './vnc-server';

export type SessionControlRole = 'ai' | 'user' | 'viewer';

export interface SessionPreviewDetails {
  websocketUrl: string;
  password: string;
  sessionToken: string;
  expiresAt: string;
}

interface SessionMetadata {
  sessionId: string;
  owner: SessionControlRole;
  controlLockedBy: SessionControlRole | null;
  lastActivity: number;
  createdAt: number;
  headful: boolean;
  recordingPath?: string;
  preview?: SessionPreviewDetails;
  persistentStoragePath: string;
}

interface SessionCreationOptions {
  headful?: boolean;
  owner?: SessionControlRole;
  persistent?: boolean;
}

interface ViewerTokenValidation {
  valid: boolean;
  role: SessionControlRole;
}

/**
 * Central place to persist metadata that augments Playwright browser sessions.
 */
class SessionManager {
  private readonly sessions = new Map<string, SessionMetadata>();

  constructor() {
    const baseDir = this.getSessionsDirectory();
    if (!fs.existsSync(baseDir)) {
      fs.mkdirSync(baseDir, { recursive: true });
    }
  }

  /**
   * Create a metadata entry (or update existing) whenever a session is opened.
   */
  touch(sessionId: string, options: SessionCreationOptions = {}): SessionMetadata {
    const now = Date.now();
    const existing = this.sessions.get(sessionId);

    if (existing) {
      existing.lastActivity = now;
      if (typeof options.headful === 'boolean') {
        existing.headful = options.headful;
      }
      if (options.owner) {
        existing.owner = options.owner;
      }
      return existing;
    }

    const persistentStoragePath = this.resolveStoragePath(sessionId);
    const headful = options.headful ?? false;

    const metadata: SessionMetadata = {
      sessionId,
      owner: options.owner ?? 'ai',
      controlLockedBy: null,
      lastActivity: now,
      createdAt: now,
      headful,
      persistentStoragePath,
    };

    if (headful) {
      const vnc = ensureVncServer();
      const password = process.env.VNC_PASSWORD || 'changeme';
      const sessionToken = crypto.randomUUID();
      metadata.preview = {
        websocketUrl: vnc.getWebsocketUrl(process.env.VNC_PUBLIC_HOST || 'localhost'),
        password,
        sessionToken,
        expiresAt: new Date(now + 60 * 60 * 1000).toISOString(),
      };
    }

    this.sessions.set(sessionId, metadata);
    return metadata;
  }

  /**
   * Attempt to lock control for a requester (AI or user).
   */
  requestControl(sessionId: string, requester: SessionControlRole): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return false;
    }

    if (session.controlLockedBy && session.controlLockedBy !== requester) {
      return false;
    }

    session.controlLockedBy = requester;
    session.owner = requester;
    session.lastActivity = Date.now();
    return true;
  }

  /**
   * Release the control lock if held by the requester.
   */
  releaseControl(sessionId: string, requester: SessionControlRole): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return;
    }

    if (session.controlLockedBy === requester) {
      session.controlLockedBy = null;
    }
    session.owner = 'ai';
    session.lastActivity = Date.now();
  }

  /**
   * Returns preview credentials for client consumption.
   */
  getPreviewDetails(sessionId: string): SessionPreviewDetails | null {
    const session = this.sessions.get(sessionId);
    if (!session || !session.preview) {
      return null;
    }

    if (new Date(session.preview.expiresAt).getTime() < Date.now()) {
      const refreshedToken = crypto.randomUUID();
      session.preview.sessionToken = refreshedToken;
      session.preview.expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    }

    return session.preview;
  }

  /**
   * Called when WebSocket connection closes; resets lock if the user disconnects.
   */
  handleSocketDisconnect(sessionId: string, role: SessionControlRole): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return;
    }

    if (session.controlLockedBy === role) {
      session.controlLockedBy = null;
      session.owner = 'ai';
    }
  }

  /**
   * Validate viewer token for WebSocket upgrade.
   */
  validateViewerToken(sessionId: string, token: string): ViewerTokenValidation {
    const session = this.sessions.get(sessionId);
    if (!session || !session.preview) {
      return { valid: false, role: 'viewer' };
    }

    const { preview } = session;
    if (preview.sessionToken !== token) {
      return { valid: false, role: 'viewer' };
    }

    if (new Date(preview.expiresAt).getTime() < Date.now()) {
      return { valid: false, role: 'viewer' };
    }

    return { valid: true, role: 'viewer' };
  }

  /**
   * Remove metadata when session closes.
   */
  remove(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return;
    }

    this.sessions.delete(sessionId);
    if (session.preview) {
      session.preview = undefined;
    }
  }

  /**
   * Return read-only session snapshot.
   */
  getSessionInfo(sessionId: string): SessionMetadata | undefined {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return undefined;
    }

    return { ...session };
  }

  /**
   * Register the path to a session recording artifact.
   */
  setRecordingPath(sessionId: string, recordingPath: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return;
    }
    session.recordingPath = recordingPath;
  }

  /**
   * List active session metadata objects.
   */
  listSessions(): SessionMetadata[] {
    return Array.from(this.sessions.values()).map((session) => ({ ...session }));
  }

  /**
   * Location on disk for persisted storage state.
   */
  resolveStoragePath(sessionId: string): string {
    const directory = this.getSessionsDirectory();
    return path.join(directory, `${sessionId}.json`);
  }

  private getSessionsDirectory(): string {
    return process.env.SESSION_STORAGE_DIR || path.join(os.tmpdir(), 'browser-service-sessions');
  }
}

let manager: SessionManager | null = null;

/**
 * Provide singleton session manager instance.
 */
export const getSessionManager = (): SessionManager => {
  if (!manager) {
    manager = new SessionManager();
  }
  return manager;
};

