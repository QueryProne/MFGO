import { Router } from "express";

import bomRouter from "./bom";
import docsRouter from "./docs";
import routingRouter from "./routing";
import schedulingRouter from "./scheduling";
import workCentersRouter from "./work-centers";
import { SUPPORTED_DISPATCH_RULES, SUPPORTED_EVENT_TYPES } from "./shared";

const router = Router();

router.get("/versions", async (_req, res) => {
  res.json({
    data: {
      apiVersion: "2.0.0",
      modules: {
        workCenters: "2.0",
        bom: "2.0",
        routing: "2.0",
        scheduling: "2.0",
        docs: "2.0",
      },
      dispatchRules: SUPPORTED_DISPATCH_RULES,
      eventTypes: SUPPORTED_EVENT_TYPES,
      generatedAt: new Date().toISOString(),
    },
  });
});

router.use(workCentersRouter);
router.use(bomRouter);
router.use(routingRouter);
router.use(schedulingRouter);
router.use("/docs", docsRouter);

export default router;