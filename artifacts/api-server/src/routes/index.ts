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
import mrpRouter from "./mrp";
import dashboardRouter from "./dashboard";
import searchRouter from "./search";
import smartTransferRouter from "./smarttransfer";

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
router.use(mrpRouter);
router.use(dashboardRouter);
router.use(searchRouter);
router.use(smartTransferRouter);

export default router;
