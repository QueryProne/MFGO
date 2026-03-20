import { db } from "@workspace/db";
import {
  usersTable, rolesTable, customersTable, vendorsTable, contactsTable,
  itemsTable, warehousesTable, inventoryBalancesTable, inventoryTransactionsTable,
  workcentersTable, bomsTable, bomLinesTable, routingsTable, routingOperationsTable,
  salesOrdersTable, salesOrderLinesTable, purchaseOrdersTable, purchaseOrderLinesTable,
  workOrdersTable, shipmentsTable, invoicesTable, inspectionsTable, nonconformancesTable,
  mrpRunsTable, mrpRecommendationsTable,
  tasksTable, leadsTable, opportunitiesTable, opportunityStageHistoryTable,
  aiLeadScoresTable, automationRulesTable, activityTimelineTable, chatLogsTable,
  commEmailConversationsTable, commEmailMessagesTable, commEmailRecipientsTable,
  commEmailContextLinksTable, commEmailTemplatesTable, commEmailTemplateVersionsTable,
  emailSequencesTable, emailSequenceStepsTable, emailSequenceEnrollmentsTable,
  dataTypesTable,
} from "@workspace/db";
import { eq, sql } from "drizzle-orm";

async function tableHasRows(table: any, idCol: any): Promise<boolean> {
  const res = await db.select({ count: sql<number>`count(*)` }).from(table);
  return Number(res[0]?.count ?? 0) > 0;
}

async function ensureSystemUserExists(): Promise<void> {
  await db
    .insert(usersTable)
    .values({
      id: "system-user",
      email: "system@manufactureos.local",
      firstName: "System",
      lastName: "User",
      status: "active",
      department: "System",
      roleId: null,
    })
    .onConflictDoNothing();
}

async function ensureCustomDataTypes(): Promise<void> {
  await db
    .insert(dataTypesTable)
    .values([
      { name: "Text", slug: "text", description: "Single-line text value", settings: { maxLength: 255 }, isSystem: true },
      { name: "Number", slug: "number", description: "Numeric value", settings: { precision: 15, scale: 4 }, isSystem: true },
      { name: "Date", slug: "date", description: "Date value", settings: { format: "yyyy-MM-dd" }, isSystem: true },
      { name: "Boolean", slug: "boolean", description: "True/false flag", settings: {}, isSystem: true },
      { name: "Select", slug: "select", description: "Single select option list", settings: { allowCustom: false }, isSystem: true },
      { name: "Multi Select", slug: "multi_select", description: "Multiple select options", settings: { allowCustom: false }, isSystem: true },
      { name: "File", slug: "file", description: "File/object reference", settings: { maxSizeMb: 25 }, isSystem: true },
      { name: "Rich Text", slug: "rich_text", description: "Formatted HTML/markdown content", settings: {}, isSystem: true },
      { name: "JSON", slug: "json", description: "Structured JSON payload", settings: {}, isSystem: true },
    ])
    .onConflictDoNothing({ target: dataTypesTable.slug });
}

export async function seed() {
  await ensureCustomDataTypes();
  const hasData = await tableHasRows(customersTable, customersTable.id);
  if (hasData) {
    await ensureSystemUserExists();
    console.log("[seed] Data already exists, skipping seed.");
    return;
  }

  console.log("[seed] Seeding demo data...");

  // Roles
  const [adminRole, plannerRole, operatorRole] = await db.insert(rolesTable).values([
    { name: "System Administrator", description: "Full system access", permissions: ["*"] },
    { name: "Production Planner", description: "Production and MRP access", permissions: ["production.*", "mrp.*", "inventory.*"] },
    { name: "Operator", description: "Work order execution", permissions: ["workorders.read", "workorders.update"] },
  ]).returning();

  // Users
  await db.insert(usersTable).values([
    { id: "system-user", email: "admin@manufactureOS.com", firstName: "Admin", lastName: "User", roleId: adminRole.id, department: "IT", status: "active" },
    { email: "planner@manufactureOS.com", firstName: "Sarah", lastName: "Chen", roleId: plannerRole.id, department: "Production", status: "active" },
    { email: "operator@manufactureOS.com", firstName: "Mike", lastName: "Torres", roleId: operatorRole.id, department: "Shop Floor", status: "active" },
  ]).returning();
  const systemUserId = "system-user";

  // Warehouses
  const [mainWH, qcWH] = await db.insert(warehousesTable).values([
    { name: "Main Warehouse", code: "MAIN", address: "100 Industrial Blvd, Detroit, MI 48201" },
    { name: "QC Hold", code: "QCHOLD", address: "100 Industrial Blvd, Detroit, MI 48201" },
  ]).returning();

  // Work Centers
  const [wc1, wc2, wc3] = await db.insert(workcentersTable).values([
    { name: "CNC Machining", code: "CNC-01", notes: "3-axis CNC mill", capacity: "16", capacityUom: "hours/day", status: "active" },
    { name: "Assembly Line A", code: "ASM-A", notes: "General assembly", capacity: "16", capacityUom: "hours/day", status: "active" },
    { name: "Quality Control", code: "QC-01", notes: "Final inspection station", capacity: "8", capacityUom: "hours/day", status: "active" },
  ]).returning();

  // Customers
  const [cust1, cust2, cust3] = await db.insert(customersTable).values([
    {
      number: "C-1001", name: "Acme Industrial Corp", email: "purchasing@acmeindustrial.com",
      phone: "313-555-0101", website: "www.acmeindustrial.com", status: "active",
      billingAddress: "200 Factory Row, Detroit, MI 48201", currency: "USD", paymentTerms: "Net 30",
      creditLimit: "500000.00", creditUsed: "125000.00", notes: "Key account - automotive parts supplier",
    },
    {
      number: "C-1002", name: "BuildRight Construction", email: "orders@buildright.com",
      phone: "248-555-0202", status: "active",
      billingAddress: "450 Construction Ave, Pontiac, MI 48342", currency: "USD", paymentTerms: "Net 45",
      creditLimit: "200000.00", creditUsed: "45000.00",
    },
    {
      number: "C-1003", name: "Precision Dynamics LLC", email: "procurement@precisiondyn.com",
      phone: "734-555-0303", status: "active",
      billingAddress: "1100 Tech Drive, Ann Arbor, MI 48108", currency: "USD", paymentTerms: "Net 30",
      creditLimit: "750000.00", creditUsed: "320000.00", notes: "Aerospace & defense",
    },
  ]).returning();

  // Vendors
  const [vend1, vend2] = await db.insert(vendorsTable).values([
    {
      number: "V-1001", name: "SteelCo Materials", email: "sales@steelco.com",
      phone: "216-555-1001", status: "active",
      billingAddress: "500 Steel Mill Rd, Cleveland, OH 44101",
      currency: "USD", paymentTerms: "Net 30", leadTime: 7,
    },
    {
      number: "V-1002", name: "FastFab Components", email: "orders@fastfab.com",
      phone: "313-555-1002", status: "active",
      billingAddress: "750 Industrial Park, Dearborn, MI 48124",
      currency: "USD", paymentTerms: "Net 15", leadTime: 3,
    },
  ]).returning();

  // Items
  const [rawSteel, bolts, bracket, motor, assembly] = await db.insert(itemsTable).values([
    {
      number: "RM-0001", name: "Steel Rod 1.5\" OD x 12\"", type: "raw_material",
      uom: "EA", description: "Hot-rolled 1018 steel rod", standardCost: "8.50",
      status: "active", listPrice: "8.50", weight: "2.1",
      safetyStock: "100", reorderPoint: "50", reorderQty: "500", leadTime: 7,
    },
    {
      number: "RM-0002", name: "Grade 8 Hex Bolt 1/2-13", type: "purchased_part",
      uom: "EA", description: "1/2-13 x 2 Grade 8 hex bolt zinc plated", standardCost: "0.45",
      status: "active", listPrice: "0.45",
      safetyStock: "500", reorderPoint: "250", reorderQty: "2000", leadTime: 3,
    },
    {
      number: "MFG-0001", name: "Steel Mounting Bracket", type: "manufactured",
      uom: "EA", description: "CNC machined steel mounting bracket", standardCost: "45.00",
      status: "active", listPrice: "125.00", weight: "1.8",
      safetyStock: "20", reorderPoint: "10", reorderQty: "50", leadTime: 5,
    },
    {
      number: "MFG-0002", name: "DC Motor Assembly", type: "manufactured",
      uom: "EA", description: "24V DC brushless motor with encoder", standardCost: "220.00",
      status: "active", listPrice: "580.00", weight: "4.2",
      safetyStock: "10", reorderPoint: "5", reorderQty: "25", leadTime: 10,
    },
    {
      number: "FG-0001", name: "Industrial Drive Unit Model A", type: "finished_good",
      uom: "EA", description: "Complete industrial drive assembly", standardCost: "485.00",
      status: "active", listPrice: "1250.00", weight: "12.5",
      safetyStock: "5", reorderPoint: "3", reorderQty: "10", leadTime: 14,
    },
  ]).returning();

  // BOMs
  const [bom1] = await db.insert(bomsTable).values([
    { number: "BOM-0001", itemId: bracket.id, revision: "A", status: "active", effectiveDate: "2025-01-01", notes: "Rev A - Initial release" },
  ]).returning();

  await db.insert(bomLinesTable).values([
    { bomId: bom1.id, sequence: 10, itemId: rawSteel.id, quantity: "1.000", uom: "EA", scrapFactor: "0.05", notes: "Raw stock" },
    { bomId: bom1.id, sequence: 20, itemId: bolts.id, quantity: "4.000", uom: "EA", scrapFactor: "0", notes: "Fasteners" },
  ]);

  // Routings
  const [routing1] = await db.insert(routingsTable).values([
    { itemId: bracket.id, revision: "A", status: "active" },
  ]).returning();

  await db.insert(routingOperationsTable).values([
    { routingId: routing1.id, sequence: 10, name: "CNC Machine", workcenterId: wc1.id, setupTime: "30", runTime: "15", queueTime: "0", notes: "Mill to print" },
    { routingId: routing1.id, sequence: 20, name: "Deburr & Clean", workcenterId: wc2.id, setupTime: "5", runTime: "10", queueTime: "0" },
    { routingId: routing1.id, sequence: 30, name: "Final Inspection", workcenterId: wc3.id, setupTime: "5", runTime: "5", queueTime: "0" },
  ]);

  // Inventory balances
  await db.insert(inventoryBalancesTable).values([
    { itemId: rawSteel.id, warehouseId: mainWH.id, quantityOnHand: "250", quantityAllocated: "50", quantityOnOrder: "500" },
    { itemId: bolts.id, warehouseId: mainWH.id, quantityOnHand: "1500", quantityAllocated: "200", quantityOnOrder: "0" },
    { itemId: bracket.id, warehouseId: mainWH.id, quantityOnHand: "35", quantityAllocated: "10", quantityOnOrder: "0" },
    { itemId: motor.id, warehouseId: mainWH.id, quantityOnHand: "8", quantityAllocated: "3", quantityOnOrder: "0" },
    { itemId: assembly.id, warehouseId: mainWH.id, quantityOnHand: "4", quantityAllocated: "2", quantityOnOrder: "0" },
  ]);

  // Sales Orders
  const [so1, so2, so3] = await db.insert(salesOrdersTable).values([
    {
      number: "SO-1001", customerId: cust1.id, status: "confirmed",
      orderDate: "2026-03-01", requestedDate: "2026-03-30",
      subtotal: "25000.00", taxAmount: "2000.00", totalAmount: "27000.00",
      notes: "Rush order - Q1 delivery required",
      shippingAddress: "200 Factory Row, Detroit, MI 48201",
    },
    {
      number: "SO-1002", customerId: cust2.id, status: "in_production",
      orderDate: "2026-03-05", requestedDate: "2026-04-15",
      subtotal: "15600.00", taxAmount: "1248.00", totalAmount: "16848.00",
      shippingAddress: "450 Construction Ave, Pontiac, MI 48342",
    },
    {
      number: "SO-1003", customerId: cust3.id, status: "draft",
      orderDate: "2026-03-12", requestedDate: "2026-04-30",
      subtotal: "87500.00", taxAmount: "7000.00", totalAmount: "94500.00",
      notes: "Pending engineering approval",
      shippingAddress: "1100 Tech Drive, Ann Arbor, MI 48108",
    },
  ]).returning();

  await db.insert(salesOrderLinesTable).values([
    { salesOrderId: so1.id, lineNumber: 1, itemId: bracket.id, description: "Steel Mounting Bracket", quantity: "200", uom: "EA", unitPrice: "125.00", lineTotal: "25000.00", requestedDate: "2026-03-30" },
    { salesOrderId: so2.id, lineNumber: 1, itemId: assembly.id, description: "Industrial Drive Unit", quantity: "12", uom: "EA", unitPrice: "1250.00", lineTotal: "15000.00", requestedDate: "2026-04-15" },
    { salesOrderId: so2.id, lineNumber: 2, itemId: bracket.id, description: "Steel Mounting Bracket", quantity: "5", uom: "EA", unitPrice: "120.00", lineTotal: "600.00", requestedDate: "2026-04-15" },
    { salesOrderId: so3.id, lineNumber: 1, itemId: assembly.id, description: "Industrial Drive Unit (Custom)", quantity: "70", uom: "EA", unitPrice: "1250.00", lineTotal: "87500.00", requestedDate: "2026-04-30" },
  ]);

  // Purchase Orders
  const [po1] = await db.insert(purchaseOrdersTable).values([
    {
      number: "PO-1001", vendorId: vend1.id, status: "sent",
      orderDate: "2026-03-10", requestedDate: "2026-03-17",
      subtotal: "4250.00", totalAmount: "4250.00", warehouseId: mainWH.id,
      notes: "Urgent restock for SO-1001",
    },
  ]).returning();

  await db.insert(purchaseOrderLinesTable).values([
    { purchaseOrderId: po1.id, lineNumber: 1, itemId: rawSteel.id, quantity: "500", uom: "EA", unitCost: "8.50", lineTotal: "4250.00", requestedDate: "2026-03-17" },
  ]);

  // Work Orders
  const [wo1, wo2] = await db.insert(workOrdersTable).values([
    {
      number: "WO-1001", itemId: bracket.id, bomId: bom1.id, routingId: routing1.id,
      salesOrderId: so1.id, type: "standard", status: "released",
      quantityOrdered: "200", quantityCompleted: "0", quantityScrapped: "0",
      scheduledStart: "2026-03-17", scheduledEnd: "2026-03-25",
      warehouseId: mainWH.id, priority: "high", notes: "Related to SO-1001",
    },
    {
      number: "WO-1002", itemId: motor.id, type: "standard", status: "in_progress",
      quantityOrdered: "25", quantityCompleted: "12", quantityScrapped: "0",
      scheduledStart: "2026-03-10", scheduledEnd: "2026-03-20",
      warehouseId: mainWH.id, priority: "normal",
    },
  ]).returning();

  // Inspections
  await db.insert(inspectionsTable).values([
    {
      number: "INS-1001", type: "receiving", status: "passed",
      itemId: rawSteel.id, quantity: "250", quantityPassed: "245", quantityFailed: "5",
      reference: "PO-1000", lotNumber: "LOT-2026-001",
      inspectedBy: "Mike Torres", inspectedAt: new Date("2026-03-05"),
      notes: "5 pcs rejected - dimensional out of tolerance",
    },
    {
      number: "INS-1002", type: "in_process", status: "pending",
      itemId: bracket.id, quantity: "50", quantityPassed: "0", quantityFailed: "0",
      reference: "WO-1001",
      inspectedBy: undefined,
    },
  ]);

  // NCRs
  await db.insert(nonconformancesTable).values([
    {
      number: "NCR-1001", title: "Steel rod dimensional deviation",
      description: "5 pcs of RM-0001 found outside tolerance on OD dimension",
      status: "open", severity: "minor", itemId: rawSteel.id,
      defectCode: "DIM-001", disposition: "return_to_vendor",
      quantityAffected: "5", lotNumber: "LOT-2026-001",
      containmentAction: "Segregated to QC Hold area",
      reportedBy: "Mike Torres",
    },
  ]);

  // Invoice
  const [ship1] = await db.insert(shipmentsTable).values([
    {
      number: "SHP-1001", salesOrderId: so2.id, customerId: cust2.id,
      status: "shipped", shippedDate: "2026-03-08",
      carrier: "UPS Freight", trackingNumber: "1Z999AA10123456784",
      warehouseId: mainWH.id,
      shippingAddress: "450 Construction Ave, Pontiac, MI 48342",
    },
  ]).returning();

  await db.insert(invoicesTable).values([
    {
      number: "INV-1001", customerId: cust2.id, salesOrderId: so2.id,
      shipmentId: ship1.id, status: "sent",
      invoiceDate: "2026-03-08", dueDate: "2026-04-22",
      subtotal: "15600.00", taxAmount: "1248.00", totalAmount: "16848.00",
      amountPaid: "0.00", paymentTerms: "Net 45",
    },
  ]);

  // Shared Tasks
  const [task1, task2, task3] = await db.insert(tasksTable).values([
    {
      entityType: "customer",
      entityId: cust1.id,
      title: "Call purchasing team for revised blanket PO",
      description: "Confirm Q2 order cadence and release windows for SO-1001 follow-on demand.",
      status: "open",
      priority: "high",
      dueDate: new Date("2026-03-21"),
      createdBy: systemUserId,
      reminders: [{ channel: "in_app", at: "2026-03-20T14:00:00.000Z" }],
      comments: [{ id: crypto.randomUUID(), body: "Customer requested callback after internal budget meeting.", createdAt: new Date().toISOString() }],
    },
    {
      entityType: "vendor",
      entityId: vend1.id,
      title: "Request steel mill certs for lot LOT-2026-001",
      description: "Quality requested COA + heat treat documentation.",
      status: "in_progress",
      priority: "medium",
      dueDate: new Date("2026-03-22"),
      createdBy: systemUserId,
      reminders: [],
      comments: [],
    },
    {
      entityType: "workorder",
      entityId: wo1.id,
      title: "Validate fixture readiness before WO-1001 run",
      description: "Production engineering to confirm fixture revision A is on cell CNC-01.",
      status: "open",
      priority: "high",
      dueDate: new Date("2026-03-18"),
      createdBy: systemUserId,
      reminders: [],
      comments: [],
    },
  ]).returning();

  // CRM Funnel
  const [lead1, lead2] = await db.insert(leadsTable).values([
    {
      number: "LD-1001",
      firstName: "Evelyn",
      lastName: "Brooks",
      companyName: "Acme Industrial Corp",
      email: "evelyn.brooks@acmeindustrial.com",
      phone: "313-555-0192",
      source: "referral",
      status: "qualified",
      ownerId: systemUserId,
      notes: "Existing account expansion lead for custom drive train package.",
    },
    {
      number: "LD-1002",
      firstName: "Daniel",
      lastName: "Miller",
      companyName: "Northline Fabrication",
      email: "dmiller@northlinefab.com",
      phone: "734-555-8802",
      source: "website",
      status: "new",
      ownerId: systemUserId,
      notes: "Inbound inquiry for pilot lot of 20 drive units.",
    },
  ]).returning();

  const [opp1, opp2] = await db.insert(opportunitiesTable).values([
    {
      number: "OPP-1001",
      name: "Acme Q2 Platform Expansion",
      stage: "proposal",
      status: "open",
      amount: "185000.00",
      probability: 55,
      expectedCloseDate: new Date("2026-04-28"),
      customerId: cust1.id,
      leadId: lead1.id,
      ownerId: systemUserId,
      notes: "Expansion opportunity tied to retrofit program.",
    },
    {
      number: "OPP-1002",
      name: "Northline Pilot Program",
      stage: "qualification",
      status: "open",
      amount: "42000.00",
      probability: 25,
      expectedCloseDate: new Date("2026-05-10"),
      leadId: lead2.id,
      ownerId: systemUserId,
      notes: "Early-stage opportunity from web lead.",
    },
  ]).returning();

  await db.insert(opportunityStageHistoryTable).values([
    { opportunityId: opp1.id, fromStage: null, toStage: "proposal", changedBy: systemUserId, note: "Imported seed stage" },
    { opportunityId: opp2.id, fromStage: null, toStage: "qualification", changedBy: systemUserId, note: "Imported seed stage" },
  ]);

  await db.insert(aiLeadScoresTable).values([
    {
      leadId: lead1.id,
      modelName: "heuristic-v1",
      score: 84,
      confidence: 72,
      reasoning: "Referral source + qualified stage + complete contact details.",
      factors: JSON.stringify(["referral_source", "qualified_status", "contact_complete"]),
      scoredBy: systemUserId,
    },
    {
      leadId: lead2.id,
      modelName: "heuristic-v1",
      score: 63,
      confidence: 68,
      reasoning: "New inbound lead with full contact profile.",
      factors: JSON.stringify(["new_status", "contact_complete"]),
      scoredBy: systemUserId,
    },
  ]);

  // Shared Email Template + Message
  const [seedTemplate] = await db.insert(commEmailTemplatesTable).values([
    {
      code: "PO_TRANSMITTAL",
      name: "PO Transmittal",
      category: "purchasing",
      module: "purchase_orders",
      description: "Standard PO transmittal with attached drawings/specs.",
      isActive: true,
      tenantId: "default",
      createdBy: systemUserId,
    },
  ]).returning();

  const [seedTemplateVersion] = await db.insert(commEmailTemplateVersionsTable).values([
    {
      templateId: seedTemplate.id,
      version: 1,
      status: "active",
      isActive: true,
      subjectTemplate: "Purchase Order {{po_number}} from ManufactureOS",
      bodyHtmlTemplate: "<p>Hello {{vendor_name}},</p><p>Please find attached PO {{po_number}}.</p>",
      bodyTextTemplate: "Hello {{vendor_name}}, Please find attached PO {{po_number}}.",
      createdBy: systemUserId,
    },
  ]).returning();

  await db.update(commEmailTemplatesTable).set({ activeVersionId: seedTemplateVersion.id }).where(eq(commEmailTemplatesTable.id, seedTemplate.id));

  const [conversation] = await db.insert(commEmailConversationsTable).values([
    {
      conversationKey: crypto.randomUUID(),
      subject: "PO-1001 transmittal",
      status: "active",
      tenantId: "default",
      createdBy: systemUserId,
      lastMessageAt: new Date(),
    },
  ]).returning();

  const [seedMessage] = await db.insert(commEmailMessagesTable).values([
    {
      direction: "outbound",
      status: "sent",
      subject: "Purchase Order PO-1001 from ManufactureOS",
      bodyHtml: "<p>Attached is PO-1001 for steel restock.</p>",
      bodyText: "Attached is PO-1001 for steel restock.",
      fromAddress: "purchasing@manufactureos.com",
      replyTo: "buyer@manufactureos.com",
      messageId: `<${crypto.randomUUID()}@manufactureos.local>`,
      conversationId: conversation.id,
      templateId: seedTemplate.id,
      templateVersionId: seedTemplateVersion.id,
      providerName: "mock",
      sourceModule: "purchaseorders",
      sourceAction: "send",
      createdBy: systemUserId,
      tenantId: "default",
      queuedAt: new Date("2026-03-10T10:00:00.000Z"),
      sentAt: new Date("2026-03-10T10:01:00.000Z"),
    },
  ]).returning();

  await db.insert(commEmailRecipientsTable).values([
    {
      messageId: seedMessage.id,
      recipientType: "to",
      emailAddress: "orders@steelco.com",
      displayName: "SteelCo Purchasing",
      deliveryStatus: "delivered",
      deliveredAt: new Date("2026-03-10T10:02:00.000Z"),
      sortOrder: 0,
    },
  ]);

  await db.insert(commEmailContextLinksTable).values([
    {
      messageId: seedMessage.id,
      entityType: "vendor",
      entityId: vend1.id,
      relatedEntityType: "purchase_order",
      relatedEntityId: po1.id,
      linkRole: "primary",
      tenantId: "default",
      createdBy: systemUserId,
    },
  ]);

  // Email sequences + enrollment
  const [sequence] = await db.insert(emailSequencesTable).values([
    {
      name: "Overdue Payment Reminder",
      description: "Three-touch reminder sequence for overdue invoices.",
      module: "invoicing",
      entryEntityType: "customer",
      isActive: true,
      createdBy: systemUserId,
    },
  ]).returning();

  await db.insert(emailSequenceStepsTable).values([
    {
      sequenceId: sequence.id,
      stepNumber: 1,
      templateId: seedTemplate.id,
      subjectOverride: "Reminder: Outstanding balance",
      bodyTextOverride: "Friendly reminder: your invoice is overdue.",
      delayDays: 0,
      trackingEnabled: true,
    },
    {
      sequenceId: sequence.id,
      stepNumber: 2,
      templateId: seedTemplate.id,
      subjectOverride: "Second notice: Outstanding balance",
      bodyTextOverride: "Please review overdue invoice details.",
      delayDays: 7,
      trackingEnabled: true,
    },
  ]);

  await db.insert(emailSequenceEnrollmentsTable).values([
    {
      sequenceId: sequence.id,
      entityType: "customer",
      entityId: cust2.id,
      status: "active",
      currentStep: 1,
      sentCount: 0,
      nextSendAt: new Date("2026-03-22T09:00:00.000Z"),
      createdBy: systemUserId,
    },
  ]);

  // Automation rule
  await db.insert(automationRulesTable).values([
    {
      name: "Overdue task escalation",
      description: "If task is overdue by 2+ days, notify owner and planner queue.",
      triggerEvent: "task.overdue",
      conditionJson: { status: "open", overdueDays: { gte: 2 } },
      actionJson: { type: "notify", channel: "in_app", targets: ["assignee", "planner"] },
      isActive: true,
      createdBy: systemUserId,
    },
  ]);

  // Timeline + Chat
  await db.insert(activityTimelineTable).values([
    {
      entityType: "customer",
      entityId: cust1.id,
      activityType: "task",
      sourceType: "task",
      sourceId: task1.id,
      title: `Task created: ${task1.title}`,
      body: task1.description,
      actorId: systemUserId,
      metadata: { status: task1.status, priority: task1.priority },
    },
    {
      entityType: "vendor",
      entityId: vend1.id,
      activityType: "email",
      sourceType: "email",
      sourceId: seedMessage.id,
      title: seedMessage.subject,
      body: "PO transmittal sent to supplier",
      actorId: systemUserId,
      metadata: { status: seedMessage.status, direction: seedMessage.direction },
    },
    {
      entityType: "opportunity",
      entityId: opp1.id,
      activityType: "opportunity",
      sourceType: "opportunity",
      sourceId: opp1.id,
      title: `Opportunity created: ${opp1.name}`,
      actorId: systemUserId,
      metadata: { stage: opp1.stage, amount: opp1.amount, probability: opp1.probability },
    },
  ]);

  const [chatLog] = await db.insert(chatLogsTable).values([
    {
      entityType: "customer",
      entityId: cust1.id,
      queryText: "List open tasks for customer Acme",
      responseText: "Acme currently has one open high-priority follow-up task due this week.",
      intent: "tasks_by_customer",
      provider: "local-fallback",
      model: "none",
      contextRows: [{ taskId: task1.id, title: task1.title, status: task1.status, priority: task1.priority }],
      responseMetadata: { seeded: true },
      createdBy: systemUserId,
      redacted: true,
    },
  ]).returning();

  await db.insert(activityTimelineTable).values([
    {
      entityType: "customer",
      entityId: cust1.id,
      activityType: "chat",
      sourceType: "chat",
      sourceId: chatLog.id,
      title: "AI queried",
      body: "List open tasks for customer Acme",
      actorId: systemUserId,
      metadata: { intent: "tasks_by_customer" },
    },
  ]);

  console.log("[seed] Demo data seeded successfully.");
}
