import { pgTable, text, timestamp, numeric, integer, boolean } from "drizzle-orm/pg-core";
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
  website: text("website"),
  currency: text("currency").default("USD"),
  paymentTerms: text("payment_terms"),
  creditLimit: numeric("credit_limit", { precision: 15, scale: 2 }),
  creditUsed: numeric("credit_used", { precision: 15, scale: 2 }).default("0"),
  taxId: text("tax_id"),
  salesRepId: text("sales_rep_id"),
  billingAddress: text("billing_address"),
  shippingAddress: text("shipping_address"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const customerAddressesTable = pgTable("customer_addresses", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  customerId: text("customer_id").notNull().references(() => customersTable.id, { onDelete: "cascade" }),
  addressType: text("address_type").notNull().default("ship_to"),
  name: text("name"),
  line1: text("line1").notNull(),
  line2: text("line2"),
  city: text("city").notNull(),
  state: text("state"),
  postalCode: text("postal_code"),
  country: text("country").default("US"),
  isDefault: boolean("is_default").default(false),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const customerContactsTable = pgTable("customer_contacts", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  customerId: text("customer_id").notNull().references(() => customersTable.id, { onDelete: "cascade" }),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  title: text("title"),
  department: text("department"),
  email: text("email"),
  phone: text("phone"),
  mobile: text("mobile"),
  isPrimary: boolean("is_primary").default(false),
  isSalesContact: boolean("is_sales_contact").default(false),
  isAccountingContact: boolean("is_accounting_contact").default(false),
  isServiceContact: boolean("is_service_contact").default(false),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const vendorsTable = pgTable("vendors", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  number: text("number").notNull().unique(),
  name: text("name").notNull(),
  status: text("status").notNull().default("active"),
  vendorType: text("vendor_type").default("supplier"),
  email: text("email"),
  phone: text("phone"),
  website: text("website"),
  currency: text("currency").default("USD"),
  paymentTerms: text("payment_terms"),
  taxId: text("tax_id"),
  leadTime: integer("lead_time"),
  defaultBuyerId: text("default_buyer_id"),
  isApproved: boolean("is_approved").default(true),
  isPreferred: boolean("is_preferred").default(false),
  billingAddress: text("billing_address"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const vendorAddressesTable = pgTable("vendor_addresses", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  vendorId: text("vendor_id").notNull().references(() => vendorsTable.id, { onDelete: "cascade" }),
  addressType: text("address_type").notNull().default("remit_to"),
  name: text("name"),
  line1: text("line1").notNull(),
  line2: text("line2"),
  city: text("city").notNull(),
  state: text("state"),
  postalCode: text("postal_code"),
  country: text("country").default("US"),
  isDefault: boolean("is_default").default(false),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const vendorContactsTable = pgTable("vendor_contacts", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  vendorId: text("vendor_id").notNull().references(() => vendorsTable.id, { onDelete: "cascade" }),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  title: text("title"),
  department: text("department"),
  email: text("email"),
  phone: text("phone"),
  mobile: text("mobile"),
  isPrimary: boolean("is_primary").default(false),
  isPurchasingContact: boolean("is_purchasing_contact").default(false),
  isQualityContact: boolean("is_quality_contact").default(false),
  isAccountingContact: boolean("is_accounting_contact").default(false),
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
export type CustomerAddress = typeof customerAddressesTable.$inferSelect;
export type CustomerContact = typeof customerContactsTable.$inferSelect;
export type Vendor = typeof vendorsTable.$inferSelect;
export type InsertVendor = z.infer<typeof insertVendorSchema>;
export type VendorAddress = typeof vendorAddressesTable.$inferSelect;
export type VendorContact = typeof vendorContactsTable.$inferSelect;
export type Contact = typeof contactsTable.$inferSelect;
export type InsertContact = z.infer<typeof insertContactSchema>;
