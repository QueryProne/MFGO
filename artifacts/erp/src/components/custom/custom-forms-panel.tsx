import { useMemo, useState } from "react";
import { Save } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useEntityCustomForms, useSaveEntityCustomValuesMutation } from "@/hooks/use-shared-workflows";
import { useToast } from "@/hooks/use-toast";
import type { CustomFormFieldView } from "@/lib/api";

type Option = { label: string; value: string };

function parseOptions(value: unknown): Option[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => {
      if (typeof entry === "string" || typeof entry === "number") {
        const val = String(entry);
        return { label: val, value: val };
      }
      if (entry && typeof entry === "object") {
        const row = entry as Record<string, unknown>;
        const valueStr = row.value != null ? String(row.value) : row.id != null ? String(row.id) : "";
        const labelStr = row.label != null ? String(row.label) : row.name != null ? String(row.name) : valueStr;
        if (valueStr) return { label: labelStr, value: valueStr };
      }
      return null;
    })
    .filter((entry): entry is Option => entry !== null);
}

function asInputValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return "";
  }
}

function normalizeForSave(field: CustomFormFieldView, raw: unknown): { ok: true; value: unknown } | { ok: false; error: string } {
  const dataType = field.dataTypeSlug ?? "text";

  if (dataType === "number") {
    if (raw === "" || raw === null || raw === undefined) return { ok: true, value: null };
    const parsed = Number(raw);
    if (Number.isNaN(parsed)) return { ok: false, error: "Must be a valid number." };
    return { ok: true, value: parsed };
  }

  if (dataType === "json") {
    if (raw === "" || raw === null || raw === undefined) return { ok: true, value: null };
    if (typeof raw !== "string") return { ok: true, value: raw };
    try {
      return { ok: true, value: JSON.parse(raw) };
    } catch {
      return { ok: false, error: "Invalid JSON format." };
    }
  }

  if (dataType === "multi_select") {
    if (Array.isArray(raw)) return { ok: true, value: raw };
    if (typeof raw === "string") {
      const parts = raw
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean);
      return { ok: true, value: parts };
    }
    return { ok: true, value: [] };
  }

  if (dataType === "boolean") {
    return { ok: true, value: Boolean(raw) };
  }

  if (typeof raw === "string") {
    return { ok: true, value: raw.trim() === "" ? null : raw };
  }
  return { ok: true, value: raw };
}

function FieldEditor({
  field,
  value,
  onChange,
  error,
}: {
  field: CustomFormFieldView;
  value: unknown;
  onChange: (nextValue: unknown) => void;
  error?: string;
}) {
  const dataType = field.dataTypeSlug ?? "text";
  const options = parseOptions(field.fieldOptions);
  const isRequired = Boolean(field.isRequired ?? field.fieldRequired);

  const label = field.fieldLabel || field.fieldName || field.fieldSlug || `Field ${field.fieldId}`;

  return (
    <div className="space-y-2 rounded-lg border border-border/50 bg-background/60 p-3">
      <div className="flex items-center justify-between gap-2">
        <label className="text-sm font-medium text-foreground">{label}</label>
        {isRequired ? <span className="text-[10px] uppercase tracking-wider text-amber-400">Required</span> : null}
      </div>

      {dataType === "boolean" ? (
        <div className="flex items-center justify-between rounded-md border border-border/60 bg-secondary/20 p-2">
          <span className="text-sm text-muted-foreground">Toggle value</span>
          <Switch checked={Boolean(value)} onCheckedChange={onChange} />
        </div>
      ) : dataType === "number" ? (
        <Input
          type="number"
          value={asInputValue(value)}
          onChange={(event) => onChange(event.target.value)}
          placeholder={field.fieldPlaceholder ?? "Enter number"}
          className="bg-background"
        />
      ) : dataType === "date" ? (
        <Input
          type="date"
          value={asInputValue(value).slice(0, 10)}
          onChange={(event) => onChange(event.target.value)}
          className="bg-background"
        />
      ) : dataType === "select" && options.length > 0 ? (
        <Select
          value={asInputValue(value) || undefined}
          onValueChange={(next) => onChange(next)}
        >
          <SelectTrigger className="bg-background">
            <SelectValue placeholder="Select a value" />
          </SelectTrigger>
          <SelectContent>
            {options.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : dataType === "multi_select" ? (
        <Textarea
          value={Array.isArray(value) ? value.join(", ") : asInputValue(value)}
          onChange={(event) => onChange(event.target.value)}
          className="bg-background min-h-[72px]"
          placeholder="Enter comma-separated values"
        />
      ) : dataType === "json" ? (
        <Textarea
          value={asInputValue(value)}
          onChange={(event) => onChange(event.target.value)}
          className="bg-background min-h-[140px] font-mono text-xs"
          placeholder='{"key":"value"}'
        />
      ) : dataType === "rich_text" ? (
        <Textarea
          value={asInputValue(value)}
          onChange={(event) => onChange(event.target.value)}
          className="bg-background min-h-[140px]"
          placeholder={field.fieldPlaceholder ?? "Enter rich text content"}
        />
      ) : (
        <Input
          value={asInputValue(value)}
          onChange={(event) => onChange(event.target.value)}
          placeholder={field.fieldPlaceholder ?? "Enter value"}
          className="bg-background"
        />
      )}

      {field.fieldHelpText ? <p className="text-xs text-muted-foreground">{field.fieldHelpText}</p> : null}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}

export function CustomFormsPanel({
  entityType,
  entityId,
  title = "Custom Fields",
}: {
  entityType: string;
  entityId: string;
  title?: string;
}) {
  const { toast } = useToast();
  const { data, isLoading } = useEntityCustomForms(entityType, entityId, true);
  const saveValues = useSaveEntityCustomValuesMutation();
  const [draftValues, setDraftValues] = useState<Record<number, unknown>>({});
  const [fieldErrors, setFieldErrors] = useState<Record<number, string>>({});

  const forms = data?.data ?? [];
  const allFields = useMemo(
    () => forms.flatMap((form) => form.fields ?? []),
    [forms],
  );
  const fieldById = useMemo(
    () => new Map(allFields.map((field) => [field.fieldId, field])),
    [allFields],
  );

  const hasDirtyValues = Object.keys(draftValues).length > 0;

  const getFieldValue = (field: CustomFormFieldView) =>
    draftValues[field.fieldId] !== undefined ? draftValues[field.fieldId] : field.value;

  const handleSave = () => {
    if (!hasDirtyValues) return;
    const nextErrors: Record<number, string> = {};
    const values: Array<{ fieldId: number; value: unknown }> = [];

    for (const [fieldIdRaw, raw] of Object.entries(draftValues)) {
      const fieldId = Number(fieldIdRaw);
      const field = fieldById.get(fieldId);
      if (!field) continue;
      const normalized = normalizeForSave(field, raw);
      if (!normalized.ok) {
        nextErrors[fieldId] = normalized.error;
        continue;
      }
      values.push({ fieldId, value: normalized.value });
    }

    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    if (values.length === 0) return;

    saveValues.mutate(
      { entityType, entityId, values },
      {
        onSuccess: () => {
          setDraftValues({});
          toast({
            title: "Custom values saved",
            description: "Field values were updated successfully.",
          });
        },
      },
    );
  };

  return (
    <Card className="border-border/50 shadow-sm">
      <CardHeader className="pb-3 flex-row items-center justify-between">
        <CardTitle className="text-base font-display">{title}</CardTitle>
        <Button
          size="sm"
          className="gap-2"
          disabled={!hasDirtyValues || saveValues.isPending}
          onClick={handleSave}
        >
          <Save className="w-4 h-4" />
          Save Values
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading custom forms...</p>
        ) : forms.length === 0 ? (
          <p className="text-sm text-muted-foreground">No custom forms are attached to this record yet.</p>
        ) : (
          forms.map((form) => (
            <div key={form.linkId} className="space-y-3 rounded-xl border border-border/50 bg-card/40 p-4">
              <div className="space-y-1">
                <h3 className="text-sm font-semibold text-foreground">{form.formName || form.formSlug || `Form ${form.formId}`}</h3>
                <p className="text-xs text-muted-foreground">Form ID: {form.formId}</p>
              </div>
              <div className="space-y-2">
                {(form.fields ?? []).map((field) => (
                  <FieldEditor
                    key={`${form.formId}-${field.fieldId}`}
                    field={field}
                    value={getFieldValue(field)}
                    error={fieldErrors[field.fieldId]}
                    onChange={(nextValue) => {
                      setFieldErrors((current) => {
                        if (!current[field.fieldId]) return current;
                        const copy = { ...current };
                        delete copy[field.fieldId];
                        return copy;
                      });
                      setDraftValues((current) => ({
                        ...current,
                        [field.fieldId]: nextValue,
                      }));
                    }}
                  />
                ))}
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
