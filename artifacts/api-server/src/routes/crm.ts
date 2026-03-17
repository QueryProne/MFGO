import { Router } from "express";
import { db } from "@workspace/db";
import {
  customersTable, vendorsTable, contactsTable,
  customerAddressesTable, customerContactsTable,
  vendorAddressesTable, vendorContactsTable,
  salesOrdersTable, purchaseOrdersTable,
} from "@workspace/db";
import { eq, ilike, or, sql, desc } from "drizzle-orm";
import { getNextNumber } from "../lib/counter";

const router = Router();

// ─── CUSTOMERS ───────────────────────────────────────────────────────────────
router.get("/customers", async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 25;
    const search = req.query.search as string;
    const offset = (page - 1) * limit;
    const where = search ? or(ilike(customersTable.name, `%${search}%`), ilike(customersTable.email, `%${search}%`)) : undefined;
    const [data, countResult] = await Promise.all([
      db.select().from(customersTable).where(where).limit(limit).offset(offset).orderBy(sql`${customersTable.createdAt} desc`),
      db.select({ count: sql<number>`count(*)` }).from(customersTable).where(where),
    ]);
    const total = Number(countResult[0]?.count ?? 0);
    res.json({ data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (e) {
    res.status(500).json({ error: "error", message: String(e) });
  }
});

router.post("/customers", async (req, res) => {
  try {
    const number = getNextNumber("C");
    const customer = await db.insert(customersTable).values({ ...req.body, number }).returning();
    res.status(201).json(customer[0]);
  } catch (e) {
    res.status(500).json({ error: "error", message: String(e) });
  }
});

router.get("/customers/:id", async (req, res) => {
  try {
    const customer = await db.select().from(customersTable).where(eq(customersTable.id, req.params.id)).limit(1);
    if (!customer[0]) return res.status(404).json({ error: "not_found", message: "Customer not found" });

    const [addresses, contacts, recentOrders] = await Promise.all([
      db.select().from(customerAddressesTable).where(eq(customerAddressesTable.customerId, req.params.id)).orderBy(desc(customerAddressesTable.isDefault)),
      db.select().from(customerContactsTable).where(eq(customerContactsTable.customerId, req.params.id)).orderBy(desc(customerContactsTable.isPrimary)),
      db.select().from(salesOrdersTable).where(eq(salesOrdersTable.customerId, req.params.id)).orderBy(desc(salesOrdersTable.createdAt)).limit(10),
    ]);

    res.json({ ...customer[0], addresses, contacts, recentOrders });
  } catch (e) {
    res.status(500).json({ error: "error", message: String(e) });
  }
});

router.put("/customers/:id", async (req, res) => {
  try {
    const updated = await db.update(customersTable).set({ ...req.body, updatedAt: new Date() }).where(eq(customersTable.id, req.params.id)).returning();
    res.json(updated[0]);
  } catch (e) {
    res.status(500).json({ error: "error", message: String(e) });
  }
});

// ─── CUSTOMER ADDRESSES ───────────────────────────────────────────────────────
router.get("/customers/:id/addresses", async (req, res) => {
  try {
    const data = await db.select().from(customerAddressesTable).where(eq(customerAddressesTable.customerId, req.params.id)).orderBy(desc(customerAddressesTable.isDefault));
    res.json({ data });
  } catch (e) {
    res.status(500).json({ error: "error", message: String(e) });
  }
});

router.post("/customers/:id/addresses", async (req, res) => {
  try {
    const [addr] = await db.insert(customerAddressesTable).values({ ...req.body, customerId: req.params.id }).returning();
    res.status(201).json(addr);
  } catch (e) {
    res.status(500).json({ error: "error", message: String(e) });
  }
});

router.put("/customers/:id/addresses/:addrId", async (req, res) => {
  try {
    const [updated] = await db.update(customerAddressesTable).set(req.body).where(eq(customerAddressesTable.id, req.params.addrId)).returning();
    res.json(updated);
  } catch (e) {
    res.status(500).json({ error: "error", message: String(e) });
  }
});

router.delete("/customers/:id/addresses/:addrId", async (req, res) => {
  try {
    await db.delete(customerAddressesTable).where(eq(customerAddressesTable.id, req.params.addrId));
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: "error", message: String(e) });
  }
});

// ─── CUSTOMER CONTACTS ────────────────────────────────────────────────────────
router.get("/customers/:id/contacts", async (req, res) => {
  try {
    const data = await db.select().from(customerContactsTable).where(eq(customerContactsTable.customerId, req.params.id)).orderBy(desc(customerContactsTable.isPrimary));
    res.json({ data });
  } catch (e) {
    res.status(500).json({ error: "error", message: String(e) });
  }
});

router.post("/customers/:id/contacts", async (req, res) => {
  try {
    const [contact] = await db.insert(customerContactsTable).values({ ...req.body, customerId: req.params.id }).returning();
    res.status(201).json(contact);
  } catch (e) {
    res.status(500).json({ error: "error", message: String(e) });
  }
});

router.put("/customers/:id/contacts/:contactId", async (req, res) => {
  try {
    const [updated] = await db.update(customerContactsTable).set({ ...req.body, updatedAt: new Date() }).where(eq(customerContactsTable.id, req.params.contactId)).returning();
    res.json(updated);
  } catch (e) {
    res.status(500).json({ error: "error", message: String(e) });
  }
});

router.delete("/customers/:id/contacts/:contactId", async (req, res) => {
  try {
    await db.delete(customerContactsTable).where(eq(customerContactsTable.id, req.params.contactId));
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: "error", message: String(e) });
  }
});

// ─── VENDORS ──────────────────────────────────────────────────────────────────
router.get("/vendors", async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 25;
    const search = req.query.search as string;
    const offset = (page - 1) * limit;
    const where = search ? or(ilike(vendorsTable.name, `%${search}%`), ilike(vendorsTable.email, `%${search}%`)) : undefined;
    const [data, countResult] = await Promise.all([
      db.select().from(vendorsTable).where(where).limit(limit).offset(offset).orderBy(sql`${vendorsTable.createdAt} desc`),
      db.select({ count: sql<number>`count(*)` }).from(vendorsTable).where(where),
    ]);
    const total = Number(countResult[0]?.count ?? 0);
    res.json({ data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (e) {
    res.status(500).json({ error: "error", message: String(e) });
  }
});

router.post("/vendors", async (req, res) => {
  try {
    const number = getNextNumber("V");
    const vendor = await db.insert(vendorsTable).values({ ...req.body, number }).returning();
    res.status(201).json(vendor[0]);
  } catch (e) {
    res.status(500).json({ error: "error", message: String(e) });
  }
});

router.get("/vendors/:id", async (req, res) => {
  try {
    const vendor = await db.select().from(vendorsTable).where(eq(vendorsTable.id, req.params.id)).limit(1);
    if (!vendor[0]) return res.status(404).json({ error: "not_found", message: "Vendor not found" });

    const [addresses, contacts, recentPOs] = await Promise.all([
      db.select().from(vendorAddressesTable).where(eq(vendorAddressesTable.vendorId, req.params.id)).orderBy(desc(vendorAddressesTable.isDefault)),
      db.select().from(vendorContactsTable).where(eq(vendorContactsTable.vendorId, req.params.id)).orderBy(desc(vendorContactsTable.isPrimary)),
      db.select().from(purchaseOrdersTable).where(eq(purchaseOrdersTable.vendorId, req.params.id)).orderBy(desc(purchaseOrdersTable.createdAt)).limit(10),
    ]);

    res.json({ ...vendor[0], addresses, contacts, recentPOs });
  } catch (e) {
    res.status(500).json({ error: "error", message: String(e) });
  }
});

router.put("/vendors/:id", async (req, res) => {
  try {
    const updated = await db.update(vendorsTable).set({ ...req.body, updatedAt: new Date() }).where(eq(vendorsTable.id, req.params.id)).returning();
    res.json(updated[0]);
  } catch (e) {
    res.status(500).json({ error: "error", message: String(e) });
  }
});

// ─── VENDOR ADDRESSES ─────────────────────────────────────────────────────────
router.get("/vendors/:id/addresses", async (req, res) => {
  try {
    const data = await db.select().from(vendorAddressesTable).where(eq(vendorAddressesTable.vendorId, req.params.id)).orderBy(desc(vendorAddressesTable.isDefault));
    res.json({ data });
  } catch (e) {
    res.status(500).json({ error: "error", message: String(e) });
  }
});

router.post("/vendors/:id/addresses", async (req, res) => {
  try {
    const [addr] = await db.insert(vendorAddressesTable).values({ ...req.body, vendorId: req.params.id }).returning();
    res.status(201).json(addr);
  } catch (e) {
    res.status(500).json({ error: "error", message: String(e) });
  }
});

router.put("/vendors/:id/addresses/:addrId", async (req, res) => {
  try {
    const [updated] = await db.update(vendorAddressesTable).set(req.body).where(eq(vendorAddressesTable.id, req.params.addrId)).returning();
    res.json(updated);
  } catch (e) {
    res.status(500).json({ error: "error", message: String(e) });
  }
});

router.delete("/vendors/:id/addresses/:addrId", async (req, res) => {
  try {
    await db.delete(vendorAddressesTable).where(eq(vendorAddressesTable.id, req.params.addrId));
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: "error", message: String(e) });
  }
});

// ─── VENDOR CONTACTS ──────────────────────────────────────────────────────────
router.get("/vendors/:id/contacts", async (req, res) => {
  try {
    const data = await db.select().from(vendorContactsTable).where(eq(vendorContactsTable.vendorId, req.params.id)).orderBy(desc(vendorContactsTable.isPrimary));
    res.json({ data });
  } catch (e) {
    res.status(500).json({ error: "error", message: String(e) });
  }
});

router.post("/vendors/:id/contacts", async (req, res) => {
  try {
    const [contact] = await db.insert(vendorContactsTable).values({ ...req.body, vendorId: req.params.id }).returning();
    res.status(201).json(contact);
  } catch (e) {
    res.status(500).json({ error: "error", message: String(e) });
  }
});

router.put("/vendors/:id/contacts/:contactId", async (req, res) => {
  try {
    const [updated] = await db.update(vendorContactsTable).set({ ...req.body, updatedAt: new Date() }).where(eq(vendorContactsTable.id, req.params.contactId)).returning();
    res.json(updated);
  } catch (e) {
    res.status(500).json({ error: "error", message: String(e) });
  }
});

router.delete("/vendors/:id/contacts/:contactId", async (req, res) => {
  try {
    await db.delete(vendorContactsTable).where(eq(vendorContactsTable.id, req.params.contactId));
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: "error", message: String(e) });
  }
});

// ─── CONTACTS (legacy) ────────────────────────────────────────────────────────
router.get("/contacts", async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 25;
    const offset = (page - 1) * limit;
    const customerId = req.query.customerId as string;
    const vendorId = req.query.vendorId as string;
    const where = customerId ? eq(contactsTable.customerId, customerId) : vendorId ? eq(contactsTable.vendorId, vendorId) : undefined;
    const [data, countResult] = await Promise.all([
      db.select().from(contactsTable).where(where).limit(limit).offset(offset),
      db.select({ count: sql<number>`count(*)` }).from(contactsTable).where(where),
    ]);
    const total = Number(countResult[0]?.count ?? 0);
    res.json({ data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (e) {
    res.status(500).json({ error: "error", message: String(e) });
  }
});

router.post("/contacts", async (req, res) => {
  try {
    const contact = await db.insert(contactsTable).values(req.body).returning();
    res.status(201).json(contact[0]);
  } catch (e) {
    res.status(500).json({ error: "error", message: String(e) });
  }
});

export default router;
