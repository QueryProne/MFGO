import { useEffect, useMemo, useState } from "react";
import { Link2, Plus, Search, Trash2 } from "lucide-react";
import { useLocation } from "wouter";

import { PageHeader } from "@/components/ui-patterns";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  useAddFieldToFormMutation,
  useAttachCustomFormToEntityMutation,
  useCreateCustomFormSavedSearchMutation,
  useCreateCustomFieldMutation,
  useCreateCustomFormMutation,
  useCustomFormDetail,
  useCustomFormSavedSearches,
  useCustomDataTypes,
  useCustomFields,
  useCustomForms,
  useCustomPages,
  useDeleteCustomFormSavedSearchMutation,
  useDeleteCustomFieldMutation,
  useDeleteCustomFormMutation,
  useDetachCustomFormFromEntityMutation,
  useEntityCustomForms,
  useRemoveFieldFromFormMutation,
  useRunCustomFormSavedSearchMutation,
  useSaveEntityCustomValuesMutation,
  useUpdateCustomFormSavedSearchMutation,
} from "@/hooks/use-shared-workflows";
import { CustomFormsPanel } from "@/components/custom/custom-forms-panel";

type FieldSourceTag = {
  key: string;
  label: string;
};

function extractFieldSourceTags(settings?: Record<string, unknown>): FieldSourceTag[] {
  const sourceValues: string[] = [];
  const settingsRecord = settings ?? {};

  const addString = (value: unknown) => {
    if (typeof value === "string" && value.trim()) {
      sourceValues.push(value.trim());
    }
  };
  const addStringArray = (value: unknown) => {
    if (!Array.isArray(value)) return;
    for (const item of value) {
      if (typeof item === "string" && item.trim()) {
        sourceValues.push(item.trim());
      }
    }
  };

  addString(settingsRecord.entityType);
  addStringArray(settingsRecord.entityTypes);
  addString(settingsRecord.table);
  addStringArray(settingsRecord.tables);
  addString(settingsRecord.sourceTable);
  addStringArray(settingsRecord.sourceTables);
  addString(settingsRecord.module);

  if (!sourceValues.length) {
    return [{ key: "global", label: "Global / Any Table" }];
  }

  const byKey = new Map<string, FieldSourceTag>();
  for (const source of sourceValues) {
    const key = source.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
    if (!key) continue;
    const display = source
      .replace(/[_-]+/g, " ")
      .trim()
      .split(/\s+/)
      .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
      .join(" ");
    byKey.set(key, { key, label: display || source });
  }

  return Array.from(byKey.values());
}

const ENTITY_TYPE_OPTIONS = [
  { value: "page", label: "Page" },
  { value: "customer", label: "Customer" },
  { value: "vendor", label: "Vendor" },
  { value: "item", label: "Item" },
  { value: "workorder", label: "Work Order" },
  { value: "production_order", label: "Production Order" },
  { value: "salesorder", label: "Sales Order" },
  { value: "purchaseorder", label: "Purchase Order" },
  { value: "lead", label: "Lead" },
  { value: "opportunity", label: "Opportunity" },
];

function parseActiveFormFromLocation(location: string): number | null {
  const query = location.split("?")[1] ?? "";
  const params = new URLSearchParams(query);
  const value = params.get("formId");
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

function toEditableValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return "";
  }
}

export function CustomFormsAdminContent({ embedded = false }: { embedded?: boolean }) {
  const [location, navigate] = useLocation();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"builder" | "saved-searches">("builder");
  const { data: dataTypesData } = useCustomDataTypes({ limit: 400 });
  const { data: fieldsData } = useCustomFields({ limit: 500 });
  const { data: formsData } = useCustomForms({ limit: 300 });
  const { data: pagesData } = useCustomPages({ isActive: true, limit: 300 });

  const createField = useCreateCustomFieldMutation();
  const deleteField = useDeleteCustomFieldMutation();

  const createForm = useCreateCustomFormMutation();
  const deleteForm = useDeleteCustomFormMutation();
  const addFieldToForm = useAddFieldToFormMutation();
  const removeFieldFromForm = useRemoveFieldFromFormMutation();
  const createSavedSearch = useCreateCustomFormSavedSearchMutation();
  const updateSavedSearch = useUpdateCustomFormSavedSearchMutation();
  const deleteSavedSearch = useDeleteCustomFormSavedSearchMutation();
  const runSavedSearch = useRunCustomFormSavedSearchMutation();
  const saveEntityValues = useSaveEntityCustomValuesMutation();

  const attachForm = useAttachCustomFormToEntityMutation();
  const detachForm = useDetachCustomFormFromEntityMutation();

  const dataTypes = dataTypesData?.data ?? [];
  const fields = fieldsData?.data ?? [];
  const forms = formsData?.data ?? [];
  const pages = pagesData?.data ?? [];

  const [fieldName, setFieldName] = useState("");
  const [fieldLabel, setFieldLabel] = useState("");
  const [fieldDataTypeId, setFieldDataTypeId] = useState("");
  const [fieldIsRequired, setFieldIsRequired] = useState(false);
  const [fieldOptions, setFieldOptions] = useState("");

  const [formName, setFormName] = useState("");
  const [formSlug, setFormSlug] = useState("");
  const [activeFormId, setActiveFormId] = useState<number | null>(null);
  const [fieldSourceFilter, setFieldSourceFilter] = useState("all");
  const [selectedFieldId, setSelectedFieldId] = useState("");
  const [formFieldSection, setFormFieldSection] = useState("");
  const [formFieldSortOrder, setFormFieldSortOrder] = useState("0");

  const [attachEntityType, setAttachEntityType] = useState("customer");
  const [attachEntityId, setAttachEntityId] = useState("");
  const [attachFormId, setAttachFormId] = useState("");

  const [savedSearchName, setSavedSearchName] = useState("");
  const [savedSearchEntityType, setSavedSearchEntityType] = useState("customer");
  const [savedSearchQueryText, setSavedSearchQueryText] = useState("");
  const [savedSearchColumnsInput, setSavedSearchColumnsInput] = useState("");
  const [activeSavedSearchId, setActiveSavedSearchId] = useState<number | null>(null);
  const [searchRunRows, setSearchRunRows] = useState<
    Array<{
      id: number;
      entityType: string;
      entityId: string;
      fieldId: number;
      value: unknown;
      updatedAt: string;
      fieldName?: string | null;
      fieldSlug?: string | null;
      fieldLabel?: string | null;
      dataTypeSlug?: string | null;
    }>
  >([]);
  const [searchRowDrafts, setSearchRowDrafts] = useState<Record<number, string>>({});

  const formIdFromLocation = useMemo(() => parseActiveFormFromLocation(location), [location]);

  useEffect(() => {
    if (formIdFromLocation) {
      setActiveFormId(formIdFromLocation);
    }
  }, [formIdFromLocation]);

  useEffect(() => {
    if (!activeFormId && forms.length > 0) {
      setActiveFormId(forms[0].id);
    }
  }, [activeFormId, forms]);

  useEffect(() => {
    if (dataTypes.length === 0) {
      if (fieldDataTypeId) setFieldDataTypeId("");
      return;
    }
    const exists = dataTypes.some((type) => String(type.id) === fieldDataTypeId);
    if (!exists) {
      setFieldDataTypeId(String(dataTypes[0].id));
    }
  }, [dataTypes, fieldDataTypeId]);

  const activeForm = useMemo(
    () => forms.find((form) => form.id === activeFormId) ?? null,
    [forms, activeFormId],
  );
  const { data: activeFormDetailData } = useCustomFormDetail(activeFormId ?? undefined);
  const { data: formSavedSearchesData } = useCustomFormSavedSearches(activeFormId ?? undefined);
  const formSavedSearches = useMemo(() => formSavedSearchesData?.data ?? [], [formSavedSearchesData?.data]);
  const formApplications = activeFormDetailData?.applications ?? [];

  const fieldsGroupedByType = useMemo(() => {
    const groups = new Map<string, typeof fields>();
    for (const field of fields) {
      const key = field.dataTypeSlug || `type-${field.dataTypeId}`;
      const list = groups.get(key) ?? [];
      list.push(field);
      groups.set(key, list);
    }
    return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [fields]);
  const fieldSourcesById = useMemo(() => {
    const map = new Map<number, FieldSourceTag[]>();
    for (const field of fields) {
      map.set(field.id, extractFieldSourceTags(field.settings));
    }
    return map;
  }, [fields]);
  const fieldSourceOptions = useMemo(() => {
    const counts = new Map<string, { label: string; count: number }>();
    for (const field of fields) {
      const tags = fieldSourcesById.get(field.id) ?? [{ key: "global", label: "Global / Any Table" }];
      for (const tag of tags) {
        const existing = counts.get(tag.key);
        if (existing) {
          existing.count += 1;
        } else {
          counts.set(tag.key, { label: tag.label, count: 1 });
        }
      }
    }
    const dynamicOptions = Array.from(counts.entries())
      .map(([key, value]) => ({ key, label: value.label, count: value.count }))
      .sort((a, b) => a.label.localeCompare(b.label));
    return [{ key: "all", label: "All Sources", count: fields.length }, ...dynamicOptions];
  }, [fieldSourcesById, fields]);
  const selectableFields = useMemo(() => {
    const filtered = fields.filter((field) => {
      if (fieldSourceFilter === "all") return true;
      const tags = fieldSourcesById.get(field.id) ?? [];
      return tags.some((tag) => tag.key === fieldSourceFilter);
    });
    return filtered.sort((a, b) => (a.label || a.name).localeCompare(b.label || b.name));
  }, [fields, fieldSourceFilter, fieldSourcesById]);

  useEffect(() => {
    if (!selectedFieldId) return;
    const existsInList = selectableFields.some((field) => String(field.id) === selectedFieldId);
    if (!existsInList) {
      setSelectedFieldId("");
    }
  }, [selectedFieldId, selectableFields]);
  const totalFormFields = useMemo(
    () => forms.reduce((sum, form) => sum + (form.fields?.length ?? 0), 0),
    [forms],
  );

  useEffect(() => {
    if (!activeFormId) return;
    setAttachFormId(String(activeFormId));
  }, [activeFormId]);

  useEffect(() => {
    if (attachEntityType !== "page") return;
    if (pages.length === 0) {
      if (attachEntityId) setAttachEntityId("");
      return;
    }
    const exists = pages.some((page) => page.pageId === attachEntityId);
    if (!exists) {
      setAttachEntityId(pages[0].pageId);
    }
  }, [attachEntityId, attachEntityType, pages]);

  useEffect(() => {
    if (!formSavedSearches.length) {
      if (activeSavedSearchId !== null) {
        setActiveSavedSearchId(null);
      }
      setSearchRunRows((current) => (current.length === 0 ? current : []));
      setSearchRowDrafts((current) => (Object.keys(current).length === 0 ? current : {}));
      return;
    }
    if (!activeSavedSearchId || !formSavedSearches.some((row) => row.id === activeSavedSearchId)) {
      setActiveSavedSearchId(formSavedSearches[0].id);
    }
  }, [activeSavedSearchId, formSavedSearches]);

  const hasAttachTarget = Boolean(attachEntityType && attachEntityId);
  const { data: attachedFormsData } = useEntityCustomForms(attachEntityType, attachEntityId, true);
  const attachedForms = attachedFormsData?.data ?? [];

  const parseOptions = (): Array<Record<string, unknown>> | undefined => {
    if (!fieldOptions.trim()) return undefined;
    try {
      const parsed = JSON.parse(fieldOptions);
      if (!Array.isArray(parsed)) {
        toast({
          title: "Field options must be an array",
          description: "Use JSON like [{\"label\":\"A\",\"value\":\"a\"}]",
          variant: "destructive",
        });
        return undefined;
      }
      return parsed as Array<Record<string, unknown>>;
    } catch {
      toast({
        title: "Invalid JSON",
        description: "Options JSON could not be parsed.",
        variant: "destructive",
      });
      return undefined;
    }
  };

  const setDesignerForm = (formId: number | null) => {
    setActiveFormId(formId);
    const params = new URLSearchParams(location.split("?")[1] ?? "");
    params.set("tab", "custom-forms");
    if (formId) {
      params.set("formId", String(formId));
    } else {
      params.delete("formId");
    }
    navigate(`/admin?${params.toString()}`);
  };

  const activeSavedSearch = useMemo(
    () => formSavedSearches.find((row) => row.id === activeSavedSearchId) ?? null,
    [formSavedSearches, activeSavedSearchId],
  );

  useEffect(() => {
    if (!activeSavedSearch) return;
    setSavedSearchName(activeSavedSearch.name);
    setSavedSearchEntityType(activeSavedSearch.entityType);
    setSavedSearchQueryText(activeSavedSearch.queryText ?? "");
    setSavedSearchColumnsInput((activeSavedSearch.columns ?? []).join(", "));
  }, [activeSavedSearch]);

  const parseSavedSearchColumns = (value: string): number[] =>
    value
      .split(",")
      .map((entry) => Number.parseInt(entry.trim(), 10))
      .filter((entry) => Number.isInteger(entry) && entry > 0);

  const parseRowValue = (value: string, dataTypeSlug?: string | null): unknown => {
    const raw = value.trim();
    if (!raw) return null;
    if (dataTypeSlug === "number" || dataTypeSlug === "decimal" || dataTypeSlug === "currency" || dataTypeSlug === "percent") {
      const parsed = Number(raw);
      return Number.isNaN(parsed) ? raw : parsed;
    }
    if (dataTypeSlug === "boolean") {
      const lowered = raw.toLowerCase();
      if (lowered === "true") return true;
      if (lowered === "false") return false;
      return raw;
    }
    if (dataTypeSlug === "json") {
      try {
        return JSON.parse(raw);
      } catch {
        return raw;
      }
    }
    return raw;
  };

  return (
    <div className={embedded ? "space-y-6" : "p-6 md:p-8 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500"}>
      {!embedded ? (
        <PageHeader
          title="Custom Forms Administration"
          description="Manage custom fields, reusable forms, and attach forms to ERP entities. Standard data types are backend-managed."
        />
      ) : null}

      <Card className="border-border/50 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-display">Form Registry</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md border border-border/60 bg-secondary/20 px-2 py-1 text-xs">
              Total Forms: {forms.length}
            </span>
            <span className="rounded-md border border-border/60 bg-secondary/20 px-2 py-1 text-xs">
              Total Linked Fields: {totalFormFields}
            </span>
          </div>
          {forms.length === 0 ? (
            <p className="text-sm text-muted-foreground">No forms created yet.</p>
          ) : (
            <div className="space-y-2 max-h-[240px] overflow-auto pr-1">
              {forms.map((form) => (
                <div key={form.id} className="flex items-center justify-between rounded-md border border-border/60 bg-secondary/20 px-3 py-2">
                  <div className="space-y-0.5">
                    <p className="text-sm font-medium">{form.name}</p>
                    <p className="text-xs text-muted-foreground">
                      #{form.id} - {form.slug} - {(form.fields?.length ?? 0)} fields
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={() => setDesignerForm(form.id)}
                  >
                    Open Designer
                  </Button>
                </div>
              ))}
            </div>
          )}
          <a href="#forms-output" className="inline-flex text-sm text-primary hover:underline">
            Open full form configurator output
          </a>
        </CardContent>
      </Card>

      <Tabs
        value={activeTab}
        onValueChange={(value) => setActiveTab(value === "saved-searches" ? "saved-searches" : "builder")}
        className="w-full"
      >
        <TabsList className="grid w-full max-w-md grid-cols-2 bg-secondary/50 p-1 rounded-lg">
          <TabsTrigger value="builder">Builder</TabsTrigger>
          <TabsTrigger value="saved-searches">Saved Searches</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {activeTab === "builder" ? (
        <Card className="border-border/50 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-display">Custom Fields</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <Input
                value={fieldName}
                onChange={(event) => setFieldName(event.target.value)}
                placeholder="Field name"
                className="bg-background"
              />
              <Input
                value={fieldLabel}
                onChange={(event) => setFieldLabel(event.target.value)}
                placeholder="Field label (optional)"
                className="bg-background"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-2">
              <Select value={fieldDataTypeId} onValueChange={setFieldDataTypeId}>
                <SelectTrigger className="bg-background">
                  <SelectValue placeholder="Select data type" />
                </SelectTrigger>
                <SelectContent>
                  {dataTypes.map((type) => (
                    <SelectItem key={type.id} value={String(type.id)}>
                      {type.name} ({type.slug})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex items-center justify-between rounded-md border border-border/50 px-3 py-2">
                <span className="text-sm text-muted-foreground">Required</span>
                <Switch checked={fieldIsRequired} onCheckedChange={setFieldIsRequired} />
              </div>
            </div>
            <Textarea
              value={fieldOptions}
              onChange={(event) => setFieldOptions(event.target.value)}
              className="bg-background min-h-[88px] font-mono text-xs"
              placeholder='Options JSON (optional): [{"label":"High","value":"high"}]'
            />
            <Button
              className="gap-2"
              disabled={!fieldName.trim() || !fieldDataTypeId || createField.isPending || dataTypes.length === 0}
              onClick={() => {
                const options = parseOptions();
                if (fieldOptions.trim() && !options) return;
                createField.mutate(
                  {
                    name: fieldName.trim(),
                    label: fieldLabel.trim() || undefined,
                    dataTypeId: Number(fieldDataTypeId),
                    isRequired: fieldIsRequired,
                    options,
                  },
                  {
                    onSuccess: () => {
                      setFieldName("");
                      setFieldLabel("");
                      setFieldDataTypeId("");
                      setFieldIsRequired(false);
                      setFieldOptions("");
                    },
                  },
                );
              }}
            >
              <Plus className="w-4 h-4" />
              Create Field
            </Button>

            {dataTypes.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No data types available yet.
              </p>
            ) : null}

            <div className="space-y-2 max-h-[280px] overflow-auto pr-1">
              {fieldsGroupedByType.map(([typeKey, typeFields]) => (
                <div key={typeKey} className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/90">
                    {typeKey}
                  </p>
                  {typeFields.map((field) => (
                    <div
                      key={field.id}
                      id={`field-${field.id}`}
                      className="flex items-center justify-between rounded-lg border border-border/50 bg-secondary/20 px-3 py-2"
                    >
                      <div>
                        <p className="text-sm font-medium">{field.label || field.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {field.slug} - {field.dataTypeSlug || field.dataTypeId}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        onClick={() => deleteField.mutate(field.id)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              ))}
              {fields.length === 0 ? <p className="text-sm text-muted-foreground">No custom fields yet.</p> : null}
            </div>
          </CardContent>
        </Card>
        ) : null}

        {activeTab === "builder" ? (
        <Card className="border-border/50 shadow-sm xl:col-span-2" id="forms-output">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-display">Reusable Forms</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-2">
              <Input
                value={formName}
                onChange={(event) => setFormName(event.target.value)}
                placeholder="Form name"
                className="bg-background"
              />
              <Input
                value={formSlug}
                onChange={(event) => setFormSlug(event.target.value)}
                placeholder="Form slug (optional)"
                className="bg-background"
              />
              <Button
                className="gap-2"
                disabled={!formName.trim() || createForm.isPending}
                onClick={() => {
                  createForm.mutate(
                    { name: formName.trim(), slug: formSlug.trim() || undefined },
                    {
                      onSuccess: () => {
                        setFormName("");
                        setFormSlug("");
                      },
                    },
                  );
                }}
              >
                <Plus className="w-4 h-4" />
                Create Form
              </Button>
            </div>

            <div className="rounded-lg border border-border/50 bg-secondary/20 p-3 space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-[220px_1fr_160px_1fr] gap-2">
                <Select
                  value={activeFormId ? String(activeFormId) : ""}
                  onValueChange={(next) => setDesignerForm(next ? Number.parseInt(next, 10) : null)}
                >
                  <SelectTrigger className="bg-background">
                    <SelectValue placeholder="Select form to design" />
                  </SelectTrigger>
                  <SelectContent>
                    {forms.map((form) => (
                      <SelectItem key={form.id} value={String(form.id)}>
                        #{form.id} {form.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  value={formFieldSection}
                  onChange={(event) => setFormFieldSection(event.target.value)}
                  placeholder="Section override (optional)"
                  className="bg-background"
                />
                <Input
                  value={formFieldSortOrder}
                  onChange={(event) => setFormFieldSortOrder(event.target.value)}
                  placeholder="Sort order"
                  className="bg-background"
                />
                <Select value={fieldSourceFilter} onValueChange={setFieldSourceFilter}>
                  <SelectTrigger className="bg-background">
                    <SelectValue placeholder="Filter by field source" />
                  </SelectTrigger>
                  <SelectContent>
                    {fieldSourceOptions.map((option) => (
                      <SelectItem key={option.key} value={option.key}>
                        {option.label} ({option.count})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {activeForm ? (
                <div className="rounded-md border border-border/60 bg-background/70 px-3 py-2">
                  <p className="text-sm font-medium">
                    Designer: {activeForm.name} <span className="text-muted-foreground">({activeForm.slug})</span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Form ID {activeForm.id} - {(activeFormDetailData?.form.fields?.length ?? activeForm.fields?.length ?? 0)} mapped fields
                  </p>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">Select a form to continue building the raw form layout.</p>
              )}
              <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-2">
                <Select value={selectedFieldId} onValueChange={setSelectedFieldId}>
                  <SelectTrigger className="bg-background">
                    <SelectValue placeholder="Select available field" />
                  </SelectTrigger>
                  <SelectContent>
                    {selectableFields.map((field) => (
                      <SelectItem key={field.id} value={String(field.id)}>
                        {(field.label || field.name) + " - " + (field.dataTypeSlug || field.dataTypeId)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  size="sm"
                  className="gap-2"
                  disabled={!activeForm || !selectedFieldId || addFieldToForm.isPending}
                  onClick={() => {
                    if (!activeForm) return;
                    const parsedFieldId = Number.parseInt(selectedFieldId, 10);
                    if (Number.isNaN(parsedFieldId)) {
                      toast({
                        title: "Invalid field selection",
                        description: "Select a valid field from the dropdown.",
                        variant: "destructive",
                      });
                      return;
                    }
                    const parsedSort = Number.parseInt(formFieldSortOrder || "0", 10);
                    addFieldToForm.mutate({
                      formId: activeForm.id,
                      fieldId: parsedFieldId,
                      section: formFieldSection.trim() || undefined,
                      sortOrder: Number.isNaN(parsedSort) ? 0 : parsedSort,
                    });
                  }}
                >
                  <Link2 className="w-3.5 h-3.5" />
                  Add To Form
                </Button>
              </div>
              {selectableFields.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  No fields available for this source yet. As canned fields grow by table/module, they will appear here automatically.
                </p>
              ) : null}
            </div>

            <div className="space-y-3">
              {forms.map((form) => (
                <div key={form.id} id={`form-${form.id}`} className="rounded-lg border border-border/50 bg-secondary/20 p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold">{form.name}</p>
                      <p className="text-xs text-muted-foreground">{form.slug} - {form.fields?.length ?? 0} fields</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={() => setDesignerForm(form.id)}
                      >
                        Manage
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        onClick={() => deleteForm.mutate(form.id)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-1">
                    {(form.fields ?? []).map((field) => (
                      <div
                        key={field.mappingId ?? `${form.id}-${field.fieldId}`}
                        className="flex items-center justify-between rounded-md border border-border/50 bg-background/70 px-3 py-2"
                      >
                        <div>
                          <span className="text-sm">{field.fieldLabel || field.fieldName || field.fieldSlug}</span>
                          <p className="text-xs text-muted-foreground">
                            {field.dataTypeSlug || "unknown"} - section {field.section || "default"} - sort {field.sortOrder ?? 0}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          onClick={() => {
                            if (!field.mappingId) return;
                            removeFieldFromForm.mutate({ formId: form.id, mappingId: field.mappingId });
                          }}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    ))}
                    {(form.fields?.length ?? 0) === 0 ? <p className="text-xs text-muted-foreground">No fields linked yet.</p> : null}
                  </div>
                </div>
              ))}
              {forms.length === 0 ? <p className="text-sm text-muted-foreground">No forms yet. Create one above.</p> : null}
            </div>
          </CardContent>
        </Card>
        ) : null}

        {activeTab === "saved-searches" ? (
        <Card className="border-border/50 shadow-sm xl:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-display">Saved Searches (Form Answers)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!activeForm ? (
              <p className="text-sm text-muted-foreground">Select a form in the designer to manage answer searches.</p>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-[1fr_180px] gap-2">
                  <Input
                    value={savedSearchName}
                    onChange={(event) => setSavedSearchName(event.target.value)}
                    placeholder="Search name (e.g. Open QA Flags)"
                    className="bg-background"
                  />
                  <Input
                    value={savedSearchEntityType}
                    onChange={(event) => setSavedSearchEntityType(event.target.value)}
                    placeholder="Entity type"
                    className="bg-background"
                  />
                </div>
                <Input
                  value={savedSearchColumnsInput}
                  onChange={(event) => setSavedSearchColumnsInput(event.target.value)}
                  placeholder="Field IDs to show (comma-separated). Leave blank = all form fields."
                  className="bg-background"
                />
                <Textarea
                  value={savedSearchQueryText}
                  onChange={(event) => setSavedSearchQueryText(event.target.value)}
                  className="bg-background min-h-[76px]"
                  placeholder="Optional free-text filter (matches entity id, field labels, and values)"
                />

                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    size="sm"
                    className="gap-2"
                    disabled={!savedSearchName.trim() || !savedSearchEntityType.trim() || createSavedSearch.isPending}
                    onClick={() => {
                      if (!activeFormId) return;
                      createSavedSearch.mutate(
                        {
                          formId: activeFormId,
                          name: savedSearchName.trim(),
                          entityType: savedSearchEntityType.trim(),
                          queryText: savedSearchQueryText.trim() || null,
                          columns: parseSavedSearchColumns(savedSearchColumnsInput),
                        },
                        {
                          onSuccess: (created) => {
                            setActiveSavedSearchId(created.id);
                          },
                        },
                      );
                    }}
                  >
                    <Plus className="w-4 h-4" />
                    Create Search
                  </Button>

                  <Select
                    value={activeSavedSearchId ? String(activeSavedSearchId) : ""}
                    onValueChange={(value) => setActiveSavedSearchId(value ? Number.parseInt(value, 10) : null)}
                  >
                    <SelectTrigger className="w-[280px] bg-background">
                      <SelectValue placeholder="Select saved search" />
                    </SelectTrigger>
                    <SelectContent>
                      {formSavedSearches.map((row) => (
                        <SelectItem key={row.id} value={String(row.id)}>
                          #{row.id} {row.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Button
                    size="sm"
                    variant="secondary"
                    className="gap-2"
                    disabled={!activeFormId || !activeSavedSearchId || updateSavedSearch.isPending}
                    onClick={() => {
                      if (!activeFormId || !activeSavedSearchId) return;
                      updateSavedSearch.mutate({
                        formId: activeFormId,
                        searchId: activeSavedSearchId,
                        name: savedSearchName.trim(),
                        entityType: savedSearchEntityType.trim(),
                        queryText: savedSearchQueryText.trim() || null,
                        columns: parseSavedSearchColumns(savedSearchColumnsInput),
                      });
                    }}
                  >
                    Update
                  </Button>

                  <Button
                    size="sm"
                    variant="ghost"
                    className="gap-2 text-destructive hover:text-destructive"
                    disabled={!activeFormId || !activeSavedSearchId || deleteSavedSearch.isPending}
                    onClick={() => {
                      if (!activeFormId || !activeSavedSearchId) return;
                      deleteSavedSearch.mutate({
                        formId: activeFormId,
                        searchId: activeSavedSearchId,
                      });
                    }}
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete
                  </Button>

                  <Button
                    size="sm"
                    className="gap-2"
                    disabled={!activeFormId || !activeSavedSearchId || runSavedSearch.isPending}
                    onClick={() => {
                      if (!activeFormId || !activeSavedSearchId) return;
                      runSavedSearch.mutate(
                        {
                          formId: activeFormId,
                          searchId: activeSavedSearchId,
                        },
                        {
                          onSuccess: (result) => {
                            setSearchRunRows(result.rows);
                            setSearchRowDrafts(
                              Object.fromEntries(result.rows.map((row) => [row.id, toEditableValue(row.value)])),
                            );
                          },
                        },
                      );
                    }}
                  >
                    <Search className="w-4 h-4" />
                    Run Search
                  </Button>
                </div>

                {searchRunRows.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Run a saved search to view editable answer rows.</p>
                ) : (
                  <div className="space-y-2 max-h-[320px] overflow-auto pr-1">
                    {searchRunRows.map((row) => (
                      <div key={row.id} className="rounded-md border border-border/60 bg-background/70 p-3 space-y-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-xs text-muted-foreground">
                            {row.entityType}:{row.entityId} - {row.fieldLabel || row.fieldName || row.fieldSlug || `Field ${row.fieldId}`}
                          </p>
                          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{row.dataTypeSlug || "text"}</span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-2">
                          <Input
                            value={searchRowDrafts[row.id] ?? ""}
                            onChange={(event) =>
                              setSearchRowDrafts((current) => ({ ...current, [row.id]: event.target.value }))
                            }
                            className="bg-background"
                          />
                          <Button
                            size="sm"
                            disabled={saveEntityValues.isPending}
                            onClick={() => {
                              const nextRaw = searchRowDrafts[row.id] ?? "";
                              const parsedValue = parseRowValue(nextRaw, row.dataTypeSlug);
                              saveEntityValues.mutate({
                                entityType: row.entityType,
                                entityId: row.entityId,
                                values: [{ fieldId: row.fieldId, value: parsedValue }],
                              });
                            }}
                          >
                            Save Value
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
        ) : null}

        {activeTab === "builder" ? (
        <Card className="border-border/50 shadow-sm xl:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-display">Apply Form To Page / Entity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {activeForm ? (
              <p className="text-xs text-muted-foreground">
                Active designer form: <span className="text-foreground font-medium">{activeForm.name}</span> (ID {activeForm.id})
              </p>
            ) : null}

            <div className="grid grid-cols-1 md:grid-cols-[200px_1fr_240px_auto] gap-2">
              <Select value={attachEntityType} onValueChange={setAttachEntityType}>
                <SelectTrigger className="bg-background">
                  <SelectValue placeholder="Select entity type" />
                </SelectTrigger>
                <SelectContent>
                  {ENTITY_TYPE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {attachEntityType === "page" ? (
                <Select value={attachEntityId} onValueChange={setAttachEntityId}>
                  <SelectTrigger className="bg-background">
                    <SelectValue placeholder="Select page ID" />
                  </SelectTrigger>
                  <SelectContent>
                    {pages.map((page) => (
                      <SelectItem key={page.id} value={page.pageId}>
                        {page.title} ({page.pageId})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  value={attachEntityId}
                  onChange={(event) => setAttachEntityId(event.target.value)}
                  placeholder="Entity ID"
                  className="bg-background"
                />
              )}

              <Select value={attachFormId} onValueChange={setAttachFormId}>
                <SelectTrigger className="bg-background">
                  <SelectValue placeholder="Select form" />
                </SelectTrigger>
                <SelectContent>
                  {forms.map((form) => (
                    <SelectItem key={form.id} value={String(form.id)}>
                      #{form.id} {form.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                className="gap-2"
                disabled={!hasAttachTarget || !attachFormId || attachForm.isPending}
                onClick={() => {
                  const parsedFormId = Number.parseInt(attachFormId, 10);
                  if (Number.isNaN(parsedFormId)) {
                    toast({ title: "Invalid Form ID", description: "Use a numeric form ID.", variant: "destructive" });
                    return;
                  }
                  attachForm.mutate({
                    entityType: attachEntityType,
                    entityId: attachEntityId,
                    formId: parsedFormId,
                    sortOrder: attachedForms.length,
                  });
                }}
              >
                <Link2 className="w-4 h-4" />
                Apply To Page
              </Button>
            </div>
            {attachEntityType === "page" ? (
              <p className="text-xs text-muted-foreground">
                Available page IDs: {pages.length}. Choose a page ID to attach the selected form.
              </p>
            ) : null}

            {!hasAttachTarget ? (
              <p className="text-sm text-muted-foreground">Enter entity type and entity ID to manage attachments.</p>
            ) : (
              <div className="space-y-2">
                {attachedForms.map((link) => (
                  <div key={link.linkId} className="flex items-center justify-between rounded-lg border border-border/50 bg-secondary/20 px-3 py-2">
                    <div>
                      <p className="text-sm font-medium">{link.formName || link.formSlug}</p>
                      <p className="text-xs text-muted-foreground">Link #{link.linkId} - Sort {link.sortOrder}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      onClick={() =>
                        detachForm.mutate({
                          entityType: attachEntityType,
                          entityId: attachEntityId,
                          linkId: link.linkId,
                        })
                      }
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                ))}
                {attachedForms.length === 0 ? <p className="text-sm text-muted-foreground">No forms attached for this entity.</p> : null}
              </div>
            )}

            {activeForm ? (
              <div className="rounded-lg border border-border/50 bg-secondary/20 p-3 space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Current Form Applications</p>
                {formApplications.length === 0 ? (
                  <p className="text-sm text-muted-foreground">This form has not been applied to any entity yet.</p>
                ) : (
                  <div className="space-y-2">
                    {formApplications.map((application) => (
                      <div
                        key={application.linkId}
                        className="flex items-center justify-between rounded-md border border-border/60 bg-background/70 px-3 py-2"
                      >
                        <p className="text-sm">
                          {application.entityType === "page"
                            ? `${application.pageTitle || application.pageId || application.entityId} (${application.pageId || application.entityId})`
                            : `${application.entityType}:${application.entityId}`}
                        </p>
                        <p className="text-xs text-muted-foreground">Sort {application.sortOrder}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : null}
          </CardContent>
        </Card>
        ) : null}
      </div>

      {activeTab === "builder" && hasAttachTarget ? (
        <CustomFormsPanel
          entityType={attachEntityType}
          entityId={attachEntityId}
          title={`Custom Field Values Preview (${attachEntityType}:${attachEntityId})`}
        />
      ) : null}
    </div>
  );
}

export default function CustomFormsAdminPage() {
  return <CustomFormsAdminContent />;
}

