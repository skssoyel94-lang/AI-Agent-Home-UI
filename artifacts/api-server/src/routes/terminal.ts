import { getAuth } from "@clerk/express";
import { Router, type IRouter } from "express";
import { issueTerminalTicket } from "../lib/terminal";

const router: IRouter = Router();

router.get("/terminal/ticket", (req, res) => {
  if (!getAuth(req).userId) {
    res.status(401).json({ message: "Authentication required" });
    return;
  }
  res.json({ ticket: issueTerminalTicket() });
});

export default router;