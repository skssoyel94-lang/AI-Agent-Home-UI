import fs from "node:fs";
import path from "node:path";

export const ignoredDirectories = new Set([
  ".cache",
  ".expo",
  ".git",
  "build",
  "coverage",
  "dist",
  "node_modules",
]);

export function projectRoot(): string {
  return path.resolve(
    process.env.WORKSPACE_PROJECT_DIR ??
      path.resolve(process.cwd(), "../ai-agent-home-mobile"),
  );
}

export function safeWorkspacePath(relativePath: string): string {
  const root = projectRoot();
  const target = path.resolve(root, relativePath);
  if (target !== root && !target.startsWith(`${root}${path.sep}`)) {
    throw new Error("Path is outside the workspace");
  }
  return target;
}

export function readWorkspaceFiles(root = projectRoot()) {
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
      const relativePath = path
        .relative(root, absolutePath)
        .split(path.sep)
        .join("/");

      if (entry.isDirectory()) {
        files.push({
          id: relativePath,
          name: entry.name,
          path: relativePath,
          type: "directory",
        });
        visit(absolutePath);
      } else if (entry.isFile()) {
        files.push({
          id: relativePath,
          name: entry.name,
          path: relativePath,
          type: "file",
          size: fs.statSync(absolutePath).size,
        });
      }
    }
  }

  if (fs.existsSync(root)) visit(root);
  return files;
}