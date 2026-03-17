import { Request, Response, NextFunction } from "express";

export const PERMISSIONS = {
  "planning.view": ["admin", "planner"],
  "planning.release": ["admin", "planner"],
  "purchasing.view": ["admin", "planner", "buyer"],
  "purchasing.create_po": ["admin", "planner", "buyer"],
  "bom.view": ["admin", "planner", "engineer"],
  "bom.edit": ["admin", "engineer"],
  "workorder.view": ["admin", "planner", "operator"],
  "workorder.create": ["admin", "planner"],
  "workorder.complete": ["admin", "planner", "operator"],
  "serviceorder.view": ["admin", "planner"],
  "serviceorder.create": ["admin", "planner"],
  "inventory.view": ["admin", "planner", "operator", "buyer"],
  "inventory.adjust": ["admin", "planner"],
  "quality.view": ["admin", "planner", "operator", "quality"],
  "quality.manage": ["admin", "quality"],
  "sales.view": ["admin", "sales"],
  "sales.convert": ["admin", "planner", "sales"],
  "admin.manage_permissions": ["admin"],
  "admin.view": ["admin"],
} as const;

export function getCurrentUser(req: Request) {
  return {
    id: "system-user",
    email: "admin@manufactureOS.com",
    firstName: "Admin",
    lastName: "User",
    roleId: "admin",
    roleName: "System Administrator",
    permissions: ["*"],
  };
}

export function hasPermission(userPermissions: string[], permission: string): boolean {
  if (userPermissions.includes("*")) return true;
  if (userPermissions.includes(permission)) return true;
  const [module] = permission.split(".");
  return userPermissions.includes(`${module}.*`);
}

export function requirePermission(permission: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = getCurrentUser(req);
    if (hasPermission(user.permissions, permission)) {
      return next();
    }
    res.status(403).json({ error: "forbidden", message: `Permission required: ${permission}` });
  };
}
