// browser-service/src/vnc-server.ts
// Bootstraps a virtual X11 display with x11vnc + websockify for real-time browser preview
import { spawn, spawnSync, ChildProcess } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

/**
 * Configuration parameters for the embedded VNC stack.
 */
export interface VncServerOptions {
  display?: string;
  width?: number;
  height?: number;
  depth?: number;
  vncPort?: number;
  webPort?: number;
  password?: string;
}

interface RunningProcesses {
  xvfb?: ChildProcess;
  windowManager?: ChildProcess;
  x11vnc?: ChildProcess;
  websockify?: ChildProcess;
}

/**
 * Responsible for ensuring a headful Playwright session can be viewed remotely through noVNC.
 */
class VncServer {
  private options: Required<VncServerOptions>;
  private processes: RunningProcesses = {};
  private authFilePath: string | null = null;
  private started = false;

  constructor(options: VncServerOptions = {}) {
    const defaultOptions: Required<VncServerOptions> = {
      display: ':99',
      width: 1920,
      height: 1080,
      depth: 24,
      vncPort: 5900,
      webPort: 6080,
      password: process.env.VNC_PASSWORD || 'changeme'
    };

    this.options = { ...defaultOptions, ...options };
  }

  /**
   * Start Xvfb, x11vnc and websockify if they are not already running.
   */
  start(): void {
    if (this.started) {
      return;
    }

    if (!process.env.ENABLE_BROWSER_PREVIEW || process.env.ENABLE_BROWSER_PREVIEW !== 'true') {
      console.log('VNC preview disabled (set ENABLE_BROWSER_PREVIEW=true to enable).');
      return;
    }

    this.ensureAuthFile();
    this.launchXvfb();
    this.launchWindowManager();
    this.launchX11Vnc();
    this.launchWebsockify();

    process.env.DISPLAY = this.options.display;
    this.started = true;
    console.log(`🎥 VNC server ready on ws://localhost:${this.options.webPort}`);

    process.on('exit', () => this.stop());
    process.on('SIGINT', () => this.stop());
    process.on('SIGTERM', () => this.stop());
  }

  /**
   * Stop all background processes gracefully.
   */
  stop(): void {
    const stopProcess = (proc?: ChildProcess, name?: string) => {
      if (!proc) return;
      try {
        proc.kill();
        console.log(`🛑 Stopped ${name}`);
      } catch (error) {
        console.error(`Failed to stop ${name}:`, error);
      }
    };

    stopProcess(this.processes.websockify, 'websockify');
    stopProcess(this.processes.x11vnc, 'x11vnc');
    stopProcess(this.processes.windowManager, 'fluxbox');
    stopProcess(this.processes.xvfb, 'Xvfb');
    this.started = false;

    if (this.authFilePath && fs.existsSync(this.authFilePath)) {
      fs.rmSync(this.authFilePath, { force: true });
      this.authFilePath = null;
    }
  }

  /**
   * Return the websocket URL that clients should use to connect.
   */
  getWebsocketUrl(host: string = 'localhost'): string {
    return `ws://${host}:${this.options.webPort}`;
  }

  private ensureAuthFile(): void {
    const password = this.options.password;
    if (!password || password.length < 6) {
      throw new Error('VNC password must be at least 6 characters.');
    }

    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'browser-service-vnc-'));
    const authPath = path.join(tempDir, 'x11vnc.pass');

    const result = spawnSync('x11vnc', ['-storepasswd', password, authPath]);
    if (result.status !== 0) {
      console.error('Failed to store VNC password:', result.stderr?.toString());
      throw new Error('Failed to write VNC password file');
    }

    fs.chmodSync(authPath, 0o600);
    this.authFilePath = authPath;
  }

  private launchXvfb(): void {
    if (this.processes.xvfb) {
      return;
    }

    const args = [
      this.options.display,
      '-screen',
      '0',
      `${this.options.width}x${this.options.height}x${this.options.depth}`,
      '-nolisten',
      'tcp'
    ];

    console.log(`Starting Xvfb ${args.join(' ')}`);
    this.processes.xvfb = spawn('Xvfb', args, { stdio: 'inherit' });
  }

  private launchWindowManager(): void {
    if (this.processes.windowManager) {
      return;
    }

    console.log('Starting fluxbox window manager');
    this.processes.windowManager = spawn('fluxbox', ['-display', this.options.display], {
      stdio: 'inherit'
    });
  }

  private launchX11Vnc(): void {
    if (this.processes.x11vnc || !this.authFilePath) {
      return;
    }

    const args = [
      '-display', this.options.display,
      '-rfbauth', this.authFilePath,
      '-rfbport', String(this.options.vncPort),
      '-forever',
      '-shared',
      '-localhost'
    ];

    console.log(`Starting x11vnc ${args.join(' ')}`);
    this.processes.x11vnc = spawn('x11vnc', args, { stdio: 'inherit' });
  }

  private launchWebsockify(): void {
    if (this.processes.websockify) {
      return;
    }

    const novncPathCandidates = [
      '/usr/share/novnc',
      '/usr/lib/novnc',
      '/usr/share/novnc/',
    ];

    const webRoot = novncPathCandidates.find((candidate) => fs.existsSync(candidate));
    if (!webRoot) {
      throw new Error('noVNC assets not found. Ensure novnc package is installed.');
    }

    const args = [
      String(this.options.webPort),
      'localhost:' + String(this.options.vncPort),
      '--web',
      webRoot,
      '--wrap-mode=ignore'
    ];

    console.log(`Starting websockify ${args.join(' ')}`);
    this.processes.websockify = spawn('websockify', args, { stdio: 'inherit' });
  }
}

let serverInstance: VncServer | null = null;

/**
 * Return the shared VNC server instance, starting it if necessary.
 */
export const ensureVncServer = (): VncServer => {
  if (!serverInstance) {
    serverInstance = new VncServer();
  }
  serverInstance.start();
  return serverInstance;
};

