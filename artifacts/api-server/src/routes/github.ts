import { getAuth } from "@clerk/express";
import { Router, type IRouter } from "express";
import { ReplitConnectors, type ProxyOptions } from "@replit/connectors-sdk";
import fs from "node:fs/promises";
import path from "node:path";
import { projectRoot, readWorkspaceFiles, safeWorkspacePath } from "../lib/workspace";

const router: IRouter = Router();
const MAX_FILES = 100;
const MAX_FILE_SIZE = 1_000_000;
const connectors = new ReplitConnectors();

function validSlug(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9_.-]{1,100}$/.test(value);
}

async function githubRequest(endpoint: string, init?: ProxyOptions) {
  return connectors.proxy("github", endpoint, init);
}

function requireAuth(req: Parameters<typeof getAuth>[0], res: import("express").Response) {
  if (!getAuth(req).userId) {
    res.status(401).json({ message: "Authentication required" });
    return false;
  }
  return true;
}

router.get("/github/repos", async (req, res) => {
  if (!requireAuth(req, res)) return;
  try {
    const response = await githubRequest("/user/repos?sort=pushed&per_page=50");
    if (!response.ok) {
      res.status(response.status).json({ message: "Unable to list GitHub repositories" });
      return;
    }
    const repos = (await response.json()) as Array<{
      full_name: string;
      default_branch: string;
      private: boolean;
      html_url: string;
    }>;
    res.json(
      repos.map((repo) => ({
        fullName: repo.full_name,
        defaultBranch: repo.default_branch,
        private: repo.private,
        url: repo.html_url,
      })),
    );
  } catch (error) {
    res.status(502).json({ message: error instanceof Error ? error.message : "GitHub unavailable" });
  }
});

router.post("/github/import", async (req, res) => {
  if (!requireAuth(req, res)) return;
  const owner = req.body?.owner;
  const repository = req.body?.repository;
  const branch = req.body?.branch || "main";
  if (!validSlug(owner) || !validSlug(repository) || !validSlug(branch)) {
    res.status(400).json({ message: "Owner, repository, and branch are required" });
    return;
  }

  try {
    const treeResponse = await githubRequest(
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repository)}/git/trees/${encodeURIComponent(branch)}?recursive=1`,
    );
    if (!treeResponse.ok) {
      res.status(treeResponse.status).json({ message: "Unable to read the GitHub repository tree" });
      return;
    }
    const tree = (await treeResponse.json()) as {
      tree?: Array<{ path: string; type: string; size?: number }>;
    };
    const files = (tree.tree ?? [])
      .filter((entry) => entry.type === "blob" && (entry.size ?? 0) <= MAX_FILE_SIZE)
      .slice(0, MAX_FILES);

    for (const file of files) {
      const target = safeWorkspacePath(file.path);
      const response = await githubRequest(
        `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repository)}/contents/${file.path
          .split("/")
          .map(encodeURIComponent)
          .join("/")}?ref=${encodeURIComponent(branch)}`,
      );
      if (!response.ok) continue;
      const content = (await response.json()) as { content?: string; encoding?: string };
      if (!content.content || content.encoding !== "base64") continue;
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.writeFile(target, Buffer.from(content.content.replace(/\n/g, ""), "base64"));
    }

    res.json({ imported: files.length, root: path.basename(projectRoot()) });
  } catch (error) {
    res.status(502).json({ message: error instanceof Error ? error.message : "GitHub import failed" });
  }
});

router.post("/github/push", async (req, res) => {
  if (!requireAuth(req, res)) return;
  const owner = req.body?.owner;
  const repository = req.body?.repository;
  const branch = req.body?.branch || "main";
  const message = typeof req.body?.message === "string" ? req.body.message.trim() : "";
  if (!validSlug(owner) || !validSlug(repository) || !validSlug(branch) || !message) {
    res.status(400).json({ message: "Owner, repository, branch, and commit message are required" });
    return;
  }

  try {
    const files = readWorkspaceFiles().filter(
      (file) => file.type === "file" && (file.size ?? 0) <= MAX_FILE_SIZE,
    ).slice(0, MAX_FILES);
    let pushed = 0;
    for (const file of files) {
      const target = safeWorkspacePath(file.path);
      const content = (await fs.readFile(target)).toString("base64");
      const existing = await githubRequest(
        `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repository)}/contents/${file.path
          .split("/")
          .map(encodeURIComponent)
          .join("/")}?ref=${encodeURIComponent(branch)}`,
      );
      let sha: string | undefined;
      if (existing.ok) {
        sha = ((await existing.json()) as { sha?: string }).sha;
      }
      const response = await githubRequest(
        `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repository)}/contents/${file.path
          .split("/")
          .map(encodeURIComponent)
          .join("/")}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message, content, branch, ...(sha ? { sha } : {}) }),
        },
      );
      if (response.ok) pushed += 1;
    }
    res.json({ pushed, scanned: files.length });
  } catch (error) {
    res.status(502).json({ message: error instanceof Error ? error.message : "GitHub push failed" });
  }
});

export default router;