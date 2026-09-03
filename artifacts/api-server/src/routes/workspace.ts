import { getAuth } from "@clerk/express";
import { Router, type IRouter } from "express";
import fs from "node:fs";
import path from "node:path";
import { ListWorkspaceFilesResponse } from "@workspace/api-zod";

const router: IRouter = Router();
const ignoredDirectories = new Set([
  ".cache",
  ".expo",
  ".git",
  "build",
  "coverage",
  "dist",
  "node_modules",
]);

function projectRoot(): string {
  return path.resolve(
    process.env.WORKSPACE_PROJECT_DIR ?? path.resolve(process.cwd(), "../ai-agent-home-mobile"),
  );
}

function readWorkspaceFiles(root: string) {
  const files: Array<{
    id: string;
    name: string;
    path: string;
    type: "file" | "directory";
    size?: number;
  }> = [];

  function visit(directory: string) {
    const entries = fs
      .readdirSync(directory, { withFileTypes: true })
      .sort((left, right) => {
        if (left.isDirectory() !== right.isDirectory()) {
          return left.isDirectory() ? -1 : 1;
        }
        return left.name.localeCompare(right.name);
      });

    for (const entry of entries) {
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory() && ignoredDirectories.has(entry.name)) continue;

      const absolutePath = path.join(directory, entry.name);
      const relativePath = path.relative(root, absolutePath).split(path.sep).join("/");
      const isDirectory = entry.isDirectory();

      if (isDirectory) {
        files.push({
          id: relativePath,
          name: entry.name,
          path: relativePath,
          type: "directory",
        });
        visit(absolutePath);
      } else if (entry.isFile()) {
        const stat = fs.statSync(absolutePath);
        files.push({
          id: relativePath,
          name: entry.name,
          path: relativePath,
          type: "file",
          size: stat.size,
        });
      }
    }
  }

  visit(root);
  return files;
}

router.get("/workspace/files", (req, res) => {
  if (!getAuth(req).userId) {
    res.status(401).json({ message: "Authentication required" });
    return;
  }

  try {
    const root = projectRoot();
    const data = ListWorkspaceFilesResponse.parse({
      root: path.basename(root),
      files: readWorkspaceFiles(root),
    });
    res.json(data);
  } catch (error) {
    res.status(500).json({
      message: error instanceof Error ? error.message : "Unable to read workspace files",
    });
  }
});

export default router;