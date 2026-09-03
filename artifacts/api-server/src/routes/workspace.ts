import { getAuth } from "@clerk/express";
import { Router, type IRouter } from "express";
import path from "node:path";
import { ListWorkspaceFilesResponse } from "@workspace/api-zod";
import { projectRoot, readWorkspaceFiles } from "../lib/workspace";

const router: IRouter = Router();

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