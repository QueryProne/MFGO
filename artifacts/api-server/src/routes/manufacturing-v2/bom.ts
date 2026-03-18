import { Router } from "express";
import {
  db,
  itemsTable,
  mfgBomComponentsTable,
  mfgBomsTable,
  mfgBomVersionHistoryTable,
} from "@workspace/db";
import { and, asc, desc, eq, sql } from "drizzle-orm";

import { auditLog } from "../../lib/audit";
import { explodeBom } from "../../modules/mfg-v2/bom-explosion";
import { parseDateParam, parsePagination } from "../../modules/mfg-v2/http";
import { nextVersionString, toNumericString, asNumber, asString, toIsoDate } from "./shared";

const router = Router();

type BomComponentPayload = {
  id?: string;
  clientId?: string;
  parentClientId?: string;
  parentComponentId?: string | null;
  componentItemId: string;
  sequence?: number;
  quantity: number | string;
  uom?: string;
  scrapFactor?: number | string;
  isPhantom?: boolean;
  isOptional?: boolean;
  operationSequence?: number | null;
  substituteGroup?: string | null;
  effectiveFrom?: string | null;
  effectiveTo?: string | null;
  notes?: string | null;
};

async function replaceBomComponents(bomId: string, components: BomComponentPayload[]) {
  await db.delete(mfgBomComponentsTable).where(eq(mfgBomComponentsTable.bomId, bomId));

  if (components.length === 0) {
    return;
  }

  const generatedByClientId = new Map<string, string>();
  for (const component of components) {
    if (component.clientId) {
      generatedByClientId.set(component.clientId, crypto.randomUUID());
    }
  }

  const rows = components.map((component, idx) => {
    const id = component.clientId ? (generatedByClientId.get(component.clientId) as string) : component.id ?? crypto.randomUUID();
    const parentComponentId = component.parentComponentId ??
      (component.parentClientId ? generatedByClientId.get(component.parentClientId) ?? null : null);

    return {
      id,
      bomId,
      parentComponentId,
      componentItemId: component.componentItemId,
      sequence: component.sequence ?? (idx + 1) * 10,
      quantity: toNumericString(component.quantity, "1"),
      uom: component.uom ?? "EA",
      scrapFactor: toNumericString(component.scrapFactor, "0"),
      isPhantom: component.isPhantom ?? false,
      isOptional: component.isOptional ?? false,
      operationSequence: component.operationSequence ?? null,
      substituteGroup: component.substituteGroup ?? null,
      effectiveFrom: component.effectiveFrom ?? null,
      effectiveTo: component.effectiveTo ?? null,
      notes: component.notes ?? null,
    };
  });

  await db.insert(mfgBomComponentsTable).values(rows);
}

async function getBomWithComponents(bomId: string) {
  const [bom] = await db
    .select({
      id: mfgBomsTable.id,
      parentItemId: mfgBomsTable.parentItemId,
      parentItemNumber: itemsTable.number,
      parentItemName: itemsTable.name,
      bomType: mfgBomsTable.bomType,
      alternateCode: mfgBomsTable.alternateCode,
      version: mfgBomsTable.version,
      status: mfgBomsTable.status,
      isDefault: mfgBomsTable.isDefault,
      isPhantom: mfgBomsTable.isPhantom,
      effectiveFrom: mfgBomsTable.effectiveFrom,
      effectiveTo: mfgBomsTable.effectiveTo,
      notes: mfgBomsTable.notes,
      createdAt: mfgBomsTable.createdAt,
      updatedAt: mfgBomsTable.updatedAt,
    })
    .from(mfgBomsTable)
    .leftJoin(itemsTable, eq(mfgBomsTable.parentItemId, itemsTable.id))
    .where(eq(mfgBomsTable.id, bomId))
    .limit(1);

  if (!bom) {
    return null;
  }

  const components = await db
    .select({
      id: mfgBomComponentsTable.id,
      bomId: mfgBomComponentsTable.bomId,
      parentComponentId: mfgBomComponentsTable.parentComponentId,
      componentItemId: mfgBomComponentsTable.componentItemId,
      componentItemNumber: itemsTable.number,
      componentItemName: itemsTable.name,
      sequence: mfgBomComponentsTable.sequence,
      quantity: mfgBomComponentsTable.quantity,
      uom: mfgBomComponentsTable.uom,
      scrapFactor: mfgBomComponentsTable.scrapFactor,
      isPhantom: mfgBomComponentsTable.isPhantom,
      isOptional: mfgBomComponentsTable.isOptional,
      operationSequence: mfgBomComponentsTable.operationSequence,
      substituteGroup: mfgBomComponentsTable.substituteGroup,
      effectiveFrom: mfgBomComponentsTable.effectiveFrom,
      effectiveTo: mfgBomComponentsTable.effectiveTo,
      notes: mfgBomComponentsTable.notes,
    })
    .from(mfgBomComponentsTable)
    .leftJoin(itemsTable, eq(mfgBomComponentsTable.componentItemId, itemsTable.id))
    .where(eq(mfgBomComponentsTable.bomId, bomId))
    .orderBy(asc(mfgBomComponentsTable.sequence));

  return { ...bom, components };
}

router.get("/boms", async (req, res) => {
  try {
    const { page, limit, offset } = parsePagination(req.query as Record<string, unknown>);
    const conditions = [];

    if (asString(req.query.parentItemId)) {
      conditions.push(eq(mfgBomsTable.parentItemId, String(req.query.parentItemId)));
    }
    if (asString(req.query.bomType)) {
      conditions.push(eq(mfgBomsTable.bomType, String(req.query.bomType)));
    }
    if (asString(req.query.status)) {
      conditions.push(eq(mfgBomsTable.status, String(req.query.status)));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [data, countResult] = await Promise.all([
      db
        .select({
          id: mfgBomsTable.id,
          parentItemId: mfgBomsTable.parentItemId,
          parentItemNumber: itemsTable.number,
          parentItemName: itemsTable.name,
          bomType: mfgBomsTable.bomType,
          alternateCode: mfgBomsTable.alternateCode,
          version: mfgBomsTable.version,
          status: mfgBomsTable.status,
          isDefault: mfgBomsTable.isDefault,
          isPhantom: mfgBomsTable.isPhantom,
          effectiveFrom: mfgBomsTable.effectiveFrom,
          effectiveTo: mfgBomsTable.effectiveTo,
          updatedAt: mfgBomsTable.updatedAt,
        })
        .from(mfgBomsTable)
        .leftJoin(itemsTable, eq(mfgBomsTable.parentItemId, itemsTable.id))
        .where(whereClause)
        .orderBy(desc(mfgBomsTable.updatedAt))
        .limit(limit)
        .offset(offset),
      db.select({ count: sql<number>`count(*)` }).from(mfgBomsTable).where(whereClause),
    ]);

    const total = Number(countResult[0]?.count ?? 0);
    res.json({ data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (error) {
    res.status(500).json({ error: "error", message: String(error) });
  }
});

router.post("/boms", async (req, res) => {
  try {
    const body = req.body as {
      parentItemId: string;
      bomType?: string;
      alternateCode?: string;
      version?: string;
      status?: string;
      isDefault?: boolean;
      isPhantom?: boolean;
      effectiveFrom?: string | null;
      effectiveTo?: string | null;
      notes?: string;
      components?: BomComponentPayload[];
    };

    const [created] = await db
      .insert(mfgBomsTable)
      .values({
        parentItemId: body.parentItemId,
        bomType: body.bomType ?? "manufacturing",
        alternateCode: body.alternateCode ?? "PRIMARY",
        version: body.version ?? "1.0",
        status: body.status ?? "draft",
        isDefault: body.isDefault ?? false,
        isPhantom: body.isPhantom ?? false,
        effectiveFrom: body.effectiveFrom ?? null,
        effectiveTo: body.effectiveTo ?? null,
        notes: body.notes ?? null,
        createdBy: req.header("x-user") ?? "system-user",
      })
      .returning({ id: mfgBomsTable.id, version: mfgBomsTable.version });

    if (!created?.id) {
      throw new Error("Failed to create BOM");
    }

    await replaceBomComponents(created.id, body.components ?? []);
    const snapshot = await getBomWithComponents(created.id);

    await db.insert(mfgBomVersionHistoryTable).values({
      bomId: created.id,
      version: created.version,
      action: "create",
      snapshot,
      changedBy: req.header("x-user") ?? "system-user",
    });

    await auditLog(
      {
        entity: "mfg_bom",
        entityId: created.id,
        action: "create",
        fieldChanges: { parentItemId: body.parentItemId, version: created.version, lines: body.components?.length ?? 0 },
      },
      req,
    );

    res.status(201).json(snapshot);
  } catch (error) {
    res.status(500).json({ error: "error", message: String(error) });
  }
});

router.get("/boms/:id", async (req, res) => {
  try {
    const bom = await getBomWithComponents(req.params.id);
    if (!bom) {
      res.status(404).json({ error: "not_found", message: "BOM not found" });
      return;
    }
    res.json(bom);
  } catch (error) {
    res.status(500).json({ error: "error", message: String(error) });
  }
});

router.put("/boms/:id", async (req, res) => {
  try {
    const body = req.body as {
      bomType?: string;
      alternateCode?: string;
      version?: string;
      status?: string;
      isDefault?: boolean;
      isPhantom?: boolean;
      effectiveFrom?: string | null;
      effectiveTo?: string | null;
      notes?: string;
      components?: BomComponentPayload[];
    };

    await db
      .update(mfgBomsTable)
      .set({
        bomType: body.bomType,
        alternateCode: body.alternateCode,
        version: body.version,
        status: body.status,
        isDefault: body.isDefault,
        isPhantom: body.isPhantom,
        effectiveFrom: body.effectiveFrom,
        effectiveTo: body.effectiveTo,
        notes: body.notes,
        updatedAt: new Date(),
      })
      .where(eq(mfgBomsTable.id, req.params.id));

    if (body.components) {
      await replaceBomComponents(req.params.id, body.components);
    }

    const snapshot = await getBomWithComponents(req.params.id);
    if (!snapshot) {
      res.status(404).json({ error: "not_found", message: "BOM not found" });
      return;
    }

    res.json(snapshot);
  } catch (error) {
    res.status(500).json({ error: "error", message: String(error) });
  }
});
router.get("/boms/:id/versions", async (req, res) => {
  try {
    const versions = await db
      .select({
        id: mfgBomVersionHistoryTable.id,
        version: mfgBomVersionHistoryTable.version,
        action: mfgBomVersionHistoryTable.action,
        changedBy: mfgBomVersionHistoryTable.changedBy,
        changedAt: mfgBomVersionHistoryTable.changedAt,
      })
      .from(mfgBomVersionHistoryTable)
      .where(eq(mfgBomVersionHistoryTable.bomId, req.params.id))
      .orderBy(desc(mfgBomVersionHistoryTable.changedAt));

    res.json({ data: versions });
  } catch (error) {
    res.status(500).json({ error: "error", message: String(error) });
  }
});

router.post("/boms/:id/versions", async (req, res) => {
  try {
    const body = req.body as { newVersion?: string; status?: string; effectiveFrom?: string | null; effectiveTo?: string | null };

    const sourceBom = await getBomWithComponents(req.params.id);
    if (!sourceBom) {
      res.status(404).json({ error: "not_found", message: "Source BOM not found" });
      return;
    }

    const newVersion = body.newVersion ?? nextVersionString(sourceBom.version);

    const [createdBom] = await db
      .insert(mfgBomsTable)
      .values({
        parentItemId: sourceBom.parentItemId,
        bomType: sourceBom.bomType,
        alternateCode: sourceBom.alternateCode,
        version: newVersion,
        status: body.status ?? "draft",
        isDefault: false,
        isPhantom: sourceBom.isPhantom,
        effectiveFrom: body.effectiveFrom ?? sourceBom.effectiveFrom,
        effectiveTo: body.effectiveTo ?? sourceBom.effectiveTo,
        sourceBomId: sourceBom.id,
        notes: sourceBom.notes,
        createdBy: req.header("x-user") ?? "system-user",
      })
      .returning({ id: mfgBomsTable.id, version: mfgBomsTable.version });

    if (!createdBom?.id) {
      throw new Error("Failed to create BOM version");
    }

    const oldToNewComponentId = new Map<string, string>();
    for (const component of sourceBom.components) {
      oldToNewComponentId.set(component.id, crypto.randomUUID());
    }

    if (sourceBom.components.length > 0) {
      await db.insert(mfgBomComponentsTable).values(
        sourceBom.components.map((component) => ({
          id: oldToNewComponentId.get(component.id) as string,
          bomId: createdBom.id,
          parentComponentId: component.parentComponentId ? oldToNewComponentId.get(component.parentComponentId) ?? null : null,
          componentItemId: component.componentItemId,
          sequence: component.sequence,
          quantity: component.quantity,
          uom: component.uom,
          scrapFactor: component.scrapFactor,
          isPhantom: component.isPhantom,
          isOptional: component.isOptional,
          operationSequence: component.operationSequence,
          substituteGroup: component.substituteGroup,
          effectiveFrom: component.effectiveFrom,
          effectiveTo: component.effectiveTo,
          notes: component.notes,
        })),
      );
    }

    const snapshot = await getBomWithComponents(createdBom.id);

    await db.insert(mfgBomVersionHistoryTable).values({
      bomId: createdBom.id,
      version: newVersion,
      action: "branch_version",
      snapshot,
      changedBy: req.header("x-user") ?? "system-user",
    });

    res.status(201).json(snapshot);
  } catch (error) {
    res.status(500).json({ error: "error", message: String(error) });
  }
});

router.post("/boms/:id/explode", async (req, res) => {
  try {
    const body = req.body as { orderQuantity?: number; asOfDate?: string };
    const bom = await getBomWithComponents(req.params.id);
    if (!bom) {
      res.status(404).json({ error: "not_found", message: "BOM not found" });
      return;
    }

    const orderQuantity = asNumber(body.orderQuantity, 1);
    const asOfDate = parseDateParam(body.asOfDate, new Date()) ?? new Date();

    const components = bom.components.map((component) => ({
      id: component.id,
      parentComponentId: component.parentComponentId,
      componentItemId: component.componentItemId,
      itemNumber: component.componentItemNumber,
      itemName: component.componentItemName,
      sequence: component.sequence,
      quantity: component.quantity,
      uom: component.uom,
      scrapFactor: component.scrapFactor,
      isPhantom: component.isPhantom,
      effectiveFrom: component.effectiveFrom,
      effectiveTo: component.effectiveTo,
    }));

    const explosion = explodeBom(components, orderQuantity, asOfDate);

    res.json({
      data: {
        bomId: bom.id,
        version: bom.version,
        orderQuantity,
        asOfDate: toIsoDate(asOfDate),
        ...explosion,
      },
    });
  } catch (error) {
    res.status(500).json({ error: "error", message: String(error) });
  }
});

export default router;
