import { pgTable, text, timestamp, numeric, integer, boolean, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const customersTable = pgTable("customers", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  number: text("number").notNull().unique(),
  name: text("name").notNull(),
  type: text("type").notNull().default("prospect"),
  status: text("status").notNull().default("active"),
  email: text("email"),
  phone: text("phone"),
  address: jsonb("address"),
  creditLimit: numeric("credit_limit", { precision: 15, scale: 2 }),
  paymentTerms: text("payment_terms"),
  taxId: text("tax_id"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const vendorsTable = pgTable("vendors", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  number: text("number").notNull().unique(),
  name: text("name").notNull(),
  status: text("status").notNull().default("active"),
  email: text("email"),
  phone: text("phone"),
  address: jsonb("address"),
  paymentTerms: text("payment_terms"),
  taxId: text("tax_id"),
  leadTime: integer("lead_time"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const contactsTable = pgTable("contacts", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: text("email"),
  phone: text("phone"),
  title: text("title"),
  customerId: text("customer_id").references(() => customersTable.id),
  vendorId: text("vendor_id").references(() => vendorsTable.id),
  isPrimary: boolean("is_primary").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertCustomerSchema = createInsertSchema(customersTable).omit({ id: true, number: true, createdAt: true, updatedAt: true });
export const insertVendorSchema = createInsertSchema(vendorsTable).omit({ id: true, number: true, createdAt: true, updatedAt: true });
export const insertContactSchema = createInsertSchema(contactsTable).omit({ id: true, createdAt: true, updatedAt: true });

export type Customer = typeof customersTable.$inferSelect;
export type InsertCustomer = z.infer<typeof insertCustomerSchema>;
export type Vendor = typeof vendorsTable.$inferSelect;
export type InsertVendor = z.infer<typeof insertVendorSchema>;
export type Contact = typeof contactsTable.$inferSelect;
export type InsertContact = z.infer<typeof insertContactSchema>;
