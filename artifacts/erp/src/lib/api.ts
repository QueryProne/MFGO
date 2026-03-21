const rawApiBaseUrl =
  typeof import.meta.env.VITE_API_BASE_URL === "string"
    ? import.meta.env.VITE_API_BASE_URL.trim()
    : "";

const base = rawApiBaseUrl
  ? rawApiBaseUrl.replace(/\/$/, "")
  : import.meta.env.BASE_URL.replace(/\/$/, "");

const API = base.endsWith("/api") ? base : `${base}/api`;

async function req<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message ?? `HTTP ${res.status}`);
  }
  return res.json();
}

export const api = {
  get: <T>(path: string) => req<T>(path),
  post: <T>(path: string, body: unknown) => req<T>(path, { method: "POST", body: JSON.stringify(body) }),
  put: <T>(path: string, body: unknown) => req<T>(path, { method: "PUT", body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) => req<T>(path, { method: "PATCH", body: JSON.stringify(body) }),
  delete: <T>(path: string) => req<T>(path, { method: "DELETE" }),
};

export interface PaginatedResponse<T> {
  data: T[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

// ─── Entities ────────────────────────────────────────────────────────────────

export interface DashboardKpis {
  kpis: Array<{ key: string; label: string; value: number; unit: string; trend: number; trendLabel: string; status: string }>;
  openSalesOrders: number; openPurchaseOrders: number; openWorkOrders: number;
  pendingInspections: number; openNonconformances: number; lowInventoryItems: number;
  overdueInvoices: number; recentRevenue: number;
}

export interface Customer {
  id: string; number: string; name: string; type?: string; status: string;
  email?: string; phone?: string; creditLimit?: string; paymentTerms?: string;
  notes?: string; createdAt: string; updatedAt: string;
}

export interface Vendor {
  id: string; number: string; name: string; status: string;
  email?: string; phone?: string; paymentTerms?: string; leadTime?: number;
  notes?: string; createdAt: string;
}

export interface Item {
  id: string; number: string; name: string; type: string; status: string;
  supplyType?: string; makeBuy?: string;
  uom?: string; standardCost?: string; listPrice?: string; description?: string;
  safetyStock?: string; reorderPoint?: string; reorderQty?: string; leadTime?: number;
  revision?: string; lotTracked?: boolean; serialTracked?: boolean;
  createdAt: string; updatedAt: string;
}

export interface ItemVendor {
  id: string; itemId: string; vendorId: string; vendorNumber?: string; vendorName?: string;
  vendorPartNumber?: string; isPreferred?: boolean; isApproved?: boolean;
  leadTimeDays?: number; minOrderQty?: string; orderMultiple?: string; purchaseUom?: string;
  uomConversionToStock?: string; safetyStockQty?: string; reorderPointQty?: string;
  lastCost?: string; standardCost?: string; effectiveFrom?: string; effectiveTo?: string;
  notes?: string; createdAt: string; updatedAt: string;
}

export interface SalesOrder {
  id: string; number: string; customerId: string; customerName?: string;
  status: string; orderDate?: string; requestedDate?: string; promisedDate?: string;
  subtotal?: string; taxAmount?: string; totalAmount?: string; notes?: string;
  createdAt: string; updatedAt: string;
  lines?: SalesOrderLine[];
}
export interface SalesOrderLine {
  id: string; lineNumber: number; itemId?: string; itemNumber?: string; itemName?: string;
  itemType?: string; supplyType?: string;
  description?: string; quantity?: string; uom?: string; unitPrice?: string; lineTotal?: string;
  requestedDate?: string; promisedDate?: string;
}

export interface PurchaseOrder {
  id: string; number: string; vendorId: string; vendorName?: string;
  status: string; orderDate?: string; requestedDate?: string;
  totalAmount?: string; notes?: string; createdAt: string; updatedAt: string;
  lines?: PurchaseOrderLine[];
}
export interface PurchaseOrderLine {
  id: string; lineNumber: number; itemId?: string; itemNumber?: string; itemName?: string;
  quantity?: string; unitCost?: string; lineTotal?: string; quantityReceived?: string;
  mrpRecommendationId?: string;
}

export interface WorkOrder {
  id: string; number: string; itemId: string; itemNumber?: string; itemName?: string;
  salesOrderId?: string; salesOrderNumber?: string; parentWorkOrderId?: string;
  status: string; type: string; uom?: string;
  quantityOrdered?: string; quantityCompleted?: string; quantityScrapped?: string;
  scheduledStart?: string; scheduledEnd?: string;
  actualStart?: string; actualEnd?: string;
  priority?: string; notes?: string; bomId?: string; routingId?: string;
  createdAt: string; updatedAt: string;
  operations?: WorkOrderOperation[];
  materials?: WorkOrderMaterial[];
}
export interface WorkOrderOperation {
  id: string; sequence: number; name: string; workcenterId?: string; workcenterName?: string;
  status: string; setupTime?: string; runTime?: string; laborHours?: string;
}
export interface WorkOrderMaterial {
  id: string; workOrderId: string; bomLineId?: string;
  itemId: string; itemNumber?: string; itemName?: string; itemType?: string; supplyType?: string;
  requiredQty: string; issuedQty?: string; allocatedQty?: string; shortageQty?: string;
  supplyTypeSnapshot?: string; sourceWorkOrderId?: string; uom?: string; notes?: string;
}

export interface ServiceOrder {
  id: string; number: string;
  salesOrderId?: string; salesOrderNumber?: string;
  customerId: string; customerName?: string;
  itemId?: string; itemNumber?: string; itemName?: string;
  serviceType: string; status: string;
  requestedDate?: string; scheduledDate?: string; completionDate?: string;
  customerSite?: string; assetReference?: string;
  plannedHours?: string; actualHours?: string;
  notes?: string; createdAt: string; updatedAt: string;
}

export interface InventoryBalance {
  id: string; itemId: string; itemNumber?: string; itemName?: string;
  warehouseId: string; warehouseName?: string; location?: string;
  quantityOnHand: string; quantityAllocated: string; quantityOnOrder: string;
  quantityAvailable: string; uom?: string; updatedAt: string;
}

export interface Invoice {
  id: string; number: string; customerId: string; customerName?: string;
  salesOrderId?: string; salesOrderNumber?: string; status: string;
  invoiceDate?: string; dueDate?: string; totalAmount?: string; amountPaid?: string;
  amountDue?: string; notes?: string; createdAt: string;
}

export interface Shipment {
  id: string; number: string; customerId?: string; customerName?: string;
  salesOrderId?: string; salesOrderNumber?: string; status: string;
  shippedDate?: string; carrier?: string; trackingNumber?: string; createdAt: string;
}

export interface Quote {
  id: string; number: string; customerId: string; customerName?: string;
  status: string; quoteDate?: string; expiryDate?: string; totalAmount?: string;
  notes?: string; createdAt: string;
}

export interface Inspection {
  id: string; number: string; type: string; status: string;
  itemId?: string; itemNumber?: string; itemName?: string;
  quantity?: string; quantityPassed?: string; quantityFailed?: string;
  reference?: string; lotNumber?: string;
  inspectedBy?: string; inspectedAt?: string; notes?: string; createdAt: string;
}

export interface Nonconformance {
  id: string; number: string; title: string; description?: string;
  status: string; severity: string; itemId?: string; itemNumber?: string;
  defectCode?: string; disposition?: string; quantityAffected?: string;
  reportedBy?: string; assignedTo?: string; createdAt: string;
}

export interface Bom {
  id: string; number: string; itemId: string; itemNumber?: string; itemName?: string;
  revision?: string; status: string; effectiveDate?: string; notes?: string;
  createdAt: string; updatedAt: string; lines?: BomLine[];
}
export interface BomLine {
  id: string; sequence: number; itemId?: string; itemNumber?: string; itemName?: string;
  itemType?: string; supplyType?: string;
  quantity: string; uom?: string; scrapFactor?: string;
  lineType?: string; componentIssuePolicy?: string;
  isPhantom?: boolean; effectiveFrom?: string; effectiveTo?: string;
  referenceNotes?: string; notes?: string;
}

export interface MrpRun {
  id: string; type: string; status: string; planningHorizon?: number;
  startedAt?: string; completedAt?: string; summaryStats?: any; createdAt: string;
}

export interface WorkbenchItem {
  id: string; runId: string; type: string;
  itemId: string; itemNumber?: string; itemName?: string; supplyType?: string;
  quantity: string; neededDate?: string; priority: string; status: string;
  message?: string;
  preferredVendorId?: string; preferredVendorName?: string; preferredVendorLeadDays?: number;
  vendorMissing?: boolean; vendorException?: string;
  currentOnHand: number; currentAllocated: number; currentOnOrder: number; currentAvailable: number;
  shortageQty: number;
  salesOrderId?: string; salesOrderLineId?: string; parentWorkOrderId?: string;
  peggingContext?: any;
  releasedPurchaseOrderId?: string; releasedWorkOrderId?: string; releasedAt?: string;
}

export interface SearchResult {
  entity: string;
  id: string;
  type?: string;
  title?: string;
  subtitle?: string;
  href?: string;
  score?: number;
  number?: string;
  name?: string;
  status?: string;
  metadata?: { type: string; [key: string]: unknown };
}

export interface SearchResponse {
  results: SearchResult[];
  total: number;
  query: string;
}

export interface Task {
  id: string;
  entityType: string;
  entityId: string;
  relatedEntityType?: string | null;
  relatedEntityId?: string | null;
  title: string;
  description?: string | null;
  dueDate?: string | null;
  status: "open" | "in_progress" | "done" | string;
  priority: "low" | "medium" | "high" | "critical" | string;
  assigneeId?: string | null;
  createdBy?: string | null;
  reminders?: Array<Record<string, unknown>>;
  comments?: Array<Record<string, unknown>>;
  metadata?: Record<string, unknown> | null;
  completedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SharedEmail {
  id: string;
  direction: string;
  status: string;
  subject: string;
  bodyHtml?: string | null;
  bodyText?: string | null;
  fromAddress: string;
  replyTo?: string | null;
  messageId?: string | null;
  inReplyTo?: string | null;
  referencesHeader?: string | null;
  conversationId?: string | null;
  templateId?: string | null;
  templateVersionId?: string | null;
  providerName?: string | null;
  providerMessageId?: string | null;
  createdAt: string;
  updatedAt: string;
  queuedAt?: string | null;
  sentAt?: string | null;
  receivedAt?: string | null;
  recipients?: Array<{
    recipientType: "to" | "cc" | "bcc" | string;
    emailAddress: string;
    displayName?: string | null;
    deliveryStatus?: string | null;
  }>;
  contextLinks?: Array<{
    entityType: string;
    entityId: string;
    relatedEntityType?: string | null;
    relatedEntityId?: string | null;
    linkRole?: string | null;
  }>;
}

export interface TimelineEntry {
  id: string;
  activityType: string;
  sourceType: string;
  sourceId?: string | null;
  title: string;
  body?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
}

export interface Lead {
  id: string;
  number: string;
  firstName?: string | null;
  lastName?: string | null;
  companyName: string;
  email?: string | null;
  phone?: string | null;
  source?: string | null;
  status: string;
  ownerId?: string | null;
  notes?: string | null;
  convertedCustomerId?: string | null;
  convertedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  latestScore?: {
    id: string;
    score: number;
    confidence?: number | null;
    reasoning?: string | null;
    createdAt: string;
  } | null;
}

export interface Opportunity {
  id: string;
  number: string;
  name: string;
  stage: string;
  status: string;
  amount: string;
  probability: number;
  expectedCloseDate?: string | null;
  customerId?: string | null;
  vendorId?: string | null;
  leadId?: string | null;
  ownerId?: string | null;
  notes?: string | null;
  wonReason?: string | null;
  lostReason?: string | null;
  closedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  stageHistory?: Array<{
    id: string;
    fromStage?: string | null;
    toStage: string;
    changedBy?: string | null;
    note?: string | null;
    changedAt: string;
  }>;
}

export interface AutomationRule {
  id: string;
  name: string;
  description?: string | null;
  triggerEvent: string;
  conditionJson: Record<string, unknown>;
  actionJson: Record<string, unknown>;
  isActive: boolean;
  lastRunAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface OpportunityForecast {
  totals: {
    pipelineAmount: number;
    weightedAmount: number;
    openCount: number;
    wonCount: number;
    lostCount: number;
  };
  stages: Array<{
    stage: string;
    status: string;
    count: number;
    amount: string;
    weightedAmount: string;
  }>;
  snapshot: {
    id: string;
    snapshotLabel: string;
    weightedAmount: string;
    pipelineAmount: string;
    openCount: number;
    wonCount: number;
    lostCount: number;
    createdAt: string;
  };
}

export interface CustomDataType {
  id: number;
  name: string;
  slug: string;
  description?: string | null;
  settings: Record<string, unknown>;
  isSystem: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CustomField {
  id: number;
  name: string;
  slug: string;
  label?: string | null;
  description?: string | null;
  helpText?: string | null;
  placeholder?: string | null;
  dataTypeId: number;
  dataTypeSlug?: string;
  isRequired: boolean;
  isActive: boolean;
  defaultValue?: unknown;
  options?: Array<Record<string, unknown>>;
  settings?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface CustomFormFieldView {
  id?: number;
  mappingId?: number;
  formId: number;
  fieldId: number;
  sortOrder?: number;
  section?: string | null;
  isRequired?: boolean | null;
  fieldRequired?: boolean;
  fieldName?: string;
  fieldSlug?: string;
  fieldLabel?: string | null;
  fieldOptions?: Array<Record<string, unknown>> | null;
  fieldPlaceholder?: string | null;
  fieldHelpText?: string | null;
  dataTypeSlug?: string;
  value?: unknown;
  valueUpdatedAt?: string | null;
}

export interface CustomForm {
  id: number;
  name: string;
  slug: string;
  description?: string | null;
  settings?: Record<string, unknown>;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  fields?: CustomFormFieldView[];
}

export interface CustomFormApplication {
  linkId: number;
  entityType: string;
  entityId: string;
  appPageId?: number | null;
  pageId?: string | null;
  pageTitle?: string | null;
  pageRoute?: string | null;
  sortOrder: number;
  settings?: Record<string, unknown>;
}

export interface CustomFormDetailResponse {
  form: CustomForm & { fields: CustomFormFieldView[] };
  applications: CustomFormApplication[];
}

export interface EntityCustomFormLink {
  linkId: number;
  formId: number;
  appPageId?: number | null;
  pageId?: string | null;
  pageTitle?: string | null;
  pageRoute?: string | null;
  sortOrder: number;
  settings?: Record<string, unknown>;
  formName?: string;
  formSlug?: string;
  fields?: CustomFormFieldView[];
}

export interface CustomAppPage {
  id: number;
  pageId: string;
  title: string;
  route: string;
  description?: string | null;
  isActive: boolean;
  settings?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface CustomValueRow {
  id?: number;
  entityType: string;
  entityId: string;
  fieldId: number;
  value: unknown;
  fieldName?: string;
  fieldSlug?: string;
  dataTypeSlug?: string;
  updatedAt?: string;
}

export interface CustomSavedSearch {
  id: number;
  formId: number;
  name: string;
  entityType: string;
  description?: string | null;
  queryText?: string | null;
  columns: number[];
  settings: Record<string, unknown>;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CustomSavedSearchRunRow {
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
}

export interface CustomSavedSearchRunResponse {
  search: CustomSavedSearch;
  rows: CustomSavedSearchRunRow[];
}
