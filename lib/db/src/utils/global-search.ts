import { ilike, or, sql, eq } from "drizzle-orm";

import { db } from "../client";
import {
  customFieldValuesTable,
  customFieldsTable,
  customFormsTable,
  customersTable,
  invoicesTable,
  itemsTable,
  leadsTable,
  opportunitiesTable,
  purchaseOrdersTable,
  salesOrdersTable,
  vendorsTable,
  workOrdersTable,
} from "../schema";

export type GlobalSearchEntity =
  | "page"
  | "form"
  | "custom-field"
  | "value"
  | "customer"
  | "vendor"
  | "item"
  | "salesorder"
  | "purchaseorder"
  | "workorder"
  | "invoice"
  | "lead"
  | "opportunity";

export type GlobalSearchResult = {
  type: string;
  entity: GlobalSearchEntity;
  id: string;
  title: string;
  subtitle?: string;
  href: string;
  status?: string;
  score: number;
  metadata?: Record<string, unknown>;
};

export type GlobalSearchOptions = {
  limit?: number;
  entityFilter?: GlobalSearchEntity;
};

function scoreText(text: string | null | undefined, term: string): number {
  const a = (text ?? "").toLowerCase();
  const b = term.toLowerCase();
  if (!a || !b) return 0;
  if (a === b) return 120;
  if (a.startsWith(b)) return 90;
  if (a.includes(b)) return 65;
  return 0;
}

function scoreComposite(term: string, ...values: Array<string | null | undefined>): number {
  return Math.max(...values.map((value) => scoreText(value, term)), 0);
}

function truncate(value: string, max = 120): string {
  return value.length > max ? `${value.slice(0, max - 3)}...` : value;
}

function entityHref(entityType: string, entityId: string): string {
  switch (entityType.toLowerCase()) {
    case "customer":
      return `/customers/${entityId}`;
    case "vendor":
      return `/vendors/${entityId}`;
    case "item":
      return `/items/${entityId}`;
    case "workorder":
    case "work_order":
      return `/workorders/${entityId}`;
    case "lead":
      return `/leads/${entityId}`;
    case "opportunity":
      return `/opportunities/${entityId}`;
    default:
      return `/admin?tab=custom-forms`;
  }
}

function includesTerm(value: string, term: string): boolean {
  return value.toLowerCase().includes(term.toLowerCase());
}

const STATIC_PAGE_RESULTS: Array<Omit<GlobalSearchResult, "score">> = [
  { type: "Page", entity: "page", id: "dashboard", title: "Dashboard", subtitle: "Command center overview", href: "/" },
  { type: "Page", entity: "page", id: "customers", title: "Customers", subtitle: "CRM customer master", href: "/customers" },
  { type: "Page", entity: "page", id: "vendors", title: "Vendors", subtitle: "Supplier master", href: "/vendors" },
  { type: "Page", entity: "page", id: "leads", title: "Leads", subtitle: "Lead management", href: "/leads" },
  { type: "Page", entity: "page", id: "opportunities", title: "Opportunities", subtitle: "CRM opportunity pipeline", href: "/opportunities" },
  { type: "Page", entity: "page", id: "items", title: "Item Master", subtitle: "Engineering item records", href: "/items" },
  { type: "Page", entity: "page", id: "workorders", title: "Work Orders", subtitle: "Production execution", href: "/workorders" },
  { type: "Page", entity: "page", id: "purchaseorders", title: "Purchase Orders", subtitle: "Procurement", href: "/purchaseorders" },
  { type: "Page", entity: "page", id: "salesorders", title: "Sales Orders", subtitle: "Order management", href: "/salesorders" },
  { type: "Page", entity: "page", id: "administration", title: "Administration", subtitle: "System administration", href: "/admin" },
  { type: "Page", entity: "page", id: "custom-forms", title: "Custom Forms", subtitle: "Admin custom forms tab", href: "/admin?tab=custom-forms" },
];

export async function globalSearch(
  term: string,
  options: GlobalSearchOptions = {},
): Promise<GlobalSearchResult[]> {
  const searchTerm = term.trim();
  if (searchTerm.length < 2) return [];

  const limit = Math.max(1, Math.min(options.limit ?? 12, 50));
  const perSourceLimit = Math.max(3, Math.min(limit, 10));
  const like = `%${searchTerm}%`;
  const only = options.entityFilter ?? null;

  const pageResults =
    !only || only === "page"
      ? STATIC_PAGE_RESULTS.filter(
          (entry) =>
            includesTerm(entry.title, searchTerm) ||
            includesTerm(entry.subtitle ?? "", searchTerm) ||
            includesTerm(entry.href, searchTerm),
        ).map((entry) => ({
          ...entry,
          score: scoreComposite(searchTerm, entry.title, entry.subtitle, entry.href),
        }))
      : [];

  const [
    customers,
    vendors,
    items,
    salesOrders,
    purchaseOrders,
    workOrders,
    invoices,
    leads,
    opportunities,
    forms,
    fields,
    values,
  ] = await Promise.all([
    !only || only === "customer"
      ? db
          .select({
            id: customersTable.id,
            number: customersTable.number,
            name: customersTable.name,
            status: customersTable.status,
          })
          .from(customersTable)
          .where(or(ilike(customersTable.name, like), ilike(customersTable.number, like), ilike(customersTable.email, like)))
          .limit(perSourceLimit)
      : Promise.resolve([]),
    !only || only === "vendor"
      ? db
          .select({
            id: vendorsTable.id,
            number: vendorsTable.number,
            name: vendorsTable.name,
            status: vendorsTable.status,
          })
          .from(vendorsTable)
          .where(or(ilike(vendorsTable.name, like), ilike(vendorsTable.number, like), ilike(vendorsTable.email, like)))
          .limit(perSourceLimit)
      : Promise.resolve([]),
    !only || only === "item"
      ? db
          .select({
            id: itemsTable.id,
            number: itemsTable.number,
            name: itemsTable.name,
            status: itemsTable.status,
            type: itemsTable.type,
          })
          .from(itemsTable)
          .where(or(ilike(itemsTable.name, like), ilike(itemsTable.number, like), ilike(itemsTable.description, like)))
          .limit(perSourceLimit)
      : Promise.resolve([]),
    !only || only === "salesorder"
      ? db
          .select({
            id: salesOrdersTable.id,
            number: salesOrdersTable.number,
            status: salesOrdersTable.status,
          })
          .from(salesOrdersTable)
          .where(ilike(salesOrdersTable.number, like))
          .limit(perSourceLimit)
      : Promise.resolve([]),
    !only || only === "purchaseorder"
      ? db
          .select({
            id: purchaseOrdersTable.id,
            number: purchaseOrdersTable.number,
            status: purchaseOrdersTable.status,
          })
          .from(purchaseOrdersTable)
          .where(ilike(purchaseOrdersTable.number, like))
          .limit(perSourceLimit)
      : Promise.resolve([]),
    !only || only === "workorder"
      ? db
          .select({
            id: workOrdersTable.id,
            number: workOrdersTable.number,
            status: workOrdersTable.status,
          })
          .from(workOrdersTable)
          .where(ilike(workOrdersTable.number, like))
          .limit(perSourceLimit)
      : Promise.resolve([]),
    !only || only === "invoice"
      ? db
          .select({
            id: invoicesTable.id,
            number: invoicesTable.number,
            status: invoicesTable.status,
          })
          .from(invoicesTable)
          .where(ilike(invoicesTable.number, like))
          .limit(perSourceLimit)
      : Promise.resolve([]),
    !only || only === "lead"
      ? db
          .select({
            id: leadsTable.id,
            number: leadsTable.number,
            companyName: leadsTable.companyName,
            status: leadsTable.status,
          })
          .from(leadsTable)
          .where(or(ilike(leadsTable.number, like), ilike(leadsTable.companyName, like), ilike(leadsTable.email, like)))
          .limit(perSourceLimit)
      : Promise.resolve([]),
    !only || only === "opportunity"
      ? db
          .select({
            id: opportunitiesTable.id,
            number: opportunitiesTable.number,
            name: opportunitiesTable.name,
            stage: opportunitiesTable.stage,
            status: opportunitiesTable.status,
          })
          .from(opportunitiesTable)
          .where(or(ilike(opportunitiesTable.number, like), ilike(opportunitiesTable.name, like)))
          .limit(perSourceLimit)
      : Promise.resolve([]),
    !only || only === "form"
      ? db
          .select({
            id: customFormsTable.id,
            name: customFormsTable.name,
            slug: customFormsTable.slug,
            isActive: customFormsTable.isActive,
          })
          .from(customFormsTable)
          .where(or(ilike(customFormsTable.name, like), ilike(customFormsTable.slug, like)))
          .limit(perSourceLimit)
      : Promise.resolve([]),
    !only || only === "custom-field"
      ? db
          .select({
            id: customFieldsTable.id,
            name: customFieldsTable.name,
            slug: customFieldsTable.slug,
            label: customFieldsTable.label,
            isActive: customFieldsTable.isActive,
          })
          .from(customFieldsTable)
          .where(or(ilike(customFieldsTable.name, like), ilike(customFieldsTable.slug, like), ilike(customFieldsTable.label, like)))
          .limit(perSourceLimit)
      : Promise.resolve([]),
    !only || only === "value"
      ? db
          .select({
            id: customFieldValuesTable.id,
            entityType: customFieldValuesTable.entityType,
            entityId: customFieldValuesTable.entityId,
            fieldId: customFieldValuesTable.fieldId,
            fieldName: customFieldsTable.name,
            valueText: sql<string>`${customFieldValuesTable.value}::text`,
          })
          .from(customFieldValuesTable)
          .leftJoin(customFieldsTable, eq(customFieldsTable.id, customFieldValuesTable.fieldId))
          .where(sql`${customFieldValuesTable.value}::text ILIKE ${like}`)
          .limit(Math.min(5, perSourceLimit))
      : Promise.resolve([]),
  ]);

  const combined: GlobalSearchResult[] = [
    ...pageResults,
    ...customers.map((row) => ({
      type: "Customer",
      entity: "customer" as const,
      id: row.id,
      title: row.name,
      subtitle: row.number,
      href: `/customers/${row.id}`,
      status: row.status,
      score: scoreComposite(searchTerm, row.name, row.number, row.status),
      metadata: { type: "Customer", number: row.number },
    })),
    ...vendors.map((row) => ({
      type: "Vendor",
      entity: "vendor" as const,
      id: row.id,
      title: row.name,
      subtitle: row.number,
      href: `/vendors/${row.id}`,
      status: row.status,
      score: scoreComposite(searchTerm, row.name, row.number, row.status),
      metadata: { type: "Vendor", number: row.number },
    })),
    ...items.map((row) => ({
      type: "Item",
      entity: "item" as const,
      id: row.id,
      title: row.name,
      subtitle: `${row.number} - ${row.type}`,
      href: `/items/${row.id}`,
      status: row.status,
      score: scoreComposite(searchTerm, row.name, row.number, row.type, row.status),
      metadata: { type: "Item", number: row.number },
    })),
    ...salesOrders.map((row) => ({
      type: "Sales Order",
      entity: "salesorder" as const,
      id: row.id,
      title: row.number,
      subtitle: row.status,
      href: "/salesorders",
      status: row.status,
      score: scoreComposite(searchTerm, row.number, row.status),
      metadata: { type: "Sales Order", number: row.number },
    })),
    ...purchaseOrders.map((row) => ({
      type: "Purchase Order",
      entity: "purchaseorder" as const,
      id: row.id,
      title: row.number,
      subtitle: row.status,
      href: "/purchaseorders",
      status: row.status,
      score: scoreComposite(searchTerm, row.number, row.status),
      metadata: { type: "Purchase Order", number: row.number },
    })),
    ...workOrders.map((row) => ({
      type: "Work Order",
      entity: "workorder" as const,
      id: row.id,
      title: row.number,
      subtitle: row.status,
      href: `/workorders/${row.id}`,
      status: row.status,
      score: scoreComposite(searchTerm, row.number, row.status),
      metadata: { type: "Work Order", number: row.number },
    })),
    ...invoices.map((row) => ({
      type: "Invoice",
      entity: "invoice" as const,
      id: row.id,
      title: row.number,
      subtitle: row.status,
      href: "/invoices",
      status: row.status,
      score: scoreComposite(searchTerm, row.number, row.status),
      metadata: { type: "Invoice", number: row.number },
    })),
    ...leads.map((row) => ({
      type: "Lead",
      entity: "lead" as const,
      id: row.id,
      title: row.companyName,
      subtitle: row.number,
      href: `/leads/${row.id}`,
      status: row.status,
      score: scoreComposite(searchTerm, row.companyName, row.number, row.status),
      metadata: { type: "Lead", number: row.number },
    })),
    ...opportunities.map((row) => ({
      type: "Opportunity",
      entity: "opportunity" as const,
      id: row.id,
      title: row.name,
      subtitle: `${row.number} - ${row.stage}`,
      href: `/opportunities/${row.id}`,
      status: row.status,
      score: scoreComposite(searchTerm, row.name, row.number, row.stage, row.status),
      metadata: { type: "Opportunity", number: row.number },
    })),
    ...forms.map((row) => ({
      type: "Form",
      entity: "form" as const,
      id: String(row.id),
      title: row.name,
      subtitle: row.slug,
      href: `/admin?tab=custom-forms#form-${row.id}`,
      status: row.isActive ? "active" : "inactive",
      score: scoreComposite(searchTerm, row.name, row.slug),
      metadata: { type: "Form", slug: row.slug },
    })),
    ...fields.map((row) => ({
      type: "Custom Field",
      entity: "custom-field" as const,
      id: String(row.id),
      title: row.label || row.name,
      subtitle: row.slug,
      href: `/admin?tab=custom-forms#field-${row.id}`,
      status: row.isActive ? "active" : "inactive",
      score: scoreComposite(searchTerm, row.label, row.name, row.slug),
      metadata: { type: "Custom Field", slug: row.slug },
    })),
    ...values.map((row) => ({
      type: "Value",
      entity: "value" as const,
      id: String(row.id),
      title: truncate(row.valueText || ""),
      subtitle: `${row.fieldName ?? `Field ${row.fieldId}`} - ${row.entityType}:${row.entityId}`,
      href: entityHref(row.entityType, row.entityId),
      score: scoreComposite(searchTerm, row.valueText, row.fieldName, row.entityType, row.entityId),
      metadata: {
        type: "Value",
        entityType: row.entityType,
        entityId: row.entityId,
        fieldId: row.fieldId,
      },
    })),
  ];

  return combined.sort((a, b) => b.score - a.score).slice(0, limit);
}
