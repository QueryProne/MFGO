import { Router } from "express";
import {
  db,
  itemsTable,
  mfgOperationMaterialsTable,
  mfgRoutingOperationsTable,
  mfgRoutingsTable,
  mfgWorkCentersTable,
} from "@workspace/db";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";

import { auditLog } from "../../lib/audit";
import { parsePagination } from "../../modules/mfg-v2/http";
import { asString, toNumericString } from "./shared";

const router = Router();

type RoutingOperationPayload = {
  sequenceNumber: number;
  operationCode?: string;
  name: string;
  workCenterId: string;
  standardTimeMinutes: number | string;
  setupTimeMinutes?: number | string;
  laborRequirements?: Record<string, unknown> | null;
  toolRequirements?: Record<string, unknown> | null;
  predecessorSequence?: number | null;
  reworkLoopToSequence?: number | null;
  allowRework?: boolean;
  isReworkOperation?: boolean;
  notes?: string | null;
  materials?: Array<{
    componentItemId: string;
    bomComponentId?: string | null;
    quantity: number | string;
    uom?: string;
    consumptionType?: string;
    scrapFactor?: number | string;
    notes?: string | null;
  }>;
};

async function replaceRoutingOperations(routingId: string, operations: RoutingOperationPayload[]) {
  const existingOperations = await db
    .select({ id: mfgRoutingOperationsTable.id })
    .from(mfgRoutingOperationsTable)
    .where(eq(mfgRoutingOperationsTable.routingId, routingId));

  if (existingOperations.length > 0) {
    await db
      .delete(mfgOperationMaterialsTable)
      .where(inArray(mfgOperationMaterialsTable.routingOperationId, existingOperations.map((row) => row.id)));
  }

  await db.delete(mfgRoutingOperationsTable).where(eq(mfgRoutingOperationsTable.routingId, routingId));

  if (operations.length === 0) {
    return;
  }

  const insertedOperations = await db
    .insert(mfgRoutingOperationsTable)
    .values(
      operations.map((operation) => ({
        routingId,
        sequenceNumber: operation.sequenceNumber,
        operationCode: operation.operationCode ?? null,
        name: operation.name,
        workCenterId: operation.workCenterId,
        standardTimeMinutes: toNumericString(operation.standardTimeMinutes, "0"),
        setupTimeMinutes: toNumericString(operation.setupTimeMinutes, "0"),
        laborRequirements: operation.laborRequirements ?? null,
        toolRequirements: operation.toolRequirements ?? null,
        predecessorSequence: operation.predecessorSequence ?? null,
        reworkLoopToSequence: operation.reworkLoopToSequence ?? null,
        allowRework: operation.allowRework ?? false,
        isReworkOperation: operation.isReworkOperation ?? false,
        notes: operation.notes ?? null,
      })),
    )
    .returning({ id: mfgRoutingOperationsTable.id, sequenceNumber: mfgRoutingOperationsTable.sequenceNumber });

  const operationIdBySequence = new Map(insertedOperations.map((row) => [row.sequenceNumber, row.id]));

  const materialRows = operations.flatMap((operation) => {
    const operationId = operationIdBySequence.get(operation.sequenceNumber);
    if (!operationId || !operation.materials || operation.materials.length === 0) {
      return [];
    }

    return operation.materials.map((material) => ({
      routingOperationId: operationId,
      componentItemId: material.componentItemId,
      bomComponentId: material.bomComponentId ?? null,
      quantity: toNumericString(material.quantity, "0"),
      uom: material.uom ?? "EA",
      consumptionType: material.consumptionType ?? "per_unit",
      scrapFactor: toNumericString(material.scrapFactor, "0"),
      notes: material.notes ?? null,
    }));
  });

  if (materialRows.length > 0) {
    await db.insert(mfgOperationMaterialsTable).values(materialRows);
  }
}

async function getRoutingWithOperations(routingId: string) {
  const [routing] = await db
    .select({
      id: mfgRoutingsTable.id,
      itemId: mfgRoutingsTable.itemId,
      itemNumber: itemsTable.number,
      itemName: itemsTable.name,
      routingType: mfgRoutingsTable.routingType,
      alternateCode: mfgRoutingsTable.alternateCode,
      version: mfgRoutingsTable.version,
      status: mfgRoutingsTable.status,
      isDefault: mfgRoutingsTable.isDefault,
      effectiveFrom: mfgRoutingsTable.effectiveFrom,
      effectiveTo: mfgRoutingsTable.effectiveTo,
      notes: mfgRoutingsTable.notes,
      createdAt: mfgRoutingsTable.createdAt,
      updatedAt: mfgRoutingsTable.updatedAt,
    })
    .from(mfgRoutingsTable)
    .leftJoin(itemsTable, eq(mfgRoutingsTable.itemId, itemsTable.id))
    .where(eq(mfgRoutingsTable.id, routingId))
    .limit(1);

  if (!routing) {
    return null;
  }

  const operations = await db
    .select({
      id: mfgRoutingOperationsTable.id,
      sequenceNumber: mfgRoutingOperationsTable.sequenceNumber,
      operationCode: mfgRoutingOperationsTable.operationCode,
      name: mfgRoutingOperationsTable.name,
      workCenterId: mfgRoutingOperationsTable.workCenterId,
      workCenterCode: mfgWorkCentersTable.code,
      workCenterName: mfgWorkCentersTable.name,
      standardTimeMinutes: mfgRoutingOperationsTable.standardTimeMinutes,
      setupTimeMinutes: mfgRoutingOperationsTable.setupTimeMinutes,
      laborRequirements: mfgRoutingOperationsTable.laborRequirements,
      toolRequirements: mfgRoutingOperationsTable.toolRequirements,
      predecessorSequence: mfgRoutingOperationsTable.predecessorSequence,
      reworkLoopToSequence: mfgRoutingOperationsTable.reworkLoopToSequence,
      allowRework: mfgRoutingOperationsTable.allowRework,
      isReworkOperation: mfgRoutingOperationsTable.isReworkOperation,
      notes: mfgRoutingOperationsTable.notes,
    })
    .from(mfgRoutingOperationsTable)
    .leftJoin(mfgWorkCentersTable, eq(mfgRoutingOperationsTable.workCenterId, mfgWorkCentersTable.id))
    .where(eq(mfgRoutingOperationsTable.routingId, routingId))
    .orderBy(asc(mfgRoutingOperationsTable.sequenceNumber));

  return { ...routing, operations };
}

router.get("/routings", async (req, res) => {
  try {
    const { page, limit, offset } = parsePagination(req.query as Record<string, unknown>);
    const conditions = [];

    if (asString(req.query.itemId)) {
      conditions.push(eq(mfgRoutingsTable.itemId, String(req.query.itemId)));
    }
    if (asString(req.query.routingType)) {
      conditions.push(eq(mfgRoutingsTable.routingType, String(req.query.routingType)));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [data, countResult] = await Promise.all([
      db
        .select({
          id: mfgRoutingsTable.id,
          itemId: mfgRoutingsTable.itemId,
          itemNumber: itemsTable.number,
          itemName: itemsTable.name,
          routingType: mfgRoutingsTable.routingType,
          alternateCode: mfgRoutingsTable.alternateCode,
          version: mfgRoutingsTable.version,
          status: mfgRoutingsTable.status,
          updatedAt: mfgRoutingsTable.updatedAt,
        })
        .from(mfgRoutingsTable)
        .leftJoin(itemsTable, eq(mfgRoutingsTable.itemId, itemsTable.id))
        .where(whereClause)
        .orderBy(desc(mfgRoutingsTable.updatedAt))
        .limit(limit)
        .offset(offset),
      db.select({ count: sql<number>`count(*)` }).from(mfgRoutingsTable).where(whereClause),
    ]);

    const total = Number(countResult[0]?.count ?? 0);
    res.json({ data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (error) {
    res.status(500).json({ error: "error", message: String(error) });
  }
});

router.post("/routings", async (req, res) => {
  try {
    const body = req.body as {
      itemId: string;
      routingType?: string;
      alternateCode?: string;
      version?: string;
      status?: string;
      isDefault?: boolean;
      effectiveFrom?: string | null;
      effectiveTo?: string | null;
      notes?: string;
      operations?: RoutingOperationPayload[];
    };

    const [created] = await db
      .insert(mfgRoutingsTable)
      .values({
        itemId: body.itemId,
        routingType: body.routingType ?? "primary",
        alternateCode: body.alternateCode ?? "PRIMARY",
        version: body.version ?? "1.0",
        status: body.status ?? "draft",
        isDefault: body.isDefault ?? false,
        effectiveFrom: body.effectiveFrom ?? null,
        effectiveTo: body.effectiveTo ?? null,
        notes: body.notes ?? null,
        createdBy: req.header("x-user") ?? "system-user",
      })
      .returning({ id: mfgRoutingsTable.id });

    if (!created?.id) {
      throw new Error("Failed to create routing");
    }

    await replaceRoutingOperations(created.id, body.operations ?? []);
    const result = await getRoutingWithOperations(created.id);

    await auditLog({ entity: "mfg_routing", entityId: created.id, action: "create", fieldChanges: body as Record<string, unknown> }, req);

    res.status(201).json(result);
  } catch (error) {
    res.status(500).json({ error: "error", message: String(error) });
  }
});

router.get("/routings/:id", async (req, res) => {
  try {
    const result = await getRoutingWithOperations(req.params.id);
    if (!result) {
      res.status(404).json({ error: "not_found", message: "Routing not found" });
      return;
    }
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "error", message: String(error) });
  }
});

router.put("/routings/:id", async (req, res) => {
  try {
    const body = req.body as {
      routingType?: string;
      alternateCode?: string;
      version?: string;
      status?: string;
      isDefault?: boolean;
      effectiveFrom?: string | null;
      effectiveTo?: string | null;
      notes?: string;
      operations?: RoutingOperationPayload[];
    };

    await db
      .update(mfgRoutingsTable)
      .set({
        routingType: body.routingType,
        alternateCode: body.alternateCode,
        version: body.version,
        status: body.status,
        isDefault: body.isDefault,
        effectiveFrom: body.effectiveFrom,
        effectiveTo: body.effectiveTo,
        notes: body.notes,
        updatedAt: new Date(),
      })
      .where(eq(mfgRoutingsTable.id, req.params.id));

    if (body.operations) {
      await replaceRoutingOperations(req.params.id, body.operations);
    }

    const result = await getRoutingWithOperations(req.params.id);
    if (!result) {
      res.status(404).json({ error: "not_found", message: "Routing not found" });
      return;
    }

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "error", message: String(error) });
  }
});

export default router;