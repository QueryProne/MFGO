import { Router } from "express";
import { and, asc, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";

import {
  customFieldValuesTable,
  customFieldsTable,
  customFormFieldsTable,
  customFormsTable,
  dataTypesTable,
  db,
  pageCustomFormsTable,
} from "@workspace/db";
import { asBoolean, asString, parsePagination } from "../modules/communications/http";

const router = Router();

type JsonObject = Record<string, unknown>;

function parseId(raw: string): number | null {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 150);
}

function asObject(value: unknown): JsonObject {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonObject) : {};
}

function asArray(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value) ? (value as Array<Record<string, unknown>>) : [];
}

const STANDARD_DATA_TYPES: Array<{
  name: string;
  slug: string;
  description: string;
  settings?: JsonObject;
}> = [
  { name: "Text", slug: "text", description: "Single-line plain text." },
  { name: "Long Text", slug: "long_text", description: "Multi-line plain text." },
  { name: "Rich Text", slug: "rich_text", description: "Formatted text with markdown/HTML payloads." },
  { name: "Number", slug: "number", description: "Integer or decimal numeric values." },
  { name: "Decimal", slug: "decimal", description: "High precision decimal values for engineering and costing." },
  { name: "Currency", slug: "currency", description: "Monetary amounts with currency metadata." },
  { name: "Percent", slug: "percent", description: "Percentage values, typically 0-100." },
  { name: "Boolean", slug: "boolean", description: "True/false toggle fields." },
  { name: "Date", slug: "date", description: "Calendar date values (YYYY-MM-DD)." },
  { name: "Date Time", slug: "datetime", description: "Timestamp values with date and time." },
  { name: "Time", slug: "time", description: "Time-of-day values." },
  { name: "Select", slug: "select", description: "Single selection from predefined options." },
  { name: "Multi Select", slug: "multi_select", description: "Multiple selections from predefined options." },
  { name: "Email", slug: "email", description: "Email-address formatted text values." },
  { name: "Phone", slug: "phone", description: "Phone-number formatted text values." },
  { name: "URL", slug: "url", description: "Web link values." },
  { name: "File", slug: "file", description: "Reference to file attachment metadata or storage key." },
  { name: "Image", slug: "image", description: "Reference to image attachment metadata or storage key." },
  { name: "JSON", slug: "json", description: "Structured JSON object/array payload." },
];

async function bootstrapStandardDataTypes() {
  const slugs = STANDARD_DATA_TYPES.map((item) => item.slug);
  const existing = await db
    .select({ slug: dataTypesTable.slug })
    .from(dataTypesTable)
    .where(inArray(dataTypesTable.slug, slugs));

  const existingSlugs = new Set(existing.map((row) => row.slug));
  const toInsert = STANDARD_DATA_TYPES.filter((item) => !existingSlugs.has(item.slug));
  if (!toInsert.length) {
    return { inserted: 0, totalStandard: STANDARD_DATA_TYPES.length };
  }

  await db
    .insert(dataTypesTable)
    .values(
      toInsert.map((item) => ({
        name: item.name,
        slug: item.slug,
        description: item.description,
        settings: item.settings ?? {},
        isSystem: true,
      })),
    )
    .onConflictDoNothing({ target: dataTypesTable.slug });

  return { inserted: toInsert.length, totalStandard: STANDARD_DATA_TYPES.length };
}

router.get("/custom/data-types", async (req, res) => {
  try {
    await bootstrapStandardDataTypes();
    const { page, limit, offset } = parsePagination(req.query as Record<string, unknown>, { limit: 100 });
    const search = asString(req.query.search);
    const whereClause = search
      ? or(ilike(dataTypesTable.name, `%${search}%`), ilike(dataTypesTable.slug, `%${search}%`))
      : undefined;

    const [data, countRows] = await Promise.all([
      db.select().from(dataTypesTable).where(whereClause).orderBy(asc(dataTypesTable.name)).limit(limit).offset(offset),
      db.select({ count: sql<number>`count(*)` }).from(dataTypesTable).where(whereClause),
    ]);

    const total = Number(countRows[0]?.count ?? 0);
    res.json({ data, meta: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) } });
  } catch (error) {
    res.status(500).json({ error: "error", message: String(error) });
  }
});

router.post("/custom/data-types/bootstrap", async (_req, res) => {
  try {
    const result = await bootstrapStandardDataTypes();
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(500).json({ error: "error", message: String(error) });
  }
});

router.post("/custom/data-types", async (req, res) => {
  try {
    const payload = req.body as { name: string; slug?: string; description?: string | null; settings?: JsonObject; isSystem?: boolean };
    const name = typeof payload.name === "string" ? payload.name.trim() : "";
    if (!name) {
      res.status(400).json({ error: "bad_request", message: "name is required" });
      return;
    }
    const [created] = await db
      .insert(dataTypesTable)
      .values({
        name,
        slug: (payload.slug ? slugify(payload.slug) : slugify(name)) || `type-${Date.now()}`,
        description: payload.description ?? null,
        settings: asObject(payload.settings),
        isSystem: payload.isSystem ?? false,
      })
      .returning();
    res.status(201).json(created);
  } catch (error) {
    res.status(400).json({ error: "bad_request", message: String(error) });
  }
});

router.patch("/custom/data-types/:id", async (req, res) => {
  try {
    const id = parseId(String(req.params.id));
    if (!id) {
      res.status(400).json({ error: "bad_request", message: "Invalid data type id" });
      return;
    }
    const [existing] = await db.select().from(dataTypesTable).where(eq(dataTypesTable.id, id)).limit(1);
    if (!existing) {
      res.status(404).json({ error: "not_found", message: "Data type not found" });
      return;
    }

    const payload = req.body as { name?: string; slug?: string; description?: string | null; settings?: JsonObject; isSystem?: boolean };
    const [updated] = await db
      .update(dataTypesTable)
      .set({
        name: payload.name !== undefined ? payload.name.trim() : existing.name,
        slug: payload.slug !== undefined ? slugify(payload.slug) : existing.slug,
        description: payload.description !== undefined ? payload.description : existing.description,
        settings: payload.settings !== undefined ? asObject(payload.settings) : (existing.settings as JsonObject),
        isSystem: payload.isSystem ?? existing.isSystem,
        updatedAt: new Date(),
      })
      .where(eq(dataTypesTable.id, id))
      .returning();
    res.json(updated);
  } catch (error) {
    res.status(400).json({ error: "bad_request", message: String(error) });
  }
});

router.delete("/custom/data-types/:id", async (req, res) => {
  try {
    const id = parseId(String(req.params.id));
    if (!id) {
      res.status(400).json({ error: "bad_request", message: "Invalid data type id" });
      return;
    }

    const [existing, usage] = await Promise.all([
      db.select().from(dataTypesTable).where(eq(dataTypesTable.id, id)).limit(1),
      db.select({ count: sql<number>`count(*)` }).from(customFieldsTable).where(eq(customFieldsTable.dataTypeId, id)),
    ]);

    if (!existing[0]) {
      res.status(404).json({ error: "not_found", message: "Data type not found" });
      return;
    }
    if (existing[0].isSystem || Number(usage[0]?.count ?? 0) > 0) {
      res.status(409).json({ error: "conflict", message: "Data type cannot be deleted" });
      return;
    }

    await db.delete(dataTypesTable).where(eq(dataTypesTable.id, id));
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "error", message: String(error) });
  }
});

router.get("/custom/fields", async (req, res) => {
  try {
    const { page, limit, offset } = parsePagination(req.query as Record<string, unknown>, { limit: 100 });
    const search = asString(req.query.search);
    const dataTypeId = asString(req.query.dataTypeId);
    const isActive = asBoolean(req.query.isActive);

    const whereParts = [];
    if (search) whereParts.push(or(ilike(customFieldsTable.name, `%${search}%`), ilike(customFieldsTable.slug, `%${search}%`)));
    if (dataTypeId) {
      const id = parseId(dataTypeId);
      if (!id) {
        res.status(400).json({ error: "bad_request", message: "Invalid dataTypeId filter" });
        return;
      }
      whereParts.push(eq(customFieldsTable.dataTypeId, id));
    }
    if (isActive !== null) whereParts.push(eq(customFieldsTable.isActive, isActive));
    const whereClause = whereParts.length ? and(...whereParts) : undefined;

    const [data, countRows] = await Promise.all([
      db
        .select({
          id: customFieldsTable.id,
          name: customFieldsTable.name,
          slug: customFieldsTable.slug,
          label: customFieldsTable.label,
          description: customFieldsTable.description,
          dataTypeId: customFieldsTable.dataTypeId,
          dataTypeSlug: dataTypesTable.slug,
          isRequired: customFieldsTable.isRequired,
          isActive: customFieldsTable.isActive,
          defaultValue: customFieldsTable.defaultValue,
          options: customFieldsTable.options,
          settings: customFieldsTable.settings,
          createdAt: customFieldsTable.createdAt,
          updatedAt: customFieldsTable.updatedAt,
        })
        .from(customFieldsTable)
        .leftJoin(dataTypesTable, eq(customFieldsTable.dataTypeId, dataTypesTable.id))
        .where(whereClause)
        .orderBy(desc(customFieldsTable.createdAt))
        .limit(limit)
        .offset(offset),
      db.select({ count: sql<number>`count(*)` }).from(customFieldsTable).where(whereClause),
    ]);

    const total = Number(countRows[0]?.count ?? 0);
    res.json({ data, meta: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) } });
  } catch (error) {
    res.status(500).json({ error: "error", message: String(error) });
  }
});

router.post("/custom/fields", async (req, res) => {
  try {
    const payload = req.body as {
      name: string;
      slug?: string;
      label?: string | null;
      description?: string | null;
      helpText?: string | null;
      placeholder?: string | null;
      dataTypeId: number;
      isRequired?: boolean;
      isActive?: boolean;
      defaultValue?: unknown;
      options?: Array<Record<string, unknown>>;
      settings?: JsonObject;
    };

    const dataTypeId = Number(payload.dataTypeId);
    const [dataType] = await db.select().from(dataTypesTable).where(eq(dataTypesTable.id, dataTypeId)).limit(1);
    if (!dataType) {
      res.status(400).json({ error: "bad_request", message: "Referenced dataTypeId does not exist" });
      return;
    }

    const name = typeof payload.name === "string" ? payload.name.trim() : "";
    if (!name) {
      res.status(400).json({ error: "bad_request", message: "name is required" });
      return;
    }

    const [created] = await db
      .insert(customFieldsTable)
      .values({
        name,
        slug: (payload.slug ? slugify(payload.slug) : slugify(name)) || `field-${Date.now()}`,
        label: payload.label ?? null,
        description: payload.description ?? null,
        helpText: payload.helpText ?? null,
        placeholder: payload.placeholder ?? null,
        dataTypeId,
        isRequired: payload.isRequired ?? false,
        isActive: payload.isActive ?? true,
        defaultValue: payload.defaultValue ?? null,
        options: asArray(payload.options),
        settings: asObject(payload.settings),
      })
      .returning();
    res.status(201).json(created);
  } catch (error) {
    res.status(400).json({ error: "bad_request", message: String(error) });
  }
});

router.patch("/custom/fields/:id", async (req, res) => {
  try {
    const id = parseId(String(req.params.id));
    if (!id) {
      res.status(400).json({ error: "bad_request", message: "Invalid field id" });
      return;
    }
    const [existing] = await db.select().from(customFieldsTable).where(eq(customFieldsTable.id, id)).limit(1);
    if (!existing) {
      res.status(404).json({ error: "not_found", message: "Custom field not found" });
      return;
    }

    const payload = req.body as {
      name?: string;
      slug?: string;
      label?: string | null;
      description?: string | null;
      helpText?: string | null;
      placeholder?: string | null;
      dataTypeId?: number;
      isRequired?: boolean;
      isActive?: boolean;
      defaultValue?: unknown;
      options?: Array<Record<string, unknown>>;
      settings?: JsonObject;
    };

    const nextDataTypeId = payload.dataTypeId !== undefined ? Number(payload.dataTypeId) : existing.dataTypeId;
    const [typeCheck] = await db.select().from(dataTypesTable).where(eq(dataTypesTable.id, nextDataTypeId)).limit(1);
    if (!typeCheck) {
      res.status(400).json({ error: "bad_request", message: "Referenced dataTypeId does not exist" });
      return;
    }

    const [updated] = await db
      .update(customFieldsTable)
      .set({
        name: payload.name !== undefined ? payload.name.trim() : existing.name,
        slug: payload.slug !== undefined ? slugify(payload.slug) : existing.slug,
        label: payload.label !== undefined ? payload.label : existing.label,
        description: payload.description !== undefined ? payload.description : existing.description,
        helpText: payload.helpText !== undefined ? payload.helpText : existing.helpText,
        placeholder: payload.placeholder !== undefined ? payload.placeholder : existing.placeholder,
        dataTypeId: nextDataTypeId,
        isRequired: payload.isRequired ?? existing.isRequired,
        isActive: payload.isActive ?? existing.isActive,
        defaultValue: payload.defaultValue !== undefined ? payload.defaultValue : existing.defaultValue,
        options: payload.options !== undefined ? asArray(payload.options) : existing.options,
        settings: payload.settings !== undefined ? asObject(payload.settings) : (existing.settings as JsonObject),
        updatedAt: new Date(),
      })
      .where(eq(customFieldsTable.id, id))
      .returning();
    res.json(updated);
  } catch (error) {
    res.status(400).json({ error: "bad_request", message: String(error) });
  }
});

router.delete("/custom/fields/:id", async (req, res) => {
  try {
    const id = parseId(String(req.params.id));
    if (!id) {
      res.status(400).json({ error: "bad_request", message: "Invalid field id" });
      return;
    }
    const [existing, usage1, usage2] = await Promise.all([
      db.select().from(customFieldsTable).where(eq(customFieldsTable.id, id)).limit(1),
      db.select({ count: sql<number>`count(*)` }).from(customFormFieldsTable).where(eq(customFormFieldsTable.fieldId, id)),
      db.select({ count: sql<number>`count(*)` }).from(customFieldValuesTable).where(eq(customFieldValuesTable.fieldId, id)),
    ]);
    if (!existing[0]) {
      res.status(404).json({ error: "not_found", message: "Custom field not found" });
      return;
    }
    if (Number(usage1[0]?.count ?? 0) > 0 || Number(usage2[0]?.count ?? 0) > 0) {
      res.status(409).json({ error: "conflict", message: "Custom field is in use and cannot be deleted" });
      return;
    }
    await db.delete(customFieldsTable).where(eq(customFieldsTable.id, id));
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "error", message: String(error) });
  }
});

router.get("/custom/forms", async (req, res) => {
  try {
    const { page, limit, offset } = parsePagination(req.query as Record<string, unknown>, { limit: 100 });
    const search = asString(req.query.search);
    const whereClause = search
      ? or(ilike(customFormsTable.name, `%${search}%`), ilike(customFormsTable.slug, `%${search}%`))
      : undefined;

    const [forms, countRows] = await Promise.all([
      db.select().from(customFormsTable).where(whereClause).orderBy(desc(customFormsTable.createdAt)).limit(limit).offset(offset),
      db.select({ count: sql<number>`count(*)` }).from(customFormsTable).where(whereClause),
    ]);

    const formIds = forms.map((form) => form.id);
    const mappings =
      formIds.length > 0
        ? await db
            .select({
              mappingId: customFormFieldsTable.id,
              formId: customFormFieldsTable.formId,
              fieldId: customFormFieldsTable.fieldId,
              section: customFormFieldsTable.section,
              sortOrder: customFormFieldsTable.sortOrder,
              isRequired: customFormFieldsTable.isRequired,
              fieldName: customFieldsTable.name,
              fieldSlug: customFieldsTable.slug,
              fieldLabel: customFieldsTable.label,
              fieldOptions: customFieldsTable.options,
              fieldPlaceholder: customFieldsTable.placeholder,
              fieldHelpText: customFieldsTable.helpText,
              fieldRequired: customFieldsTable.isRequired,
              dataTypeSlug: dataTypesTable.slug,
            })
            .from(customFormFieldsTable)
            .leftJoin(customFieldsTable, eq(customFormFieldsTable.fieldId, customFieldsTable.id))
            .leftJoin(dataTypesTable, eq(customFieldsTable.dataTypeId, dataTypesTable.id))
            .where(inArray(customFormFieldsTable.formId, formIds))
            .orderBy(asc(customFormFieldsTable.formId), asc(customFormFieldsTable.sortOrder))
        : [];

    const byForm = new Map<number, Array<(typeof mappings)[number]>>();
    for (const mapping of mappings) {
      const existing = byForm.get(mapping.formId) ?? [];
      existing.push(mapping);
      byForm.set(mapping.formId, existing);
    }

    const total = Number(countRows[0]?.count ?? 0);
    res.json({
      data: forms.map((form) => ({ ...form, fields: byForm.get(form.id) ?? [] })),
      meta: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
    });
  } catch (error) {
    res.status(500).json({ error: "error", message: String(error) });
  }
});

router.post("/custom/forms", async (req, res) => {
  try {
    const payload = req.body as { name: string; slug?: string; description?: string | null; settings?: JsonObject; isActive?: boolean };
    const name = typeof payload.name === "string" ? payload.name.trim() : "";
    if (!name) {
      res.status(400).json({ error: "bad_request", message: "name is required" });
      return;
    }
    const [created] = await db
      .insert(customFormsTable)
      .values({
        name,
        slug: (payload.slug ? slugify(payload.slug) : slugify(name)) || `form-${Date.now()}`,
        description: payload.description ?? null,
        settings: asObject(payload.settings),
        isActive: payload.isActive ?? true,
      })
      .returning();
    res.status(201).json(created);
  } catch (error) {
    res.status(400).json({ error: "bad_request", message: String(error) });
  }
});

router.patch("/custom/forms/:id", async (req, res) => {
  try {
    const id = parseId(String(req.params.id));
    if (!id) {
      res.status(400).json({ error: "bad_request", message: "Invalid form id" });
      return;
    }
    const [existing] = await db.select().from(customFormsTable).where(eq(customFormsTable.id, id)).limit(1);
    if (!existing) {
      res.status(404).json({ error: "not_found", message: "Custom form not found" });
      return;
    }
    const payload = req.body as { name?: string; slug?: string; description?: string | null; settings?: JsonObject; isActive?: boolean };
    const [updated] = await db
      .update(customFormsTable)
      .set({
        name: payload.name !== undefined ? payload.name.trim() : existing.name,
        slug: payload.slug !== undefined ? slugify(payload.slug) : existing.slug,
        description: payload.description !== undefined ? payload.description : existing.description,
        settings: payload.settings !== undefined ? asObject(payload.settings) : (existing.settings as JsonObject),
        isActive: payload.isActive ?? existing.isActive,
        updatedAt: new Date(),
      })
      .where(eq(customFormsTable.id, id))
      .returning();
    res.json(updated);
  } catch (error) {
    res.status(400).json({ error: "bad_request", message: String(error) });
  }
});

router.delete("/custom/forms/:id", async (req, res) => {
  try {
    const id = parseId(String(req.params.id));
    if (!id) {
      res.status(400).json({ error: "bad_request", message: "Invalid form id" });
      return;
    }
    await db.delete(customFormsTable).where(eq(customFormsTable.id, id));
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "error", message: String(error) });
  }
});

router.post("/custom/forms/:id/fields", async (req, res) => {
  try {
    const formId = parseId(String(req.params.id));
    if (!formId) {
      res.status(400).json({ error: "bad_request", message: "Invalid form id" });
      return;
    }
    const [form] = await db.select().from(customFormsTable).where(eq(customFormsTable.id, formId)).limit(1);
    if (!form) {
      res.status(404).json({ error: "not_found", message: "Custom form not found" });
      return;
    }

    const payload = req.body as {
      fieldId: number;
      section?: string | null;
      sortOrder?: number;
      isRequired?: boolean | null;
      defaultValue?: unknown;
      options?: Array<Record<string, unknown>> | null;
      settings?: JsonObject;
    };
    const fieldId = Number(payload.fieldId);
    const [field] = await db.select().from(customFieldsTable).where(eq(customFieldsTable.id, fieldId)).limit(1);
    if (!field) {
      res.status(400).json({ error: "bad_request", message: "Referenced fieldId does not exist" });
      return;
    }

    const [saved] = await db
      .insert(customFormFieldsTable)
      .values({
        formId,
        fieldId,
        section: payload.section ?? null,
        sortOrder: payload.sortOrder ?? 0,
        isRequired: payload.isRequired ?? null,
        defaultValue: payload.defaultValue ?? null,
        options: payload.options ?? null,
        settings: asObject(payload.settings),
      })
      .onConflictDoUpdate({
        target: [customFormFieldsTable.formId, customFormFieldsTable.fieldId],
        set: {
          section: payload.section ?? null,
          sortOrder: payload.sortOrder ?? 0,
          isRequired: payload.isRequired ?? null,
          defaultValue: payload.defaultValue ?? null,
          options: payload.options ?? null,
          settings: asObject(payload.settings),
          updatedAt: new Date(),
        },
      })
      .returning();

    res.status(201).json(saved);
  } catch (error) {
    res.status(400).json({ error: "bad_request", message: String(error) });
  }
});

router.delete("/custom/forms/:id/fields/:mappingId", async (req, res) => {
  try {
    const formId = parseId(String(req.params.id));
    const mappingId = parseId(String(req.params.mappingId));
    if (!formId || !mappingId) {
      res.status(400).json({ error: "bad_request", message: "Invalid form id or mapping id" });
      return;
    }
    await db.delete(customFormFieldsTable).where(and(eq(customFormFieldsTable.id, mappingId), eq(customFormFieldsTable.formId, formId)));
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "error", message: String(error) });
  }
});

router.get("/custom/entities/:entityType/:entityId/forms", async (req, res) => {
  try {
    const entityType = String(req.params.entityType);
    const entityId = String(req.params.entityId);
    const links = await db
      .select({
        linkId: pageCustomFormsTable.id,
        formId: pageCustomFormsTable.formId,
        sortOrder: pageCustomFormsTable.sortOrder,
        settings: pageCustomFormsTable.settings,
        formName: customFormsTable.name,
        formSlug: customFormsTable.slug,
      })
      .from(pageCustomFormsTable)
      .leftJoin(customFormsTable, eq(pageCustomFormsTable.formId, customFormsTable.id))
      .where(and(eq(pageCustomFormsTable.entityType, entityType), eq(pageCustomFormsTable.pageId, entityId)))
      .orderBy(asc(pageCustomFormsTable.sortOrder));

    const includeFields = asBoolean(req.query.includeFields) ?? true;
    if (!includeFields || links.length === 0) {
      res.json({ data: links });
      return;
    }

    const formIds = links.map((link) => link.formId);
    const mappings = await db
      .select({
        mappingId: customFormFieldsTable.id,
        formId: customFormFieldsTable.formId,
        fieldId: customFormFieldsTable.fieldId,
        sortOrder: customFormFieldsTable.sortOrder,
        section: customFormFieldsTable.section,
        isRequired: customFormFieldsTable.isRequired,
        fieldName: customFieldsTable.name,
        fieldSlug: customFieldsTable.slug,
        fieldLabel: customFieldsTable.label,
        fieldOptions: customFieldsTable.options,
        fieldPlaceholder: customFieldsTable.placeholder,
        fieldHelpText: customFieldsTable.helpText,
        fieldRequired: customFieldsTable.isRequired,
        dataTypeSlug: dataTypesTable.slug,
      })
      .from(customFormFieldsTable)
      .leftJoin(customFieldsTable, eq(customFormFieldsTable.fieldId, customFieldsTable.id))
      .leftJoin(dataTypesTable, eq(customFieldsTable.dataTypeId, dataTypesTable.id))
      .where(inArray(customFormFieldsTable.formId, formIds))
      .orderBy(asc(customFormFieldsTable.formId), asc(customFormFieldsTable.sortOrder));

    const fieldIds = mappings.map((mapping) => mapping.fieldId);
    const values =
      fieldIds.length > 0
        ? await db
            .select({
              fieldId: customFieldValuesTable.fieldId,
              value: customFieldValuesTable.value,
              updatedAt: customFieldValuesTable.updatedAt,
            })
            .from(customFieldValuesTable)
            .where(
              and(
                eq(customFieldValuesTable.entityType, entityType),
                eq(customFieldValuesTable.entityId, entityId),
                inArray(customFieldValuesTable.fieldId, fieldIds),
              ),
            )
        : [];

    const valueByFieldId = new Map<number, (typeof values)[number]>();
    for (const value of values) {
      valueByFieldId.set(value.fieldId, value);
    }

    const byForm = new Map<
      number,
      Array<
        (typeof mappings)[number] & {
          value: unknown;
          valueUpdatedAt: Date | null;
        }
      >
    >();
    for (const row of mappings) {
      const existing = byForm.get(row.formId) ?? [];
      existing.push({
        ...row,
        value: valueByFieldId.get(row.fieldId)?.value ?? null,
        valueUpdatedAt: valueByFieldId.get(row.fieldId)?.updatedAt ?? null,
      });
      byForm.set(row.formId, existing);
    }

    res.json({ data: links.map((link) => ({ ...link, fields: byForm.get(link.formId) ?? [] })) });
  } catch (error) {
    res.status(500).json({ error: "error", message: String(error) });
  }
});

router.post("/custom/entities/:entityType/:entityId/forms", async (req, res) => {
  try {
    const entityType = String(req.params.entityType);
    const entityId = String(req.params.entityId);
    const payload = req.body as { formId: number; sortOrder?: number; settings?: JsonObject };
    const formId = Number(payload.formId);
    const [form] = await db.select().from(customFormsTable).where(eq(customFormsTable.id, formId)).limit(1);
    if (!form) {
      res.status(404).json({ error: "not_found", message: "Custom form not found" });
      return;
    }

    const [saved] = await db
      .insert(pageCustomFormsTable)
      .values({
        entityType,
        pageId: entityId,
        formId,
        sortOrder: payload.sortOrder ?? 0,
        settings: asObject(payload.settings),
      })
      .onConflictDoUpdate({
        target: [pageCustomFormsTable.entityType, pageCustomFormsTable.pageId, pageCustomFormsTable.formId],
        set: { sortOrder: payload.sortOrder ?? 0, settings: asObject(payload.settings), updatedAt: new Date() },
      })
      .returning();
    res.status(201).json(saved);
  } catch (error) {
    res.status(400).json({ error: "bad_request", message: String(error) });
  }
});

router.delete("/custom/entities/:entityType/:entityId/forms/:linkId", async (req, res) => {
  try {
    const entityType = String(req.params.entityType);
    const entityId = String(req.params.entityId);
    const linkId = parseId(String(req.params.linkId));
    if (!linkId) {
      res.status(400).json({ error: "bad_request", message: "Invalid link id" });
      return;
    }
    await db
      .delete(pageCustomFormsTable)
      .where(and(eq(pageCustomFormsTable.id, linkId), eq(pageCustomFormsTable.entityType, entityType), eq(pageCustomFormsTable.pageId, entityId)));
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "error", message: String(error) });
  }
});

router.get("/custom/entities/:entityType/:entityId/values", async (req, res) => {
  try {
    const entityType = String(req.params.entityType);
    const entityId = String(req.params.entityId);
    const formId = asString(req.query.formId);

    let scopedFieldIds: number[] | null = null;
    if (formId) {
      const parsed = parseId(formId);
      if (!parsed) {
        res.status(400).json({ error: "bad_request", message: "Invalid formId filter" });
        return;
      }
      const rows = await db.select({ fieldId: customFormFieldsTable.fieldId }).from(customFormFieldsTable).where(eq(customFormFieldsTable.formId, parsed));
      scopedFieldIds = rows.map((row) => row.fieldId);
      if (scopedFieldIds.length === 0) {
        res.json({ data: [] });
        return;
      }
    }

    const whereClause = scopedFieldIds
      ? and(
          eq(customFieldValuesTable.entityType, entityType),
          eq(customFieldValuesTable.entityId, entityId),
          inArray(customFieldValuesTable.fieldId, scopedFieldIds),
        )
      : and(eq(customFieldValuesTable.entityType, entityType), eq(customFieldValuesTable.entityId, entityId));

    const data = await db
      .select({
        id: customFieldValuesTable.id,
        entityType: customFieldValuesTable.entityType,
        entityId: customFieldValuesTable.entityId,
        fieldId: customFieldValuesTable.fieldId,
        value: customFieldValuesTable.value,
        fieldName: customFieldsTable.name,
        fieldSlug: customFieldsTable.slug,
        dataTypeSlug: dataTypesTable.slug,
        updatedAt: customFieldValuesTable.updatedAt,
      })
      .from(customFieldValuesTable)
      .leftJoin(customFieldsTable, eq(customFieldValuesTable.fieldId, customFieldsTable.id))
      .leftJoin(dataTypesTable, eq(customFieldsTable.dataTypeId, dataTypesTable.id))
      .where(whereClause)
      .orderBy(asc(customFieldValuesTable.fieldId));

    res.json({ data });
  } catch (error) {
    res.status(500).json({ error: "error", message: String(error) });
  }
});

router.post("/custom/entities/:entityType/:entityId/values", async (req, res) => {
  try {
    const entityType = String(req.params.entityType);
    const entityId = String(req.params.entityId);
    const payload = req.body as { fieldId?: number; value?: unknown; values?: Array<{ fieldId: number; value: unknown }> };
    const rows = Array.isArray(payload.values) ? payload.values : payload.fieldId !== undefined ? [{ fieldId: payload.fieldId, value: payload.value }] : [];

    if (rows.length === 0) {
      res.status(400).json({ error: "bad_request", message: "fieldId/value or values[] is required" });
      return;
    }

    const fieldIds = rows.map((row) => Number(row.fieldId));
    const knownFields = await db.select({ id: customFieldsTable.id }).from(customFieldsTable).where(inArray(customFieldsTable.id, fieldIds));
    if (knownFields.length !== rows.length) {
      res.status(400).json({ error: "bad_request", message: "One or more fieldId values do not exist" });
      return;
    }

    const savedRows = [];
    for (const row of rows) {
      const [saved] = await db
        .insert(customFieldValuesTable)
        .values({
          entityType,
          entityId,
          fieldId: Number(row.fieldId),
          value: row.value ?? null,
        })
        .onConflictDoUpdate({
          target: [customFieldValuesTable.entityType, customFieldValuesTable.entityId, customFieldValuesTable.fieldId],
          set: { value: row.value ?? null, updatedAt: new Date() },
        })
        .returning();
      savedRows.push(saved);
    }

    res.status(201).json({ data: savedRows });
  } catch (error) {
    res.status(400).json({ error: "bad_request", message: String(error) });
  }
});

router.get("/custom/entities/:entityType/:entityId/forms/:formId", async (req, res) => {
  try {
    const entityType = String(req.params.entityType);
    const entityId = String(req.params.entityId);
    const formId = parseId(String(req.params.formId));
    if (!formId) {
      res.status(400).json({ error: "bad_request", message: "Invalid form id" });
      return;
    }

    const [form] = await db.select().from(customFormsTable).where(eq(customFormsTable.id, formId)).limit(1);
    if (!form) {
      res.status(404).json({ error: "not_found", message: "Custom form not found" });
      return;
    }

    const fields = await db
      .select({
        mappingId: customFormFieldsTable.id,
        fieldId: customFormFieldsTable.fieldId,
        section: customFormFieldsTable.section,
        sortOrder: customFormFieldsTable.sortOrder,
        isRequired: customFormFieldsTable.isRequired,
        formDefaultValue: customFormFieldsTable.defaultValue,
        fieldName: customFieldsTable.name,
        fieldSlug: customFieldsTable.slug,
        fieldDefaultValue: customFieldsTable.defaultValue,
        dataTypeSlug: dataTypesTable.slug,
      })
      .from(customFormFieldsTable)
      .leftJoin(customFieldsTable, eq(customFormFieldsTable.fieldId, customFieldsTable.id))
      .leftJoin(dataTypesTable, eq(customFieldsTable.dataTypeId, dataTypesTable.id))
      .where(eq(customFormFieldsTable.formId, formId))
      .orderBy(asc(customFormFieldsTable.sortOrder), asc(customFormFieldsTable.id));

    const fieldIds = fields.map((field) => field.fieldId);
    const values =
      fieldIds.length > 0
        ? await db
            .select()
            .from(customFieldValuesTable)
            .where(
              and(
                eq(customFieldValuesTable.entityType, entityType),
                eq(customFieldValuesTable.entityId, entityId),
                inArray(customFieldValuesTable.fieldId, fieldIds),
              ),
            )
        : [];

    const byFieldId = new Map<number, (typeof values)[number]>();
    for (const value of values) byFieldId.set(value.fieldId, value);

    res.json({
      form,
      fields: fields.map((field) => ({ ...field, value: byFieldId.get(field.fieldId)?.value ?? null })),
    });
  } catch (error) {
    res.status(500).json({ error: "error", message: String(error) });
  }
});

export default router;
