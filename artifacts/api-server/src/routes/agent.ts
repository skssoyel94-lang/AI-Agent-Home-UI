import { getAuth } from "@clerk/express";
import { Router, type IRouter } from "express";

const router: IRouter = Router();
const allowedModels = new Set([
  "llama-3.3-70b-versatile",
  "llama-3.1-8b-instant",
  "mixtral-8x7b-32768",
]);

function writeEvent(res: import("express").Response, event: Record<string, unknown>) {
  res.write(`data: ${JSON.stringify(event)}\n\n`);
}

router.post("/agent/stream", async (req, res) => {
  if (!getAuth(req).userId) {
    res.status(401).json({ message: "Authentication required" });
    return;
  }

  const prompt = typeof req.body?.prompt === "string" ? req.body.prompt.trim() : "";
  const requestedModel =
    typeof req.body?.model === "string" ? req.body.model : "llama-3.3-70b-versatile";
  const model = allowedModels.has(requestedModel) ? requestedModel : "llama-3.3-70b-versatile";

  if (!prompt || prompt.length > 12_000) {
    res.status(400).json({ message: "Prompt must be between 1 and 12,000 characters" });
    return;
  }
  if (!process.env.GROQ_API_KEY) {
    res.status(503).json({ message: "GROQ_API_KEY is not configured" });
    return;
  }

  res.status(200);
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const controller = new AbortController();
  req.on("close", () => controller.abort());

  try {
    writeEvent(res, { type: "step", step: "Planning the request", status: "running" });
    const upstream = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        stream: true,
        messages: [
          {
            role: "system",
            content:
              "You are CodePilot, an autonomous software developer. Give concise, practical answers. Explain the plan, then provide implementation-ready code or commands. Never claim a tool ran unless the user explicitly ran it.",
          },
          { role: "user", content: prompt },
        ],
      }),
      signal: controller.signal,
    });

    if (!upstream.ok || !upstream.body) {
      const detail = await upstream.text();
      writeEvent(res, { type: "error", message: detail || "Groq request failed" });
      res.end();
      return;
    }

    writeEvent(res, { type: "step", step: "Generating with Groq", status: "running" });
    const reader = upstream.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const result = await reader.read();
      buffer += decoder.decode(result.value ?? new Uint8Array(), { stream: !result.done });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";
      for (const line of lines) {
        if (!line.startsWith("data:")) continue;
        const payload = line.slice(5).trim();
        if (payload === "[DONE]") continue;
        try {
          const json = JSON.parse(payload) as {
            choices?: Array<{ delta?: { content?: string } }>;
          };
          const text = json.choices?.[0]?.delta?.content;
          if (text) writeEvent(res, { type: "delta", text });
        } catch {
          // Ignore incomplete provider frames; the next frame will complete them.
        }
      }
      if (result.done) break;
    }

    writeEvent(res, { type: "step", step: "Response ready", status: "done" });
    writeEvent(res, { type: "done" });
  } catch (error) {
    if (!controller.signal.aborted) {
      writeEvent(res, {
        type: "error",
        message: error instanceof Error ? error.message : "Unable to reach Groq",
      });
    }
  } finally {
    res.end();
  }
});

export default router;