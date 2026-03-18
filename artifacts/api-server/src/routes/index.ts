import { Router, type IRouter } from "express";
import healthRouter from "./health";
import usersRouter from "./users";
import auditRouter from "./audit";
import crmRouter from "./crm";
import itemsRouter from "./items";
import inventoryRouter from "./inventory";
import salesRouter from "./sales";
import purchasingRouter from "./purchasing";
import productionRouter from "./production";
import shippingRouter from "./shipping";
import qualityRouter from "./quality";
import planningPurchasingRouter from "./planning-purchasing";
import dashboardRouter from "./dashboard";
import searchRouter from "./search";
import smartTransferRouter from "./smarttransfer";
import receivingRouter from "./receiving";
import manufacturingV2Router from "./manufacturing-v2";
import communicationsRouter from "./communications";
import tasksRouter from "./tasks";
import emailsRouter from "./emails";
import chatRouter from "./chat";
import crmExtensionsRouter from "./crm-extensions";

const router: IRouter = Router();

// Auth - simple session-based current user
router.get("/auth/me", (req, res) => {
  res.json({
    id: "system-user",
    email: "admin@manufactureOS.com",
    firstName: "Admin",
    lastName: "User",
    displayName: "Admin User",
    status: "active",
    roleId: "admin",
    roleName: "System Administrator",
    department: "IT",
    permissions: ["*"],
    createdAt: new Date().toISOString(),
  });
});

router.use(healthRouter);
router.use(usersRouter);
router.use(auditRouter);
router.use(crmRouter);
router.use(itemsRouter);
router.use(inventoryRouter);
router.use(salesRouter);
router.use(purchasingRouter);
router.use(productionRouter);
router.use(shippingRouter);
router.use(qualityRouter);
router.use(planningPurchasingRouter);
router.use(dashboardRouter);
router.use(searchRouter);
router.use(smartTransferRouter);
router.use(receivingRouter);
router.use("/v2/manufacturing", manufacturingV2Router);
router.use(communicationsRouter);
router.use(tasksRouter);
router.use(emailsRouter);
router.use(chatRouter);
router.use(crmExtensionsRouter);

export default router;
