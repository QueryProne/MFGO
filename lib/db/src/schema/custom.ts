import { relations } from "drizzle-orm";
import {
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  varchar,
  boolean,
} from "drizzle-orm/pg-core";

export const dataTypesTable = pgTable(
  "data_types",
  {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 100 }).notNull(),
    slug: varchar("slug", { length: 100 }).notNull(),
    description: text("description"),
    settings: jsonb("settings").$type<Record<string, unknown>>().notNull().default({}),
    isSystem: boolean("is_system").notNull().default(false),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    slugUnique: uniqueIndex("uq_data_types_slug").on(table.slug),
    nameUnique: uniqueIndex("uq_data_types_name").on(table.name),
  }),
);

export const customFieldsTable = pgTable(
  "custom_fields",
  {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 150 }).notNull(),
    slug: varchar("slug", { length: 150 }).notNull(),
    label: varchar("label", { length: 200 }),
    description: text("description"),
    helpText: text("help_text"),
    placeholder: text("placeholder"),
    dataTypeId: integer("data_type_id")
      .notNull()
      .references(() => dataTypesTable.id, { onDelete: "restrict" }),
    isRequired: boolean("is_required").notNull().default(false),
    isActive: boolean("is_active").notNull().default(true),
    defaultValue: jsonb("default_value").$type<unknown>(),
    options: jsonb("options").$type<Array<Record<string, unknown>>>().notNull().default([]),
    settings: jsonb("settings").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    slugUnique: uniqueIndex("uq_custom_fields_slug").on(table.slug),
    dataTypeIdx: index("idx_custom_fields_data_type_id").on(table.dataTypeId),
    activeIdx: index("idx_custom_fields_is_active").on(table.isActive),
  }),
);

export const customFormsTable = pgTable(
  "custom_forms",
  {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 150 }).notNull(),
    slug: varchar("slug", { length: 150 }).notNull(),
    description: text("description"),
    settings: jsonb("settings").$type<Record<string, unknown>>().notNull().default({}),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    slugUnique: uniqueIndex("uq_custom_forms_slug").on(table.slug),
    activeIdx: index("idx_custom_forms_is_active").on(table.isActive),
  }),
);

export const customFormFieldsTable = pgTable(
  "custom_form_fields",
  {
    id: serial("id").primaryKey(),
    formId: integer("form_id")
      .notNull()
      .references(() => customFormsTable.id, { onDelete: "cascade" }),
    fieldId: integer("field_id")
      .notNull()
      .references(() => customFieldsTable.id, { onDelete: "restrict" }),
    section: varchar("section", { length: 120 }),
    sortOrder: integer("sort_order").notNull().default(0),
    isRequired: boolean("is_required"),
    defaultValue: jsonb("default_value").$type<unknown>(),
    options: jsonb("options").$type<Array<Record<string, unknown>>>(),
    settings: jsonb("settings").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    formFieldUnique: uniqueIndex("uq_custom_form_fields_form_field").on(table.formId, table.fieldId),
    formSortIdx: index("idx_custom_form_fields_form_sort").on(table.formId, table.sortOrder),
    fieldIdx: index("idx_custom_form_fields_field_id").on(table.fieldId),
  }),
);

export const pageCustomFormsTable = pgTable(
  "page_custom_forms",
  {
    id: serial("id").primaryKey(),
    entityType: varchar("entity_type", { length: 100 }).notNull().default("page"),
    pageId: varchar("page_id", { length: 200 }).notNull(),
    formId: integer("form_id")
      .notNull()
      .references(() => customFormsTable.id, { onDelete: "cascade" }),
    sortOrder: integer("sort_order").notNull().default(0),
    settings: jsonb("settings").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    entityFormUnique: uniqueIndex("uq_page_custom_forms_entity_form").on(table.entityType, table.pageId, table.formId),
    entitySortIdx: index("idx_page_custom_forms_entity_sort").on(table.entityType, table.pageId, table.sortOrder),
    formIdx: index("idx_page_custom_forms_form_id").on(table.formId),
  }),
);

export const customFieldValuesTable = pgTable(
  "custom_field_values",
  {
    id: serial("id").primaryKey(),
    entityType: varchar("entity_type", { length: 100 }).notNull(),
    entityId: varchar("entity_id", { length: 200 }).notNull(),
    fieldId: integer("field_id")
      .notNull()
      .references(() => customFieldsTable.id, { onDelete: "cascade" }),
    value: jsonb("value").$type<unknown>().notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    entityFieldUnique: uniqueIndex("uq_custom_field_values_entity_field").on(table.entityType, table.entityId, table.fieldId),
    entityIdx: index("idx_custom_field_values_entity").on(table.entityType, table.entityId),
    fieldIdx: index("idx_custom_field_values_field_id").on(table.fieldId),
  }),
);

export const dataTypesRelations = relations(dataTypesTable, ({ many }) => ({
  customFields: many(customFieldsTable),
}));

export const customFieldsRelations = relations(customFieldsTable, ({ one, many }) => ({
  dataType: one(dataTypesTable, {
    fields: [customFieldsTable.dataTypeId],
    references: [dataTypesTable.id],
  }),
  forms: many(customFormFieldsTable),
  values: many(customFieldValuesTable),
}));

export const customFormsRelations = relations(customFormsTable, ({ many }) => ({
  fields: many(customFormFieldsTable),
  pageLinks: many(pageCustomFormsTable),
}));

export const customFormFieldsRelations = relations(customFormFieldsTable, ({ one }) => ({
  form: one(customFormsTable, {
    fields: [customFormFieldsTable.formId],
    references: [customFormsTable.id],
  }),
  field: one(customFieldsTable, {
    fields: [customFormFieldsTable.fieldId],
    references: [customFieldsTable.id],
  }),
}));

export const pageCustomFormsRelations = relations(pageCustomFormsTable, ({ one }) => ({
  form: one(customFormsTable, {
    fields: [pageCustomFormsTable.formId],
    references: [customFormsTable.id],
  }),
}));

export const customFieldValuesRelations = relations(customFieldValuesTable, ({ one }) => ({
  field: one(customFieldsTable, {
    fields: [customFieldValuesTable.fieldId],
    references: [customFieldsTable.id],
  }),
}));

export type DataType = typeof dataTypesTable.$inferSelect;
export type CustomField = typeof customFieldsTable.$inferSelect;
export type CustomForm = typeof customFormsTable.$inferSelect;
export type CustomFormField = typeof customFormFieldsTable.$inferSelect;
export type PageCustomForm = typeof pageCustomFormsTable.$inferSelect;
export type CustomFieldValue = typeof customFieldValuesTable.$inferSelect;

/*
Schema push:
pnpm --filter @workspace/db push

Example query: load a form + fields + current values for a specific page/entity
import { and, eq } from "drizzle-orm";

const rows = await db
  .select({
    formId: customFormsTable.id,
    formName: customFormsTable.name,
    formSlug: customFormsTable.slug,
    fieldId: customFieldsTable.id,
    fieldName: customFieldsTable.name,
    fieldSlug: customFieldsTable.slug,
    dataType: dataTypesTable.slug,
    isRequired: customFormFieldsTable.isRequired,
    sortOrder: customFormFieldsTable.sortOrder,
    value: customFieldValuesTable.value,
  })
  .from(pageCustomFormsTable)
  .innerJoin(customFormsTable, eq(customFormsTable.id, pageCustomFormsTable.formId))
  .innerJoin(customFormFieldsTable, eq(customFormFieldsTable.formId, customFormsTable.id))
  .innerJoin(customFieldsTable, eq(customFieldsTable.id, customFormFieldsTable.fieldId))
  .innerJoin(dataTypesTable, eq(dataTypesTable.id, customFieldsTable.dataTypeId))
  .leftJoin(
    customFieldValuesTable,
    and(
      eq(customFieldValuesTable.entityType, pageCustomFormsTable.entityType),
      eq(customFieldValuesTable.entityId, pageCustomFormsTable.pageId),
      eq(customFieldValuesTable.fieldId, customFieldsTable.id),
    ),
  )
  .where(
    and(
      eq(pageCustomFormsTable.entityType, "page"),
      eq(pageCustomFormsTable.pageId, "dashboard"),
    ),
  )
  .orderBy(pageCustomFormsTable.sortOrder, customFormFieldsTable.sortOrder);

Example insert: save a custom field value
await db.insert(customFieldValuesTable).values({
  entityType: "work_order",
  entityId: "wo_1002",
  fieldId: 12,
  value: { notes: "QA hold until spec update is approved." },
});
*/
