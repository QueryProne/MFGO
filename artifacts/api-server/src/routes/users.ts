import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable, rolesTable } from "@workspace/db";
import { eq, ilike, or, sql } from "drizzle-orm";

const router = Router();

router.get("/users", async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 25;
    const search = req.query.search as string;
    const offset = (page - 1) * limit;

    let where: any = undefined;
    if (search) {
      where = or(
        ilike(usersTable.email, `%${search}%`),
        ilike(usersTable.firstName, `%${search}%`),
        ilike(usersTable.lastName, `%${search}%`),
      );
    }

    const [data, countResult] = await Promise.all([
      db.select({
        id: usersTable.id,
        email: usersTable.email,
        firstName: usersTable.firstName,
        lastName: usersTable.lastName,
        status: usersTable.status,
        roleId: usersTable.roleId,
        department: usersTable.department,
        createdAt: usersTable.createdAt,
        lastLoginAt: usersTable.lastLoginAt,
      }).from(usersTable).where(where).limit(limit).offset(offset),
      db.select({ count: sql<number>`count(*)` }).from(usersTable).where(where),
    ]);

    const total = Number(countResult[0]?.count ?? 0);
    res.json({ data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (e) {
    res.status(500).json({ error: "error", message: String(e) });
  }
});

router.post("/users", async (req, res) => {
  try {
    const { email, firstName, lastName, roleId, department } = req.body;
    const user = await db.insert(usersTable).values({ email, firstName, lastName, roleId, department }).returning();
    res.status(201).json(user[0]);
  } catch (e) {
    res.status(500).json({ error: "error", message: String(e) });
  }
});

router.get("/users/:id", async (req, res) => {
  try {
    const user = await db.select().from(usersTable).where(eq(usersTable.id, req.params.id)).limit(1);
    if (!user[0]) return res.status(404).json({ error: "not_found", message: "User not found" });
    res.json(user[0]);
  } catch (e) {
    res.status(500).json({ error: "error", message: String(e) });
  }
});

router.put("/users/:id", async (req, res) => {
  try {
    const { firstName, lastName, roleId, department, status } = req.body;
    const updated = await db.update(usersTable)
      .set({ firstName, lastName, roleId, department, status, updatedAt: new Date() })
      .where(eq(usersTable.id, req.params.id))
      .returning();
    if (!updated[0]) return res.status(404).json({ error: "not_found", message: "User not found" });
    res.json(updated[0]);
  } catch (e) {
    res.status(500).json({ error: "error", message: String(e) });
  }
});

router.delete("/users/:id", async (req, res) => {
  try {
    await db.update(usersTable).set({ status: "inactive" }).where(eq(usersTable.id, req.params.id));
    res.json({ message: "User deactivated" });
  } catch (e) {
    res.status(500).json({ error: "error", message: String(e) });
  }
});

// ROLES
router.get("/roles", async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 25;
    const offset = (page - 1) * limit;
    const [data, countResult] = await Promise.all([
      db.select().from(rolesTable).limit(limit).offset(offset),
      db.select({ count: sql<number>`count(*)` }).from(rolesTable),
    ]);
    const total = Number(countResult[0]?.count ?? 0);
    res.json({ data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (e) {
    res.status(500).json({ error: "error", message: String(e) });
  }
});

router.post("/roles", async (req, res) => {
  try {
    const { name, description, permissions } = req.body;
    const role = await db.insert(rolesTable).values({ name, description, permissions: permissions ?? [] }).returning();
    res.status(201).json(role[0]);
  } catch (e) {
    res.status(500).json({ error: "error", message: String(e) });
  }
});

router.get("/roles/:id", async (req, res) => {
  try {
    const role = await db.select().from(rolesTable).where(eq(rolesTable.id, req.params.id)).limit(1);
    if (!role[0]) return res.status(404).json({ error: "not_found", message: "Role not found" });
    res.json(role[0]);
  } catch (e) {
    res.status(500).json({ error: "error", message: String(e) });
  }
});

router.put("/roles/:id", async (req, res) => {
  try {
    const { name, description, permissions } = req.body;
    const updated = await db.update(rolesTable)
      .set({ name, description, permissions, updatedAt: new Date() })
      .where(eq(rolesTable.id, req.params.id))
      .returning();
    res.json(updated[0]);
  } catch (e) {
    res.status(500).json({ error: "error", message: String(e) });
  }
});

export default router;
