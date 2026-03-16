import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

const counters: Record<string, string> = {
  customers: "C",
  vendors: "V",
  quotes: "Q",
  salesorders: "SO",
  purchaseorders: "PO",
  workorders: "WO",
  shipments: "SHP",
  invoices: "INV",
  items: "ITM",
  boms: "BOM",
  inspections: "INS",
  nonconformances: "NCR",
  mrpruns: "MRP",
  warehouses: "WH",
};

export async function nextNumber(entity: string): Promise<string> {
  const prefix = counters[entity] ?? entity.toUpperCase().slice(0, 4);
  const result = await db.execute(
    sql`SELECT COUNT(*) as cnt FROM ${sql.raw(entity.toLowerCase().replace(/[^a-z]/g, "") + "s_table_does_not_exist")}`,
  ).catch(() => null);
  const ts = Date.now().toString().slice(-6);
  const rand = Math.floor(Math.random() * 1000).toString().padStart(3, "0");
  return `${prefix}-${ts}${rand}`;
}

// Simple sequential counter using a dedicated table approach
const inMemoryCounters: Record<string, number> = {};

export function getNextNumber(prefix: string): string {
  if (!inMemoryCounters[prefix]) {
    inMemoryCounters[prefix] = 1000;
  }
  inMemoryCounters[prefix]++;
  return `${prefix}-${inMemoryCounters[prefix]}`;
}
