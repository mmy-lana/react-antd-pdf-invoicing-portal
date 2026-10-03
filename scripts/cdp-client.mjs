/*
 * Minimal Chrome DevTools Protocol client.
 *
 * puppeteer-core 25 cannot drive the installed Chrome 154: its frame model calls
 * CDP methods that this browser no longer exposes, and even Runtime.evaluate
 * fails before navigation. Talking to Chrome directly over the WebSocket
 * protocol keeps the verification honest and dependency-free.
 */
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

export class CdpClient {
  constructor(socket) {
    this.socket = socket;
    this.nextCommandId = 0;
    this.pendingCommands = new Map();
    this.eventHandlers = [];

    socket.addEventListener('message', (messageEvent) => {
      const payload = JSON.parse(messageEvent.data);

      if (payload.id !== undefined) {
        const pending = this.pendingCommands.get(payload.id);
        if (!pending) return;
        this.pendingCommands.delete(payload.id);
        if (payload.error) {
          pending.reject(new Error(`${pending.method}: ${payload.error.message ?? JSON.stringify(payload.error)}`));
        } else {
          pending.resolve(payload.result ?? {});
        }
        return;
      }

      for (const handler of this.eventHandlers) handler(payload);
    });
  }

  static async open(webSocketUrl) {
    const socket = new WebSocket(webSocketUrl);
    await new Promise((resolveOpen, rejectOpen) => {
      socket.addEventListener('open', resolveOpen, { once: true });
      socket.addEventListener('error', () => rejectOpen(new Error(`Cannot connect to ${webSocketUrl}`)), { once: true });
    });
    return new CdpClient(socket);
  }

  send(method, params = {}, sessionId) {
    const commandId = ++this.nextCommandId;
    const message = { id: commandId, method, params };
    if (sessionId) message.sessionId = sessionId;

    return new Promise((resolveCommand, rejectCommand) => {
      this.pendingCommands.set(commandId, { resolve: resolveCommand, reject: rejectCommand, method });
      this.socket.send(JSON.stringify(message));
      setTimeout(() => {
        if (this.pendingCommands.has(commandId)) {
          this.pendingCommands.delete(commandId);
          rejectCommand(new Error(`${method} timed out`));
        }
      }, 60_000);
    });
  }

  onEvent(handler) {
    this.eventHandlers.push(handler);
  }

  /** Resolves once an event matching `predicate` arrives. */
  waitForEvent(predicate, timeoutMs = 30_000) {
    return new Promise((resolveEvent, rejectEvent) => {
      const timer = setTimeout(() => {
        this.eventHandlers = this.eventHandlers.filter((handler) => handler !== listener);
        rejectEvent(new Error('Timed out waiting for a browser event'));
      }, timeoutMs);

      const listener = (payload) => {
        if (!predicate(payload)) return;
        clearTimeout(timer);
        this.eventHandlers = this.eventHandlers.filter((handler) => handler !== listener);
        resolveEvent(payload);
      };

      this.eventHandlers.push(listener);
    });
  }

  close() {
    try {
      this.socket.close();
    } catch {
      // The socket may already be gone when the browser has exited.
    }
  }
}

const readDevToolsEndpoint = async (profileDir) => {
  const portFile = path.join(profileDir, 'DevToolsActivePort');
  for (let attempt = 0; attempt < 120; attempt += 1) {
    try {
      const contents = await readFile(portFile, 'utf8');
      const [port, browserPath] = contents.split('\n');
      if (port && browserPath) return `ws://127.0.0.1:${port.trim()}${browserPath.trim()}`;
    } catch {
      // Chrome has not written the file yet.
    }
    await new Promise((wait) => setTimeout(wait, 250));
  }
  throw new Error('Chrome never published a DevTools endpoint');
};

/**
 * Launches a private headless Chrome. Each run gets its own throwaway
 * --user-data-dir, so no existing browser profile is read, written or closed.
 */
export const launchPrivateChrome = async (executablePath, extraArgs = []) => {
  const profileDir = await mkdtemp(path.join(tmpdir(), 'invoicing-chrome-'));

  const chromeProcess = spawn(
    executablePath,
    [
      '--headless=new',
      // The renderer crashes in a sandboxed headless process here; without these
      // the tab dies before first paint and every page read fails.
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-gpu',
      '--disable-dev-shm-usage',
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-extensions',
      '--disable-background-networking',
      '--remote-debugging-port=0',
      `--user-data-dir=${profileDir}`,
      ...extraArgs,
      'about:blank',
    ],
    { stdio: ['ignore', 'ignore', 'pipe'] }
  );

  const browserEndpoint = await readDevToolsEndpoint(profileDir);
  const client = await CdpClient.open(browserEndpoint);

  return {
    client,
    async shutdown() {
      try {
        await client.send('Browser.close');
      } catch {
        // Fall through to the forced cleanup below.
      }
      client.close();
      chromeProcess.kill('SIGTERM');
      await new Promise((settle) => setTimeout(settle, 800));
      // Chrome can still be flushing its profile; cleanup is best-effort.
      await rm(profileDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }).catch(() => undefined);
    },
  };
};

/** Opens a tab and returns a thin, session-scoped page handle. */
export const openTab = async (client) => {
  const { targetId } = await client.send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await client.send('Target.attachToTarget', { targetId, flatten: true });

  const page = {
    sessionId,
    targetId,
    send: (method, params) => client.send(method, params, sessionId),
    onEvent: (handler) => client.onEvent((payload) => {
      if (payload.sessionId === sessionId) handler(payload);
    }),
    waitForEvent: (predicate, timeoutMs) =>
      client.waitForEvent((payload) => payload.sessionId === sessionId && predicate(payload), timeoutMs),

    async navigate(url) {
      const loaded = page.waitForEvent((payload) => payload.method === 'Page.loadEventFired');
      await page.send('Page.navigate', { url });
      await loaded;
    },

    /** Evaluates an expression in the page and returns its value. */
    async evaluate(expression) {
      const result = await page.send('Runtime.evaluate', {
        expression,
        returnByValue: true,
        awaitPromise: true,
      });
      if (result.exceptionDetails) {
        const description =
          result.exceptionDetails.exception?.description ?? result.exceptionDetails.text ?? 'evaluation failed';
        throw new Error(description);
      }
      return result.result?.value;
    },

    async setViewport({ width, height, mobile = false, deviceScaleFactor = 1 }) {
      await page.send('Emulation.setDeviceMetricsOverride', {
        width,
        height,
        deviceScaleFactor,
        mobile,
        screenWidth: width,
        screenHeight: height,
      });
    },

    async screenshot() {
      const { data } = await page.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
      return Buffer.from(data, 'base64');
    },

    async clickSelector(selector) {
      const box = await page.evaluate(`(() => {
        const element = document.querySelector(${JSON.stringify(selector)});
        if (!element) return null;
        element.scrollIntoView({ block: 'center' });
        const rect = element.getBoundingClientRect();
        return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
      })()`);

      if (!box) throw new Error(`Cannot click missing element: ${selector}`);

      for (const eventType of ['mousePressed', 'mouseReleased']) {
        await page.send('Input.dispatchMouseEvent', {
          type: eventType,
          x: Math.round(box.x),
          y: Math.round(box.y),
          button: 'left',
          clickCount: 1,
        });
      }
    },

    async close() {
      await client.send('Target.closeTarget', { targetId });
    },
  };

  await page.send('Page.enable', {});
  await page.send('Runtime.enable', {});
  await page.send('Network.enable', {});
  return page;
};
