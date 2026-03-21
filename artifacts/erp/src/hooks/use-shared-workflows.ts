import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  api,
  AutomationRule,
  Lead,
  Opportunity,
  OpportunityForecast,
  PaginatedResponse,
  SharedEmail,
  Task,
  TimelineEntry,
  CustomDataType,
  CustomAppPage,
  CustomField,
  CustomForm,
  CustomFormDetailResponse,
  CustomSavedSearch,
  CustomSavedSearchRunResponse,
  EntityCustomFormLink,
  CustomValueRow,
} from "@/lib/api";

export function useTasks(params?: {
  search?: string;
  status?: string;
  assigneeId?: string;
  entityType?: string;
  entityId?: string;
  page?: number;
  limit?: number;
}) {
  const query = new URLSearchParams();
  if (params?.search) query.set("search", params.search);
  if (params?.status) query.set("status", params.status);
  if (params?.assigneeId) query.set("assigneeId", params.assigneeId);
  if (params?.entityType) query.set("entityType", params.entityType);
  if (params?.entityId) query.set("entityId", params.entityId);
  if (params?.page) query.set("page", String(params.page));
  if (params?.limit) query.set("limit", String(params.limit));

  return useQuery<PaginatedResponse<Task>>({
    queryKey: ["tasks", params ?? {}],
    queryFn: () => api.get(`/tasks${query.toString() ? `?${query.toString()}` : ""}`),
  });
}

export function useEntityTasks(entityType: string, entityId: string, limit = 100) {
  return useQuery<PaginatedResponse<Task>>({
    queryKey: ["tasks", "entity", entityType, entityId, limit],
    queryFn: () => api.get(`/tasks/entity/${entityType}/${entityId}?limit=${limit}`),
    enabled: Boolean(entityType && entityId),
  });
}

export function useCreateTaskMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: Partial<Task> & { entityType: string; entityId: string; title: string }) => api.post<Task>("/tasks", payload),
    onSuccess: (_, payload) => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["timeline", payload.entityType, payload.entityId] });
    },
  });
}

export function useUpdateTaskMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...payload }: Partial<Task> & { id: string }) => api.patch<Task>(`/tasks/${id}`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["timeline"] });
    },
  });
}

export function useDeleteTaskMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (taskId: string) => api.delete<{ success: boolean }>(`/tasks/${taskId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["timeline"] });
    },
  });
}

export function useEntityEmails(entityType: string, entityId: string, limit = 50) {
  return useQuery<PaginatedResponse<SharedEmail>>({
    queryKey: ["emails", "entity", entityType, entityId, limit],
    queryFn: () => api.get(`/emails/entity/${entityType}/${entityId}?limit=${limit}`),
    enabled: Boolean(entityType && entityId),
  });
}

export function useCreateEmailMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: Record<string, unknown>) => api.post<{ data: SharedEmail }>("/emails", payload),
    onSuccess: (_, payload) => {
      queryClient.invalidateQueries({ queryKey: ["emails"] });
      const entityType = typeof payload.entityType === "string" ? payload.entityType : "";
      const entityId = typeof payload.entityId === "string" ? payload.entityId : "";
      if (entityType && entityId) {
        queryClient.invalidateQueries({ queryKey: ["timeline", entityType, entityId] });
      }
    },
  });
}

export function useSendEmailMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (messageId: string) => api.post<SharedEmail>(`/emails/${messageId}/send`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["emails"] });
      queryClient.invalidateQueries({ queryKey: ["timeline"] });
    },
  });
}

export function useTimeline(entityType: string, entityId: string, limit = 100) {
  return useQuery<PaginatedResponse<TimelineEntry>>({
    queryKey: ["timeline", entityType, entityId, limit],
    queryFn: () => api.get(`/timeline/${entityType}/${entityId}?limit=${limit}`),
    enabled: Boolean(entityType && entityId),
  });
}

export function useLeads(params?: { search?: string; status?: string; page?: number; limit?: number }) {
  const query = new URLSearchParams();
  if (params?.search) query.set("search", params.search);
  if (params?.status) query.set("status", params.status);
  if (params?.page) query.set("page", String(params.page));
  if (params?.limit) query.set("limit", String(params.limit));
  return useQuery<PaginatedResponse<Lead>>({
    queryKey: ["leads", params ?? {}],
    queryFn: () => api.get(`/leads${query.toString() ? `?${query.toString()}` : ""}`),
  });
}

export function useLead(leadId: string) {
  return useQuery<Lead>({
    queryKey: ["lead", leadId],
    queryFn: () => api.get(`/leads/${leadId}`),
    enabled: Boolean(leadId),
  });
}

export function useCreateLeadMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: Partial<Lead> & { companyName: string }) => api.post<Lead>("/leads", payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
    },
  });
}

export function useUpdateLeadMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...payload }: Partial<Lead> & { id: string }) => api.patch<Lead>(`/leads/${id}`, payload),
    onSuccess: (_, payload) => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      queryClient.invalidateQueries({ queryKey: ["lead", payload.id] });
    },
  });
}

export function useScoreLeadMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (leadId: string) => api.post(`/leads/${leadId}/score`, {}),
    onSuccess: (_, leadId) => {
      queryClient.invalidateQueries({ queryKey: ["lead", leadId] });
      queryClient.invalidateQueries({ queryKey: ["timeline", "lead", leadId] });
    },
  });
}

export function useConvertLeadMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ leadId, ...payload }: { leadId: string; createOpportunity?: boolean; opportunityName?: string; opportunityAmount?: string }) =>
      api.post(`/leads/${leadId}/convert`, payload),
    onSuccess: (_, payload) => {
      queryClient.invalidateQueries({ queryKey: ["lead", payload.leadId] });
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      queryClient.invalidateQueries({ queryKey: ["opportunities"] });
      queryClient.invalidateQueries({ queryKey: ["customers"] });
    },
  });
}

export function useOpportunities(params?: { search?: string; status?: string; stage?: string; page?: number; limit?: number }) {
  const query = new URLSearchParams();
  if (params?.search) query.set("search", params.search);
  if (params?.status) query.set("status", params.status);
  if (params?.stage) query.set("stage", params.stage);
  if (params?.page) query.set("page", String(params.page));
  if (params?.limit) query.set("limit", String(params.limit));
  return useQuery<PaginatedResponse<Opportunity>>({
    queryKey: ["opportunities", params ?? {}],
    queryFn: () => api.get(`/opportunities${query.toString() ? `?${query.toString()}` : ""}`),
  });
}

export function useOpportunity(opportunityId: string) {
  return useQuery<Opportunity>({
    queryKey: ["opportunity", opportunityId],
    queryFn: () => api.get(`/opportunities/${opportunityId}`),
    enabled: Boolean(opportunityId),
  });
}

export function useCreateOpportunityMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: Partial<Opportunity> & { name: string }) => api.post<Opportunity>("/opportunities", payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["opportunities"] });
      queryClient.invalidateQueries({ queryKey: ["opportunity-forecast"] });
    },
  });
}

export function useUpdateOpportunityMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...payload }: Partial<Opportunity> & { id: string }) => api.patch<Opportunity>(`/opportunities/${id}`, payload),
    onSuccess: (_, payload) => {
      queryClient.invalidateQueries({ queryKey: ["opportunities"] });
      queryClient.invalidateQueries({ queryKey: ["opportunity", payload.id] });
      queryClient.invalidateQueries({ queryKey: ["opportunity-forecast"] });
      queryClient.invalidateQueries({ queryKey: ["timeline", "opportunity", payload.id] });
    },
  });
}

export function useOpportunityForecast() {
  return useQuery<{ data: OpportunityForecast }>({
    queryKey: ["opportunity-forecast"],
    queryFn: () => api.get("/opportunities-forecast"),
  });
}

export function useAutomationRules() {
  return useQuery<PaginatedResponse<AutomationRule>>({
    queryKey: ["automation-rules"],
    queryFn: () => api.get("/automation-rules"),
  });
}

export function useCreateAutomationRuleMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: Partial<AutomationRule> & { name: string; triggerEvent: string }) => api.post<AutomationRule>("/automation-rules", payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["automation-rules"] });
    },
  });
}

export function useUpdateAutomationRuleMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...payload }: Partial<AutomationRule> & { id: string }) => api.patch<AutomationRule>(`/automation-rules/${id}`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["automation-rules"] });
    },
  });
}

export function useCustomDataTypes(params?: { search?: string; page?: number; limit?: number }) {
  const query = new URLSearchParams();
  if (params?.search) query.set("search", params.search);
  if (params?.page) query.set("page", String(params.page));
  if (params?.limit) query.set("limit", String(params.limit));
  return useQuery<PaginatedResponse<CustomDataType>>({
    queryKey: ["custom-data-types", params ?? {}],
    queryFn: () => api.get(`/custom/data-types${query.toString() ? `?${query.toString()}` : ""}`),
  });
}

export function useCreateCustomDataTypeMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: Partial<CustomDataType> & { name: string }) => api.post<CustomDataType>("/custom/data-types", payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["custom-data-types"] }),
  });
}

export function useUpdateCustomDataTypeMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...payload }: Partial<CustomDataType> & { id: number }) => api.patch<CustomDataType>(`/custom/data-types/${id}`, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["custom-data-types"] }),
  });
}

export function useDeleteCustomDataTypeMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.delete<{ success: boolean }>(`/custom/data-types/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["custom-data-types"] }),
  });
}

export function useBootstrapStandardDataTypesMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<{ success: boolean; inserted: number; totalStandard: number }>("/custom/data-types/bootstrap", {}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["custom-data-types"] }),
  });
}

export function useCustomPages(params?: { search?: string; isActive?: boolean; page?: number; limit?: number }) {
  const query = new URLSearchParams();
  if (params?.search) query.set("search", params.search);
  if (params?.isActive !== undefined) query.set("isActive", String(params.isActive));
  if (params?.page) query.set("page", String(params.page));
  if (params?.limit) query.set("limit", String(params.limit));
  return useQuery<PaginatedResponse<CustomAppPage>>({
    queryKey: ["custom-pages", params ?? {}],
    queryFn: () => api.get(`/custom/pages${query.toString() ? `?${query.toString()}` : ""}`),
  });
}

export function useCustomFields(params?: { search?: string; dataTypeId?: number; isActive?: boolean; page?: number; limit?: number }) {
  const query = new URLSearchParams();
  if (params?.search) query.set("search", params.search);
  if (params?.dataTypeId) query.set("dataTypeId", String(params.dataTypeId));
  if (params?.isActive !== undefined) query.set("isActive", String(params.isActive));
  if (params?.page) query.set("page", String(params.page));
  if (params?.limit) query.set("limit", String(params.limit));
  return useQuery<PaginatedResponse<CustomField>>({
    queryKey: ["custom-fields", params ?? {}],
    queryFn: () => api.get(`/custom/fields${query.toString() ? `?${query.toString()}` : ""}`),
  });
}

export function useCreateCustomFieldMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: Partial<CustomField> & { name: string; dataTypeId: number }) => api.post<CustomField>("/custom/fields", payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["custom-fields"] });
      queryClient.invalidateQueries({ queryKey: ["custom-forms"] });
    },
  });
}

export function useUpdateCustomFieldMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...payload }: Partial<CustomField> & { id: number }) => api.patch<CustomField>(`/custom/fields/${id}`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["custom-fields"] });
      queryClient.invalidateQueries({ queryKey: ["custom-forms"] });
    },
  });
}

export function useDeleteCustomFieldMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.delete<{ success: boolean }>(`/custom/fields/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["custom-fields"] });
      queryClient.invalidateQueries({ queryKey: ["custom-forms"] });
    },
  });
}

export function useCustomForms(params?: { search?: string; page?: number; limit?: number }) {
  const query = new URLSearchParams();
  if (params?.search) query.set("search", params.search);
  if (params?.page) query.set("page", String(params.page));
  if (params?.limit) query.set("limit", String(params.limit));
  return useQuery<PaginatedResponse<CustomForm>>({
    queryKey: ["custom-forms", params ?? {}],
    queryFn: () => api.get(`/custom/forms${query.toString() ? `?${query.toString()}` : ""}`),
  });
}

export function useCustomFormDetail(formId?: number | null) {
  return useQuery<CustomFormDetailResponse>({
    queryKey: ["custom-form-detail", formId ?? "none"],
    queryFn: () => api.get(`/custom/forms/${formId}`),
    enabled: Boolean(formId),
  });
}

export function useCreateCustomFormMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: Partial<CustomForm> & { name: string }) => api.post<CustomForm>("/custom/forms", payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["custom-forms"] }),
  });
}

export function useUpdateCustomFormMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...payload }: Partial<CustomForm> & { id: number }) => api.patch<CustomForm>(`/custom/forms/${id}`, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["custom-forms"] }),
  });
}

export function useDeleteCustomFormMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.delete<{ success: boolean }>(`/custom/forms/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["custom-forms"] }),
  });
}

export function useCustomFormSavedSearches(formId?: number | null) {
  return useQuery<{ data: CustomSavedSearch[] }>({
    queryKey: ["custom-form-searches", formId ?? "none"],
    queryFn: () => api.get(`/custom/forms/${formId}/searches`),
    enabled: Boolean(formId),
  });
}

export function useCreateCustomFormSavedSearchMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      formId,
      ...payload
    }: {
      formId: number;
      name: string;
      entityType: string;
      description?: string | null;
      queryText?: string | null;
      columns?: number[];
      settings?: Record<string, unknown>;
      isActive?: boolean;
    }) => api.post<CustomSavedSearch>(`/custom/forms/${formId}/searches`, payload),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["custom-form-searches", variables.formId] });
      queryClient.invalidateQueries({ queryKey: ["custom-form-detail", variables.formId] });
    },
  });
}

export function useUpdateCustomFormSavedSearchMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      formId,
      searchId,
      ...payload
    }: {
      formId: number;
      searchId: number;
      name?: string;
      entityType?: string;
      description?: string | null;
      queryText?: string | null;
      columns?: number[];
      settings?: Record<string, unknown>;
      isActive?: boolean;
    }) => api.patch<CustomSavedSearch>(`/custom/forms/${formId}/searches/${searchId}`, payload),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["custom-form-searches", variables.formId] });
      queryClient.invalidateQueries({ queryKey: ["custom-form-detail", variables.formId] });
    },
  });
}

export function useDeleteCustomFormSavedSearchMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ formId, searchId }: { formId: number; searchId: number }) =>
      api.delete<{ success: boolean }>(`/custom/forms/${formId}/searches/${searchId}`),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["custom-form-searches", variables.formId] });
      queryClient.invalidateQueries({ queryKey: ["custom-form-detail", variables.formId] });
    },
  });
}

export function useRunCustomFormSavedSearchMutation() {
  return useMutation({
    mutationFn: ({ formId, searchId }: { formId: number; searchId: number }) =>
      api.post<CustomSavedSearchRunResponse>(`/custom/forms/${formId}/searches/${searchId}/run`, {}),
  });
}

export function useAddFieldToFormMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ formId, ...payload }: { formId: number; fieldId: number; section?: string; sortOrder?: number; isRequired?: boolean | null }) =>
      api.post(`/custom/forms/${formId}/fields`, payload),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["custom-forms"] });
      queryClient.invalidateQueries({ queryKey: ["custom-form-detail", variables.formId] });
    },
  });
}

export function useRemoveFieldFromFormMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ formId, mappingId }: { formId: number; mappingId: number }) => api.delete(`/custom/forms/${formId}/fields/${mappingId}`),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["custom-forms"] });
      queryClient.invalidateQueries({ queryKey: ["custom-form-detail", variables.formId] });
    },
  });
}

export function useEntityCustomForms(entityType: string, entityId: string, includeFields = true) {
  const query = new URLSearchParams();
  if (includeFields) query.set("includeFields", "true");
  return useQuery<{ data: EntityCustomFormLink[] }>({
    queryKey: ["entity-custom-forms", entityType, entityId, includeFields],
    queryFn: () => api.get(`/custom/entities/${entityType}/${entityId}/forms${query.toString() ? `?${query.toString()}` : ""}`),
    enabled: Boolean(entityType && entityId),
  });
}

export function useAttachCustomFormToEntityMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ entityType, entityId, ...payload }: { entityType: string; entityId: string; formId: number; sortOrder?: number }) =>
      api.post(`/custom/entities/${entityType}/${entityId}/forms`, payload),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["entity-custom-forms", variables.entityType, variables.entityId] });
      queryClient.invalidateQueries({ queryKey: ["custom-forms"] });
    },
  });
}

export function useDetachCustomFormFromEntityMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ entityType, entityId, linkId }: { entityType: string; entityId: string; linkId: number }) =>
      api.delete(`/custom/entities/${entityType}/${entityId}/forms/${linkId}`),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["entity-custom-forms", variables.entityType, variables.entityId] });
    },
  });
}

export function useEntityCustomValues(entityType: string, entityId: string, formId?: number) {
  const query = new URLSearchParams();
  if (formId) query.set("formId", String(formId));
  return useQuery<{ data: CustomValueRow[] }>({
    queryKey: ["entity-custom-values", entityType, entityId, formId ?? "all"],
    queryFn: () => api.get(`/custom/entities/${entityType}/${entityId}/values${query.toString() ? `?${query.toString()}` : ""}`),
    enabled: Boolean(entityType && entityId),
  });
}

export function useSaveEntityCustomValuesMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ entityType, entityId, values }: { entityType: string; entityId: string; values: Array<{ fieldId: number; value: unknown }> }) =>
      api.post(`/custom/entities/${entityType}/${entityId}/values`, { values }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["entity-custom-values", variables.entityType, variables.entityId] });
      queryClient.invalidateQueries({ queryKey: ["entity-custom-forms", variables.entityType, variables.entityId] });
      queryClient.invalidateQueries({ queryKey: ["timeline", variables.entityType, variables.entityId] });
    },
  });
}
