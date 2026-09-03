import { Router, type IRouter } from "express";
import healthRouter from "./health";
import workspaceRouter from "./workspace";
import terminalRouter from "./terminal";
import agentRouter from "./agent";
import githubRouter from "./github";
import previewRouter from "./preview";

const router: IRouter = Router();

router.use(healthRouter);
router.use(workspaceRouter);
router.use(terminalRouter);
router.use(agentRouter);
router.use(githubRouter);
router.use(previewRouter);

export default router;
