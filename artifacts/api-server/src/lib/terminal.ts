import type { IncomingMessage, Server as HttpServer } from "node:http";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import crypto from "node:crypto";
import { WebSocketServer, WebSocket } from "ws";
import { projectRoot } from "./workspace";

type Ticket = { expiresAt: number };
const tickets = new Map<string, Ticket>();

export function issueTerminalTicket(): string {
  const ticket = crypto.randomBytes(24).toString("hex");
  tickets.set(ticket, { expiresAt: Date.now() + 60_000 });
  return ticket;
}

function consumeTerminalTicket(ticket: string): boolean {
  const value = tickets.get(ticket);
  tickets.delete(ticket);
  return Boolean(value && value.expiresAt > Date.now());
}

function closeProcess(child: ChildProcessWithoutNullStreams) {
  if (!child.killed) child.kill("SIGTERM");
  setTimeout(() => {
    if (!child.killed) child.kill("SIGKILL");
  }, 2_000).unref();
}

export function attachTerminalServer(server: HttpServer) {
  const terminalServer = new WebSocketServer({ noServer: true });

  terminalServer.on("connection", (socket) => {
    const shell = process.env.SHELL || "/bin/bash";
    const child = spawn(shell, ["-i"], {
      cwd: projectRoot(),
      env: {
        ...process.env,
        TERM: "xterm-256color",
        PS1: "\\u@workspace:\\w$ ",
      },
      stdio: "pipe",
    });

    const send = (data: string) => {
      if (socket.readyState === WebSocket.OPEN) socket.send(data);
    };

    child.stdout.on("data", (data) => send(data.toString()));
    child.stderr.on("data", (data) => send(data.toString()));
    child.on("error", (error) => send(`\r\nTerminal error: ${error.message}\r\n`));
    child.on("close", (code) => {
      send(`\r\n[process exited with code ${code ?? 0}]\r\n`);
      if (socket.readyState === WebSocket.OPEN) socket.close();
    });

    socket.on("message", (raw) => {
      try {
        const message = JSON.parse(raw.toString()) as {
          type?: string;
          data?: string;
          command?: string;
        };
        if (message.type === "input" && typeof message.data === "string") {
          child.stdin.write(message.data.slice(0, 16_384));
        }
        if (message.type === "command" && typeof message.command === "string") {
          child.stdin.write(`${message.command.slice(0, 4_000)}\n`);
        }
      } catch {
        send("\r\nInvalid terminal message\r\n");
      }
    });

    socket.on("close", () => closeProcess(child));
    socket.on("error", () => closeProcess(child));
  });

  server.on("upgrade", (request, socket, head) => {
    const url = new URL(request.url || "/", "http://localhost");
    if (url.pathname !== "/api/terminal") return;

    const ticket = url.searchParams.get("ticket") || "";
    if (!consumeTerminalTicket(ticket)) {
      socket.write("HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n");
      socket.destroy();
      return;
    }

    terminalServer.handleUpgrade(request, socket, head, (webSocket) => {
      terminalServer.emit("connection", webSocket, request);
    });
  });
}