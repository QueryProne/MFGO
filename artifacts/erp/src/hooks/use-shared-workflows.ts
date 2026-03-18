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
