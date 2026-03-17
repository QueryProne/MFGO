import { db } from "@workspace/db";
import {
  itemsTable, bomsTable, bomLinesTable, warehousesTable, stockLocationsTable, binsTable,
  inventoryBalancesTable, inventoryLotsTable, inventorySerialsTable,
  vendorsTable, vendorAddressesTable, vendorContactsTable,
  customersTable, customerAddressesTable, customerContactsTable,
  purchaseOrdersTable, purchaseOrderLinesTable, itemVendorsTable,
  receiptsTable, receiptLinesTable,
  workOrdersTable, workOrderMaterialsTable, workOrderMaterialIssuesTable,
} from "@workspace/db";
import { eq, sql } from "drizzle-orm";

export async function seedGoKart() {
  const exists = await db.select({ count: sql<number>`count(*)` })
    .from(itemsTable).where(eq(itemsTable.number, "GK-1000"));
  if (Number(exists[0]?.count ?? 0) > 0) {
    console.log("[gokart-seed] Go-kart data already exists, skipping.");
    return;
  }

  console.log("[gokart-seed] Seeding go-kart BOM and master data...");

  // ─────────────────────────────────────────────────────────────────────────
  // EXTENDED VENDORS
  // ─────────────────────────────────────────────────────────────────────────
  const [vend3, vend4, vend5] = await db.insert(vendorsTable).values([
    {
      number: "V-1003", name: "Midwest Steel Supply", status: "active",
      vendorType: "material_supplier", email: "orders@midweststeel.com",
      phone: "312-555-2001", currency: "USD", paymentTerms: "Net 30",
      isApproved: true, isPreferred: false, leadTime: 5,
      billingAddress: "2200 Steel Ave, Chicago, IL 60601",
      notes: "Primary steel tubing and flat bar supplier",
    },
    {
      number: "V-1004", name: "PowerDrive Engines Inc", status: "active",
      vendorType: "component_supplier", email: "sales@powerdrive.com",
      phone: "419-555-3002", currency: "USD", paymentTerms: "Net 45",
      isApproved: true, isPreferred: true, leadTime: 14,
      billingAddress: "800 Engine Blvd, Toledo, OH 43601",
      notes: "Preferred engine and drivetrain supplier",
    },
    {
      number: "V-1005", name: "ProKart Components LLC", status: "active",
      vendorType: "component_supplier", email: "procurement@prokart.com",
      phone: "248-555-4003", currency: "USD", paymentTerms: "Net 30",
      isApproved: true, isPreferred: false, leadTime: 7,
      billingAddress: "450 Kart Way, Rochester Hills, MI 48307",
      notes: "Kart-specific hardware, wheels, brakes",
    },
  ]).returning();

  // Vendor addresses
  await db.insert(vendorAddressesTable).values([
    { id: crypto.randomUUID(), vendorId: vend3.id, addressType: "remit_to", name: "Midwest Steel - Remit", line1: "PO Box 5501", city: "Chicago", state: "IL", postalCode: "60601", country: "US", isDefault: true },
    { id: crypto.randomUUID(), vendorId: vend3.id, addressType: "ship_from", name: "Midwest Steel - Ship From", line1: "2200 Steel Ave", city: "Chicago", state: "IL", postalCode: "60601", country: "US", isDefault: false },
    { id: crypto.randomUUID(), vendorId: vend4.id, addressType: "remit_to", name: "PowerDrive - Remit", line1: "800 Engine Blvd", city: "Toledo", state: "OH", postalCode: "43601", country: "US", isDefault: true },
    { id: crypto.randomUUID(), vendorId: vend5.id, addressType: "remit_to", name: "ProKart - Remit", line1: "450 Kart Way", city: "Rochester Hills", state: "MI", postalCode: "48307", country: "US", isDefault: true },
  ]);

  // Vendor contacts
  await db.insert(vendorContactsTable).values([
    { id: crypto.randomUUID(), vendorId: vend3.id, firstName: "Dave", lastName: "Kowalski", title: "Sales Manager", department: "Sales", email: "d.kowalski@midweststeel.com", phone: "312-555-2011", isPrimary: true, isPurchasingContact: true },
    { id: crypto.randomUUID(), vendorId: vend3.id, firstName: "Pam", lastName: "Nguyen", title: "Quality Manager", department: "Quality", email: "p.nguyen@midweststeel.com", phone: "312-555-2012", isQualityContact: true },
    { id: crypto.randomUUID(), vendorId: vend4.id, firstName: "Rick", lastName: "Steele", title: "Regional Sales Rep", department: "Sales", email: "r.steele@powerdrive.com", phone: "419-555-3011", isPrimary: true, isPurchasingContact: true },
    { id: crypto.randomUUID(), vendorId: vend5.id, firstName: "Lisa", lastName: "Burton", title: "Account Manager", department: "Sales", email: "l.burton@prokart.com", phone: "248-555-4011", isPrimary: true, isPurchasingContact: true },
    { id: crypto.randomUUID(), vendorId: vend5.id, firstName: "Mark", lastName: "Chen", title: "Accounts Receivable", department: "Finance", email: "m.chen@prokart.com", phone: "248-555-4012", isAccountingContact: true },
  ]);

  // ─────────────────────────────────────────────────────────────────────────
  // EXTENDED CUSTOMERS (addresses + contacts for existing)
  // ─────────────────────────────────────────────────────────────────────────
  const existingCustomers = await db.select().from(customersTable);
  const cust1 = existingCustomers.find(c => c.number === "C-1001");
  const cust2 = existingCustomers.find(c => c.number === "C-1002");
  const cust3 = existingCustomers.find(c => c.number === "C-1003");

  if (cust1) {
    await db.insert(customerAddressesTable).values([
      { id: crypto.randomUUID(), customerId: cust1.id, addressType: "bill_to", name: "Accounts Payable", line1: "200 Factory Row", city: "Detroit", state: "MI", postalCode: "48201", country: "US", isDefault: true },
      { id: crypto.randomUUID(), customerId: cust1.id, addressType: "ship_to", name: "Receiving Dock A", line1: "202 Factory Row - Dock A", city: "Detroit", state: "MI", postalCode: "48201", country: "US", isDefault: true },
    ]).onConflictDoNothing();
    await db.insert(customerContactsTable).values([
      { id: crypto.randomUUID(), customerId: cust1.id, firstName: "Janet", lastName: "Harris", title: "Purchasing Manager", department: "Procurement", email: "j.harris@acmeindustrial.com", phone: "313-555-0110", isPrimary: true, isSalesContact: true },
      { id: crypto.randomUUID(), customerId: cust1.id, firstName: "Bob", lastName: "Lawson", title: "AP Manager", department: "Finance", email: "b.lawson@acmeindustrial.com", phone: "313-555-0111", isAccountingContact: true },
    ]).onConflictDoNothing();
  }

  if (cust2) {
    await db.insert(customerAddressesTable).values([
      { id: crypto.randomUUID(), customerId: cust2.id, addressType: "bill_to", name: "Billing", line1: "450 Construction Ave", city: "Pontiac", state: "MI", postalCode: "48342", country: "US", isDefault: true },
      { id: crypto.randomUUID(), customerId: cust2.id, addressType: "ship_to", name: "Warehouse", line1: "460 Warehouse Rd", city: "Pontiac", state: "MI", postalCode: "48342", country: "US", isDefault: true },
    ]).onConflictDoNothing();
    await db.insert(customerContactsTable).values([
      { id: crypto.randomUUID(), customerId: cust2.id, firstName: "Tom", lastName: "Rivera", title: "Operations Director", department: "Operations", email: "t.rivera@buildright.com", phone: "248-555-0210", isPrimary: true, isSalesContact: true },
    ]).onConflictDoNothing();
  }

  if (cust3) {
    await db.insert(customerAddressesTable).values([
      { id: crypto.randomUUID(), customerId: cust3.id, addressType: "bill_to", name: "Accounts Payable", line1: "1100 Tech Drive", city: "Ann Arbor", state: "MI", postalCode: "48108", country: "US", isDefault: true },
      { id: crypto.randomUUID(), customerId: cust3.id, addressType: "ship_to", name: "Engineering Receiving", line1: "1102 Tech Drive Dock", city: "Ann Arbor", state: "MI", postalCode: "48108", country: "US", isDefault: true },
      { id: crypto.randomUUID(), customerId: cust3.id, addressType: "service_site", name: "Test Facility", line1: "1200 Test Range Rd", city: "Ypsilanti", state: "MI", postalCode: "48198", country: "US", isDefault: false },
    ]).onConflictDoNothing();
    await db.insert(customerContactsTable).values([
      { id: crypto.randomUUID(), customerId: cust3.id, firstName: "Sandra", lastName: "Park", title: "Chief Procurement Officer", department: "Procurement", email: "s.park@precisiondyn.com", phone: "734-555-0310", isPrimary: true, isSalesContact: true },
      { id: crypto.randomUUID(), customerId: cust3.id, firstName: "Kevin", lastName: "Walsh", title: "Quality Engineer", department: "Engineering", email: "k.walsh@precisiondyn.com", phone: "734-555-0311", isServiceContact: true },
      { id: crypto.randomUUID(), customerId: cust3.id, firstName: "Amy", lastName: "Chen", title: "Finance Director", department: "Finance", email: "a.chen@precisiondyn.com", phone: "734-555-0312", isAccountingContact: true },
    ]).onConflictDoNothing();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // WAREHOUSES — add stock locations & bins
  // ─────────────────────────────────────────────────────────────────────────
  const warehouses = await db.select().from(warehousesTable);
  const mainWH = warehouses.find(w => w.code === "MAIN");
  const qcWH = warehouses.find(w => w.code === "QCHOLD");

  let recvLoc: any, rawLoc: any, wipLoc: any, fgLoc: any, shipLoc: any, qcLoc: any;

  if (mainWH) {
    const [lRecv, lRaw, lWip, lFg, lShip] = await db.insert(stockLocationsTable).values([
      { id: crypto.randomUUID(), warehouseId: mainWH.id, code: "RECV", name: "Receiving Dock", locationType: "receiving", isPickable: false, isPutaway: true, isNettable: false },
      { id: crypto.randomUUID(), warehouseId: mainWH.id, code: "RM-A1", name: "Raw Material - Aisle A", locationType: "raw_material", isPickable: true, isPutaway: true, isNettable: true },
      { id: crypto.randomUUID(), warehouseId: mainWH.id, code: "WIP-01", name: "WIP Area", locationType: "wip", isPickable: true, isPutaway: true, isNettable: false },
      { id: crypto.randomUUID(), warehouseId: mainWH.id, code: "FG-01", name: "Finished Goods", locationType: "finished_goods", isPickable: true, isPutaway: true, isNettable: true },
      { id: crypto.randomUUID(), warehouseId: mainWH.id, code: "SHIP", name: "Shipping Staging", locationType: "shipping", isPickable: true, isPutaway: false, isNettable: false },
    ]).returning();
    recvLoc = lRecv; rawLoc = lRaw; wipLoc = lWip; fgLoc = lFg; shipLoc = lShip;

    // Bins
    await db.insert(binsTable).values([
      { id: crypto.randomUUID(), stockLocationId: rawLoc.id, warehouseId: mainWH.id, code: "A1-01", description: "Aisle A, Bay 1", binType: "storage", isPickable: true, isPutaway: true, isNettable: true },
      { id: crypto.randomUUID(), stockLocationId: rawLoc.id, warehouseId: mainWH.id, code: "A1-02", description: "Aisle A, Bay 2", binType: "storage", isPickable: true, isPutaway: true, isNettable: true },
      { id: crypto.randomUUID(), stockLocationId: rawLoc.id, warehouseId: mainWH.id, code: "A1-03", description: "Aisle A, Bay 3", binType: "storage", isPickable: true, isPutaway: true, isNettable: true },
      { id: crypto.randomUUID(), stockLocationId: fgLoc.id, warehouseId: mainWH.id, code: "FG-01-A", description: "FG Rack A", binType: "storage", isPickable: true, isPutaway: true, isNettable: true },
      { id: crypto.randomUUID(), stockLocationId: fgLoc.id, warehouseId: mainWH.id, code: "FG-01-B", description: "FG Rack B", binType: "storage", isPickable: true, isPutaway: true, isNettable: true },
    ]);
  }

  if (qcWH) {
    const [lQc] = await db.insert(stockLocationsTable).values([
      { id: crypto.randomUUID(), warehouseId: qcWH.id, code: "QC-HOLD", name: "QC Hold", locationType: "quarantine", isPickable: false, isPutaway: true, isNettable: false },
    ]).returning();
    qcLoc = lQc;
    await db.insert(binsTable).values([
      { id: crypto.randomUUID(), stockLocationId: qcLoc.id, warehouseId: qcWH.id, code: "QC-H-01", description: "QC Hold Shelf 1", binType: "quarantine", isPickable: false, isPutaway: true, isNettable: false },
    ]);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // GO-KART ITEMS — 6 BOM levels
  // ─────────────────────────────────────────────────────────────────────────

  // LEVEL 0 — Top-level finished good
  const [gokart] = await db.insert(itemsTable).values([
    { number: "GK-1000", name: "Racing Go-Kart Model R1", type: "finished_good", supplyType: "manufactured", makeBuy: "make", uom: "EA", description: "Complete racing go-kart with 9HP engine, serial tracked", standardCost: "1850.00", listPrice: "3499.00", status: "active", serialTracked: true, revision: "A" },
  ]).returning();

  // LEVEL 1 — Major subassemblies
  const [frameAssy, powertrainAssy, steeringAssy, brakeSystem, electricalSys, seatAssy, bodyKit] = await db.insert(itemsTable).values([
    { number: "GK-FRAME-100", name: "Go-Kart Frame Assembly", type: "manufactured", supplyType: "subassembly_order_built", makeBuy: "make", uom: "EA", standardCost: "380.00", status: "active", lotTracked: true, revision: "A" },
    { number: "GK-PWR-100", name: "Powertrain Assembly", type: "manufactured", supplyType: "subassembly_order_built", makeBuy: "make", uom: "EA", standardCost: "520.00", status: "active", revision: "A" },
    { number: "GK-STR-100", name: "Steering Assembly", type: "manufactured", supplyType: "subassembly_stocked", makeBuy: "make", uom: "EA", standardCost: "185.00", status: "active", revision: "A" },
    { number: "GK-BRK-100", name: "Brake System", type: "manufactured", supplyType: "subassembly_stocked", makeBuy: "make", uom: "EA", standardCost: "145.00", status: "active", revision: "A" },
    { number: "GK-ELEC-100", name: "Electrical System", type: "manufactured", supplyType: "subassembly_order_built", makeBuy: "make", uom: "EA", standardCost: "95.00", status: "active", revision: "A" },
    { number: "GK-SEAT-100", name: "Seat Assembly", type: "purchased_part", supplyType: "purchased", makeBuy: "buy", uom: "EA", standardCost: "75.00", status: "active", leadTime: 7, revision: "A" },
    { number: "GK-BODY-100", name: "Body Kit", type: "purchased_part", supplyType: "purchased", makeBuy: "buy", uom: "SET", standardCost: "120.00", status: "active", leadTime: 10, revision: "A" },
  ]).returning();

  // LEVEL 2 — Sub-subassemblies + components
  const [frameWeld, frameTubeSet, engineMotor, chainDrive, steeringCol, brakeCalFL, brakeCalFR, wheelRim, tire, hubWheel, wiringHarness, battery12v] = await db.insert(itemsTable).values([
    { number: "GK-FW-200", name: "Frame Weldment", type: "manufactured", supplyType: "manufactured", makeBuy: "make", uom: "EA", standardCost: "220.00", status: "active", revision: "A" },
    { number: "GK-FTS-200", name: "Frame Tube Set (CrMo)", type: "raw_material", supplyType: "purchased", makeBuy: "buy", uom: "SET", standardCost: "85.00", status: "active", leadTime: 5, lotTracked: true, revision: "A" },
    { number: "GK-ENG-200", name: "9HP OHV Engine", type: "purchased_part", supplyType: "purchased", makeBuy: "buy", uom: "EA", standardCost: "285.00", status: "active", leadTime: 14, serialTracked: true, revision: "A" },
    { number: "GK-CHN-200", name: "Chain Drive Assembly #35", type: "purchased_part", supplyType: "purchased", makeBuy: "buy", uom: "EA", standardCost: "45.00", status: "active", leadTime: 5, revision: "A" },
    { number: "GK-SC-200", name: "Steering Column Assy", type: "manufactured", supplyType: "manufactured", makeBuy: "make", uom: "EA", standardCost: "95.00", status: "active", revision: "A" },
    { number: "GK-BK-FL-200", name: "Brake Caliper Front Left", type: "purchased_part", supplyType: "purchased", makeBuy: "buy", uom: "EA", standardCost: "28.00", status: "active", leadTime: 7, revision: "A" },
    { number: "GK-BK-FR-200", name: "Brake Caliper Front Right", type: "purchased_part", supplyType: "purchased", makeBuy: "buy", uom: "EA", standardCost: "28.00", status: "active", leadTime: 7, revision: "A" },
    { number: "GK-RIM-200", name: "Wheel Rim 10\" Alloy", type: "purchased_part", supplyType: "purchased", makeBuy: "buy", uom: "EA", standardCost: "18.00", status: "active", leadTime: 7, revision: "A" },
    { number: "GK-TIRE-200", name: "Racing Tire 10x2.8-5", type: "purchased_part", supplyType: "purchased", makeBuy: "buy", uom: "EA", standardCost: "12.00", status: "active", leadTime: 5, revision: "A" },
    { number: "GK-HUB-200", name: "Wheel Hub Assembly", type: "manufactured", supplyType: "manufactured", makeBuy: "make", uom: "EA", standardCost: "38.00", status: "active", revision: "A" },
    { number: "GK-WH-200", name: "Wiring Harness", type: "manufactured", supplyType: "manufactured", makeBuy: "make", uom: "EA", standardCost: "42.00", status: "active", revision: "A" },
    { number: "GK-BAT-200", name: "Battery 12V 7Ah", type: "purchased_part", supplyType: "purchased", makeBuy: "buy", uom: "EA", standardCost: "22.00", status: "active", leadTime: 3, lotTracked: true, revision: "A" },
  ]).returning();

  // LEVEL 3 — Components for subassemblies
  const [frameGussetKit, weldBracketSet, spindleFront, tieRodAssy, brakeLineSet, brakePadSet, hubBearing, wireHarnessLoom, connectorKit] = await db.insert(itemsTable).values([
    { number: "GK-GUS-300", name: "Frame Gusset Kit", type: "purchased_part", supplyType: "purchased", makeBuy: "buy", uom: "KIT", standardCost: "32.00", status: "active", leadTime: 5, revision: "A" },
    { number: "GK-WB-300", name: "Weld Bracket Set", type: "purchased_part", supplyType: "purchased", makeBuy: "buy", uom: "SET", standardCost: "18.00", status: "active", leadTime: 5, revision: "A" },
    { number: "GK-SP-300", name: "Front Spindle", type: "manufactured", supplyType: "manufactured", makeBuy: "make", uom: "EA", standardCost: "52.00", status: "active", revision: "A" },
    { number: "GK-TR-300", name: "Tie Rod Assembly", type: "manufactured", supplyType: "manufactured", makeBuy: "make", uom: "EA", standardCost: "28.00", status: "active", revision: "A" },
    { number: "GK-BL-300", name: "Brake Line Set", type: "purchased_part", supplyType: "purchased", makeBuy: "buy", uom: "SET", standardCost: "14.00", status: "active", leadTime: 5, revision: "A" },
    { number: "GK-BP-300", name: "Brake Pad Set (4pcs)", type: "purchased_part", supplyType: "purchased", makeBuy: "buy", uom: "SET", standardCost: "9.00", status: "active", leadTime: 3, revision: "A" },
    { number: "GK-HB-300", name: "Wheel Hub Bearing 6201", type: "purchased_part", supplyType: "purchased", makeBuy: "buy", uom: "EA", standardCost: "4.50", status: "active", leadTime: 3, revision: "A" },
    { number: "GK-WHL-300", name: "Wire Harness Loom (2m)", type: "purchased_part", supplyType: "purchased", makeBuy: "buy", uom: "EA", standardCost: "8.00", status: "active", leadTime: 3, revision: "A" },
    { number: "GK-CONN-300", name: "Connector Kit Phantom", type: "purchased_part", supplyType: "phantom", makeBuy: "buy", uom: "KIT", standardCost: "5.50", status: "active", revision: "A" },
  ]).returning();

  // LEVEL 4 — Deep components
  const [spindleBlank, spindleBearingSet, tieRodEndLH, tieRodEndRH, tieRodTube] = await db.insert(itemsTable).values([
    { number: "GK-SB-400", name: "Spindle Blank 4140 Steel", type: "raw_material", supplyType: "purchased", makeBuy: "buy", uom: "EA", standardCost: "18.00", status: "active", leadTime: 7, lotTracked: true, revision: "A" },
    { number: "GK-SBS-400", name: "Spindle Bearing Set", type: "purchased_part", supplyType: "purchased", makeBuy: "buy", uom: "SET", standardCost: "12.00", status: "active", leadTime: 3, revision: "A" },
    { number: "GK-TRE-LH-400", name: "Tie Rod End LH", type: "purchased_part", supplyType: "purchased", makeBuy: "buy", uom: "EA", standardCost: "6.50", status: "active", leadTime: 3, revision: "A" },
    { number: "GK-TRE-RH-400", name: "Tie Rod End RH", type: "purchased_part", supplyType: "purchased", makeBuy: "buy", uom: "EA", standardCost: "6.50", status: "active", leadTime: 3, revision: "A" },
    { number: "GK-TRT-400", name: "Tie Rod Tube 3/8\" CrMo", type: "manufactured", supplyType: "manufactured", makeBuy: "make", uom: "EA", standardCost: "8.50", status: "active", revision: "A" },
  ]).returning();

  // LEVEL 5 — Very deep
  const [tieRodTubeBlank, hexJamNut] = await db.insert(itemsTable).values([
    { number: "GK-TRB-500", name: "Tie Rod Tube Blank 3/8\" x 12\"", type: "raw_material", supplyType: "purchased", makeBuy: "buy", uom: "EA", standardCost: "2.50", status: "active", leadTime: 5, lotTracked: true, revision: "A" },
    { number: "GK-HJN-500", name: "Hex Jam Nut 7/16-20", type: "purchased_part", supplyType: "purchased", makeBuy: "buy", uom: "EA", standardCost: "0.35", status: "active", leadTime: 3, revision: "A" },
  ]).returning();

  // LEVEL 6 — Standard fasteners (phantom/common)
  const [boltM6, nutM6] = await db.insert(itemsTable).values([
    { number: "STD-BOLT-M6", name: "Bolt M6x20 Gr8.8 DIN931", type: "purchased_part", supplyType: "phantom", makeBuy: "buy", uom: "EA", standardCost: "0.08", status: "active", leadTime: 1, revision: "—" },
    { number: "STD-NUT-M6", name: "Nut M6 Nyloc DIN985", type: "purchased_part", supplyType: "phantom", makeBuy: "buy", uom: "EA", standardCost: "0.06", status: "active", leadTime: 1, revision: "—" },
  ]).returning();

  // ─────────────────────────────────────────────────────────────────────────
  // BOMS
  // ─────────────────────────────────────────────────────────────────────────

  // Level 0 BOM: Go-Kart → Level 1 subassemblies
  const [gkBom] = await db.insert(bomsTable).values([
    { number: "BOM-GK-1000", itemId: gokart.id, revision: "A", status: "active", effectiveDate: "2026-01-01", notes: "Go-Kart R1 top-level BOM" },
  ]).returning();
  await db.insert(bomLinesTable).values([
    { bomId: gkBom.id, sequence: 10, itemId: frameAssy.id, quantity: "1", uom: "EA", lineType: "subassembly" },
    { bomId: gkBom.id, sequence: 20, itemId: powertrainAssy.id, quantity: "1", uom: "EA", lineType: "subassembly" },
    { bomId: gkBom.id, sequence: 30, itemId: steeringAssy.id, quantity: "1", uom: "EA", lineType: "subassembly" },
    { bomId: gkBom.id, sequence: 40, itemId: brakeSystem.id, quantity: "1", uom: "EA", lineType: "subassembly" },
    { bomId: gkBom.id, sequence: 50, itemId: electricalSys.id, quantity: "1", uom: "EA", lineType: "subassembly" },
    { bomId: gkBom.id, sequence: 60, itemId: seatAssy.id, quantity: "1", uom: "EA", lineType: "purchased_part" },
    { bomId: gkBom.id, sequence: 70, itemId: bodyKit.id, quantity: "1", uom: "SET", lineType: "purchased_part" },
  ]);

  // Frame Assembly BOM (Level 1 → Level 2)
  const [frameBom] = await db.insert(bomsTable).values([
    { number: "BOM-GK-FRAME", itemId: frameAssy.id, revision: "A", status: "active", effectiveDate: "2026-01-01" },
  ]).returning();
  await db.insert(bomLinesTable).values([
    { bomId: frameBom.id, sequence: 10, itemId: frameWeld.id, quantity: "1", uom: "EA", lineType: "subassembly" },
    { bomId: frameBom.id, sequence: 20, itemId: boltM6.id, quantity: "16", uom: "EA", lineType: "phantom", isPhantom: true },
    { bomId: frameBom.id, sequence: 30, itemId: nutM6.id, quantity: "16", uom: "EA", lineType: "phantom", isPhantom: true },
  ]);

  // Frame Weldment BOM (Level 2 → Level 3)
  const [fwBom] = await db.insert(bomsTable).values([
    { number: "BOM-GK-FW", itemId: frameWeld.id, revision: "A", status: "active", effectiveDate: "2026-01-01" },
  ]).returning();
  await db.insert(bomLinesTable).values([
    { bomId: fwBom.id, sequence: 10, itemId: frameTubeSet.id, quantity: "1", uom: "SET", lineType: "standard", componentIssuePolicy: "push" },
    { bomId: fwBom.id, sequence: 20, itemId: frameGussetKit.id, quantity: "1", uom: "KIT", lineType: "standard" },
    { bomId: fwBom.id, sequence: 30, itemId: weldBracketSet.id, quantity: "1", uom: "SET", lineType: "standard" },
  ]);

  // Powertrain BOM (Level 1 → Level 2)
  const [pwrBom] = await db.insert(bomsTable).values([
    { number: "BOM-GK-PWR", itemId: powertrainAssy.id, revision: "A", status: "active", effectiveDate: "2026-01-01" },
  ]).returning();
  await db.insert(bomLinesTable).values([
    { bomId: pwrBom.id, sequence: 10, itemId: engineMotor.id, quantity: "1", uom: "EA", lineType: "standard" },
    { bomId: pwrBom.id, sequence: 20, itemId: chainDrive.id, quantity: "1", uom: "EA", lineType: "standard" },
  ]);

  // Steering Assembly BOM (Level 1 → Level 2)
  const [strBom] = await db.insert(bomsTable).values([
    { number: "BOM-GK-STR", itemId: steeringAssy.id, revision: "A", status: "active", effectiveDate: "2026-01-01" },
  ]).returning();
  await db.insert(bomLinesTable).values([
    { bomId: strBom.id, sequence: 10, itemId: steeringCol.id, quantity: "1", uom: "EA", lineType: "subassembly" },
  ]);

  // Steering Column BOM (Level 2 → Level 3)
  const [scBom] = await db.insert(bomsTable).values([
    { number: "BOM-GK-SC", itemId: steeringCol.id, revision: "A", status: "active", effectiveDate: "2026-01-01" },
  ]).returning();
  await db.insert(bomLinesTable).values([
    { bomId: scBom.id, sequence: 10, itemId: spindleFront.id, quantity: "2", uom: "EA", lineType: "standard" },
    { bomId: scBom.id, sequence: 20, itemId: tieRodAssy.id, quantity: "2", uom: "EA", lineType: "standard" },
  ]);

  // Tie Rod Assembly BOM (Level 3 → Level 4)
  const [trBom] = await db.insert(bomsTable).values([
    { number: "BOM-GK-TR", itemId: tieRodAssy.id, revision: "A", status: "active", effectiveDate: "2026-01-01" },
  ]).returning();
  await db.insert(bomLinesTable).values([
    { bomId: trBom.id, sequence: 10, itemId: tieRodTube.id, quantity: "1", uom: "EA", lineType: "subassembly" },
    { bomId: trBom.id, sequence: 20, itemId: tieRodEndLH.id, quantity: "1", uom: "EA", lineType: "standard" },
    { bomId: trBom.id, sequence: 30, itemId: tieRodEndRH.id, quantity: "1", uom: "EA", lineType: "standard" },
    { bomId: trBom.id, sequence: 40, itemId: hexJamNut.id, quantity: "4", uom: "EA", lineType: "standard" },
  ]);

  // Tie Rod Tube BOM (Level 4 → Level 5)
  const [trtBom] = await db.insert(bomsTable).values([
    { number: "BOM-GK-TRT", itemId: tieRodTube.id, revision: "A", status: "active", effectiveDate: "2026-01-01" },
  ]).returning();
  await db.insert(bomLinesTable).values([
    { bomId: trtBom.id, sequence: 10, itemId: tieRodTubeBlank.id, quantity: "1", uom: "EA", lineType: "standard", componentIssuePolicy: "push", scrapFactor: "0.05" },
  ]);

  // Spindle BOM (Level 3 → Level 4)
  const [spBom] = await db.insert(bomsTable).values([
    { number: "BOM-GK-SP", itemId: spindleFront.id, revision: "A", status: "active", effectiveDate: "2026-01-01" },
  ]).returning();
  await db.insert(bomLinesTable).values([
    { bomId: spBom.id, sequence: 10, itemId: spindleBlank.id, quantity: "1", uom: "EA", lineType: "standard", scrapFactor: "0.08" },
    { bomId: spBom.id, sequence: 20, itemId: spindleBearingSet.id, quantity: "1", uom: "SET", lineType: "standard" },
  ]);

  // Brake System BOM (Level 1 → Level 3)
  const [brkBom] = await db.insert(bomsTable).values([
    { number: "BOM-GK-BRK", itemId: brakeSystem.id, revision: "A", status: "active", effectiveDate: "2026-01-01" },
  ]).returning();
  await db.insert(bomLinesTable).values([
    { bomId: brkBom.id, sequence: 10, itemId: brakeCalFL.id, quantity: "1", uom: "EA", lineType: "standard" },
    { bomId: brkBom.id, sequence: 20, itemId: brakeCalFR.id, quantity: "1", uom: "EA", lineType: "standard" },
    { bomId: brkBom.id, sequence: 30, itemId: brakeLineSet.id, quantity: "1", uom: "SET", lineType: "standard" },
    { bomId: brkBom.id, sequence: 40, itemId: brakePadSet.id, quantity: "2", uom: "SET", lineType: "standard" },
  ]);

  // Wheel Hub BOM (Level 2 → Level 3)
  const [hubBom] = await db.insert(bomsTable).values([
    { number: "BOM-GK-HUB", itemId: hubWheel.id, revision: "A", status: "active", effectiveDate: "2026-01-01" },
  ]).returning();
  await db.insert(bomLinesTable).values([
    { bomId: hubBom.id, sequence: 10, itemId: wheelRim.id, quantity: "1", uom: "EA", lineType: "standard" },
    { bomId: hubBom.id, sequence: 20, itemId: tire.id, quantity: "1", uom: "EA", lineType: "standard" },
    { bomId: hubBom.id, sequence: 30, itemId: hubBearing.id, quantity: "2", uom: "EA", lineType: "standard" },
  ]);

  // Electrical System BOM (Level 1 → Level 2)
  const [elecBom] = await db.insert(bomsTable).values([
    { number: "BOM-GK-ELEC", itemId: electricalSys.id, revision: "A", status: "active", effectiveDate: "2026-01-01" },
  ]).returning();
  await db.insert(bomLinesTable).values([
    { bomId: elecBom.id, sequence: 10, itemId: wiringHarness.id, quantity: "1", uom: "EA", lineType: "subassembly" },
    { bomId: elecBom.id, sequence: 20, itemId: battery12v.id, quantity: "1", uom: "EA", lineType: "standard" },
  ]);

  // Wiring Harness BOM (Level 2 → Level 3)
  const [whBom] = await db.insert(bomsTable).values([
    { number: "BOM-GK-WH", itemId: wiringHarness.id, revision: "A", status: "active", effectiveDate: "2026-01-01" },
  ]).returning();
  await db.insert(bomLinesTable).values([
    { bomId: whBom.id, sequence: 10, itemId: wireHarnessLoom.id, quantity: "2", uom: "EA", lineType: "standard" },
    { bomId: whBom.id, sequence: 20, itemId: connectorKit.id, quantity: "1", uom: "KIT", lineType: "phantom", isPhantom: true },
  ]);

  // ─────────────────────────────────────────────────────────────────────────
  // ITEM-VENDOR ASSIGNMENTS
  // ─────────────────────────────────────────────────────────────────────────
  const existingVendors = await db.select().from(vendorsTable);
  const v1001 = existingVendors.find(v => v.number === "V-1001");
  const v1002 = existingVendors.find(v => v.number === "V-1002");

  await db.insert(itemVendorsTable).values([
    { id: crypto.randomUUID(), itemId: frameTubeSet.id, vendorId: vend3.id, vendorPartNumber: "MWS-CRO-SET-GK", isPreferred: true, isApproved: true, leadTimeDays: 5, minOrderQty: "1", standardCost: "88.00", lastCost: "85.00" },
    { id: crypto.randomUUID(), itemId: engineMotor.id, vendorId: vend4.id, vendorPartNumber: "PDE-9HP-OHV-GX270", isPreferred: true, isApproved: true, leadTimeDays: 14, minOrderQty: "1", standardCost: "290.00", lastCost: "285.00" },
    { id: crypto.randomUUID(), itemId: engineMotor.id, vendorId: vend5.id, vendorPartNumber: "PKC-ENG-9HP-ALT", isPreferred: false, isApproved: true, leadTimeDays: 10, minOrderQty: "1", standardCost: "295.00", lastCost: "295.00" },
    { id: crypto.randomUUID(), itemId: brakeCalFL.id, vendorId: vend5.id, vendorPartNumber: "PKC-CAL-FL-200", isPreferred: true, isApproved: true, leadTimeDays: 7, minOrderQty: "2", standardCost: "28.00", lastCost: "27.50" },
    { id: crypto.randomUUID(), itemId: brakeCalFR.id, vendorId: vend5.id, vendorPartNumber: "PKC-CAL-FR-200", isPreferred: true, isApproved: true, leadTimeDays: 7, minOrderQty: "2", standardCost: "28.00", lastCost: "27.50" },
    { id: crypto.randomUUID(), itemId: wheelRim.id, vendorId: vend5.id, vendorPartNumber: "PKC-RIM-10-ALY", isPreferred: true, isApproved: true, leadTimeDays: 7, minOrderQty: "4", standardCost: "18.00", lastCost: "17.80" },
    { id: crypto.randomUUID(), itemId: tire.id, vendorId: vend5.id, vendorPartNumber: "PKC-TIRE-10-28", isPreferred: true, isApproved: true, leadTimeDays: 5, minOrderQty: "4", standardCost: "12.00", lastCost: "11.90" },
    { id: crypto.randomUUID(), itemId: spindleBlank.id, vendorId: vend3.id, vendorPartNumber: "MWS-4140-BAR-GK", isPreferred: true, isApproved: true, leadTimeDays: 7, minOrderQty: "10", standardCost: "18.50", lastCost: "18.00", safetyStockQty: "20", reorderPointQty: "10" },
  ]);

  // ─────────────────────────────────────────────────────────────────────────
  // INVENTORY — Go-kart items
  // ─────────────────────────────────────────────────────────────────────────
  if (mainWH) {
    await db.insert(inventoryBalancesTable).values([
      { itemId: frameTubeSet.id, warehouseId: mainWH.id, quantityOnHand: "12", quantityAllocated: "4", quantityOnOrder: "20", location: "A1-01" },
      { itemId: engineMotor.id, warehouseId: mainWH.id, quantityOnHand: "5", quantityAllocated: "3", quantityOnOrder: "5", location: "A1-02" },
      { itemId: brakeCalFL.id, warehouseId: mainWH.id, quantityOnHand: "20", quantityAllocated: "8", quantityOnOrder: "0", location: "A1-02" },
      { itemId: brakeCalFR.id, warehouseId: mainWH.id, quantityOnHand: "20", quantityAllocated: "8", quantityOnOrder: "0", location: "A1-02" },
      { itemId: wheelRim.id, warehouseId: mainWH.id, quantityOnHand: "40", quantityAllocated: "16", quantityOnOrder: "40", location: "A1-03" },
      { itemId: tire.id, warehouseId: mainWH.id, quantityOnHand: "40", quantityAllocated: "16", quantityOnOrder: "40", location: "A1-03" },
      { itemId: spindleBlank.id, warehouseId: mainWH.id, quantityOnHand: "25", quantityAllocated: "10", quantityOnOrder: "0", location: "A1-01" },
      { itemId: battery12v.id, warehouseId: mainWH.id, quantityOnHand: "15", quantityAllocated: "5", quantityOnOrder: "0", location: "A1-02" },
    ]);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // LOT RECORDS for lot-tracked items
  // ─────────────────────────────────────────────────────────────────────────
  const lots = await db.insert(inventoryLotsTable).values([
    { id: crypto.randomUUID(), itemId: frameTubeSet.id, lotNumber: "LOT-FTS-2026-001", status: "active", quantityOnHand: "12", quantityAllocated: "4", receiptDate: "2026-03-10", supplierLotNumber: "MWS-BATCH-0310" },
    { id: crypto.randomUUID(), itemId: spindleBlank.id, lotNumber: "LOT-SB-2026-001", status: "active", quantityOnHand: "25", quantityAllocated: "10", receiptDate: "2026-03-05", supplierLotNumber: "MWS-4140-B0305" },
    { id: crypto.randomUUID(), itemId: battery12v.id, lotNumber: "LOT-BAT-2026-001", status: "active", quantityOnHand: "15", quantityAllocated: "5", receiptDate: "2026-03-12", manufactureDate: "2026-02-01", expirationDate: "2029-02-01" },
  ]).returning();

  // ─────────────────────────────────────────────────────────────────────────
  // SERIAL RECORDS for serial-tracked items
  // ─────────────────────────────────────────────────────────────────────────
  if (mainWH) {
    await db.insert(inventorySerialsTable).values([
      { id: crypto.randomUUID(), itemId: engineMotor.id, serialNumber: "ENG-2026-00101", warehouseId: mainWH.id, status: "available", receiptDate: "2026-03-08" },
      { id: crypto.randomUUID(), itemId: engineMotor.id, serialNumber: "ENG-2026-00102", warehouseId: mainWH.id, status: "available", receiptDate: "2026-03-08" },
      { id: crypto.randomUUID(), itemId: engineMotor.id, serialNumber: "ENG-2026-00103", warehouseId: mainWH.id, status: "in_use", receiptDate: "2026-03-08" },
    ]);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // EXAMPLE PURCHASE ORDER for go-kart items
  // ─────────────────────────────────────────────────────────────────────────
  const [po2] = await db.insert(purchaseOrdersTable).values([
    {
      number: "PO-1002", vendorId: vend4.id, status: "sent",
      orderDate: "2026-03-14", requestedDate: "2026-03-28",
      subtotal: "2850.00", totalAmount: "2850.00",
      ...(mainWH ? { warehouseId: mainWH.id } : {}),
      notes: "Go-kart R1 engines - initial build run",
    },
  ]).returning();

  await db.insert(purchaseOrderLinesTable).values([
    { purchaseOrderId: po2.id, lineNumber: 1, itemId: engineMotor.id, quantity: "10", uom: "EA", unitCost: "285.00", lineTotal: "2850.00", requestedDate: "2026-03-28" },
  ]);

  // ─────────────────────────────────────────────────────────────────────────
  // EXAMPLE RECEIPT against PO-1002
  // ─────────────────────────────────────────────────────────────────────────
  const po2Lines = await db.select().from(purchaseOrderLinesTable).where(eq(purchaseOrderLinesTable.purchaseOrderId, po2.id));
  const po2Line = po2Lines[0];

  const [receipt1] = await db.insert(receiptsTable).values([
    {
      number: "RCT-1001", purchaseOrderId: po2.id, vendorId: vend4.id,
      status: "confirmed", receiptDate: "2026-03-20", packingSlipNumber: "PDE-PS-55102",
      ...(mainWH ? { warehouseId: mainWH.id } : {}),
      inspectionRequired: true, receivedBy: "Mike Torres",
      notes: "Initial receipt of 5 engines. 5 backordered.",
    },
  ]).returning();

  if (po2Line) {
    await db.insert(receiptLinesTable).values([
      {
        receiptId: receipt1.id, purchaseOrderLineId: po2Line.id,
        itemId: engineMotor.id, lineNumber: 1,
        receivedQty: "5", acceptedQty: "5", rejectedQty: "0",
        uom: "EA", unitCost: "285.00",
        ...(mainWH ? { warehouseId: mainWH.id } : {}),
        lotNumber: null, serialNumbers: "ENG-2026-00101,ENG-2026-00102,ENG-2026-00103,ENG-2026-00104,ENG-2026-00105",
        receiptStatus: "accepted", inspectionStatus: "passed",
        notes: "All units passed incoming inspection",
      },
    ]);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // EXAMPLE WORK ORDER for go-kart with materials + issues
  // ─────────────────────────────────────────────────────────────────────────
  const [woGK] = await db.insert(workOrdersTable).values([
    {
      number: "WO-GK-001", itemId: gokart.id, bomId: gkBom.id,
      status: "in_progress", type: "standard",
      quantityOrdered: "5", quantityCompleted: "2",
      scheduledStart: "2026-03-17", scheduledEnd: "2026-03-31",
      ...(mainWH ? { warehouseId: mainWH.id } : {}),
      priority: "high", uom: "EA",
      notes: "First production run of Go-Kart R1",
    },
  ]).returning();

  // Add material lines for top-level BOM components
  const [mat1, mat2, mat3, mat4] = await db.insert(workOrderMaterialsTable).values([
    { workOrderId: woGK.id, itemId: frameAssy.id, requiredQty: "5", issuedQty: "2", allocatedQty: "5", shortageQty: "0", supplyTypeSnapshot: "subassembly_order_built", uom: "EA", issueMethod: "push" },
    { workOrderId: woGK.id, itemId: powertrainAssy.id, requiredQty: "5", issuedQty: "2", allocatedQty: "5", shortageQty: "0", supplyTypeSnapshot: "subassembly_order_built", uom: "EA", issueMethod: "push" },
    { workOrderId: woGK.id, itemId: seatAssy.id, requiredQty: "5", issuedQty: "5", allocatedQty: "0", shortageQty: "0", supplyTypeSnapshot: "purchased", uom: "EA", issueMethod: "push" },
    { workOrderId: woGK.id, itemId: bodyKit.id, requiredQty: "5", issuedQty: "0", allocatedQty: "0", shortageQty: "5", supplyTypeSnapshot: "purchased", uom: "SET", issueMethod: "push" },
  ]).returning();

  // Material issue records
  if (mainWH) {
    await db.insert(workOrderMaterialIssuesTable).values([
      {
        workOrderId: woGK.id, workOrderMaterialId: mat3.id, itemId: seatAssy.id,
        issuedQty: "5", uom: "EA", unitCost: "75.00",
        warehouseId: mainWH.id, issueType: "issue",
        issuedBy: "Mike Torres", notes: "Seat units issued for WO-GK-001",
        issuedAt: new Date("2026-03-17T09:00:00Z"),
      },
    ]);
  }

  console.log("[gokart-seed] Go-kart data seeded successfully — 6-level BOM, 30+ items, vendor/customer addresses+contacts, lots, serials, receipt, WO.");
}
