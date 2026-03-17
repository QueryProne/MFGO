const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const API = `${BASE}/api`;

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
  entity: string; id: string; number?: string; name?: string; status?: string;
  metadata?: { type: string };
}
