import { getAuth } from "@clerk/express";
import { Router, type IRouter } from "express";

const router: IRouter = Router();

router.get("/preview/info", (req, res) => {
  if (!getAuth(req).userId) {
    res.status(401).json({ message: "Authentication required" });
    return;
  }
  const configured = process.env.PREVIEW_URL;
  const domain = process.env.REPLIT_DEV_DOMAIN;
  const url = configured || (domain ? `https://${domain}` : null);
  res.json({ url, status: url ? "available" : "unavailable" });
});

export default router;