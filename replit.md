# ManufactureOS — Enterprise ERP

## Overview
Full-stack manufacturing ERP for small-to-medium manufacturers. Enterprise dark-mode UI, real-time data from PostgreSQL, complete module suite.

## Architecture
- **Frontend**: React + Vite (artifact `erp`, port from `PORT` env, previewPath `/`)
- **Backend**: Express 5 API server (artifact `api-server`, port 8080)
- **Database**: PostgreSQL via Drizzle ORM (`lib/db`)
- **API Client**: Custom typed `api.ts` with React Query throughout

## Modules
| Module | Route | Status |
|---|---|---|
| Dashboard | `/` | ✅ Live KPIs from DB |
| CRM / Customers | `/customers`, `/customers/:id` | ✅ Full CRUD + addresses + contacts + sales orders |
| Vendors | `/vendors`, `/vendors/:id` | ✅ Full CRUD + addresses + contacts + POs + Preferred/Approved flags |
| Sales Orders | `/salesorders` | ✅ Full CRUD + SO→WO conversion |
| Planning & Purchasing Workbench | `/planning` | ✅ MRP + shortage analysis + release |
| Purchase Orders | `/purchaseorders` | ✅ Full CRUD |
| Receiving | `/receiving`, `/receiving/:id` | ✅ Receipts against POs + confirm flow + lot/serial tracking |
| Item Master | `/items`, `/items/:id` | ✅ Full CRUD + vendor/purchasing tab |
| Bills of Material | `/boms` | ✅ API complete, frontend placeholder |
| Work Centers | `/workcenters` | Placeholder |
| Work Orders | `/workorders`, `/workorders/:id` | ✅ Detail with materials + operations + issues |
| Service Orders | `/serviceorders` | ✅ List + SO conversion |
| Inventory | `/inventory` | ✅ Real-time balances with location hierarchy |
| Shipping | `/shipments` | ✅ Full CRUD |
| Invoicing | `/invoices` | ✅ A/R tracking |
| Quality | `/quality` | ✅ Inspections + NCR |

## Database Schema (key tables)
### Inventory Hierarchy
- `sites` → `warehouses` → `stock_locations` → `bins`
- `inventory_lots` — lot-tracked items with qty, dates, supplier lot#
- `inventory_serials` — serial-tracked items with per-unit location
- `inventory_balances` — qty-on-hand/allocated/on-order per warehouse (+ location columns)
- `inventory_transactions` — full audit trail with lot/serial/location

### CRM Extensions
- `customer_addresses` — bill_to / ship_to / service_site per customer
- `customer_contacts` — named contacts with sales/accounting/service roles
- `vendor_addresses` — remit_to / ship_from per vendor
- `vendor_contacts` — named contacts with purchasing/quality/accounting roles

### Purchasing & Receiving
- `receipts` — receipt header vs PO
- `receipt_lines` — per-item received/accepted/rejected qty, lot#, serial#s, inspection status

### Production
- `work_order_material_issues` — lot/serial/bin-level material issue records
- `work_order_completions` — partial or final WO completions with lot/serial output

## Backend API Routes
All routes mount at `/api/*`:
- `/api/auth/me` — current user session
- `/api/dashboard/kpis` — aggregate metrics
- `/api/customers`, `/api/customers/:id` (+ `/addresses`, `/contacts` sub-resources)
- `/api/vendors`, `/api/vendors/:id` (+ `/addresses`, `/contacts` sub-resources)
- `/api/contacts` — legacy flat contact list
- `/api/items` — CRUD + `/api/items/:id/vendors` (ItemVendor CRUD)
- `/api/boms`, `/api/boms/:id/lines` (inline item creation)
- `/api/routings`, `/api/workcenters`
- `/api/inventory`, `/api/inventory/transactions`, `/api/inventory/warehouses`
- `/api/warehouses`, `/api/stock-locations`, `/api/bins`
- `/api/inventory-lots`, `/api/inventory-serials`
- `/api/quotes`, `/api/salesorders`, `/api/salesorders/:id/convert-to-downstream`
- `/api/purchaseorders`
- `/api/receiving` — receipt list/create; `/api/receiving/:id` — detail; `/api/receiving/:id/confirm`
- `/api/workorders`, `/api/workorders/:id/materials`
- `/api/serviceorders`
- `/api/shipments`, `/api/invoices`
- `/api/quality/inspections`, `/api/quality/nonconformances`
- `/api/mrp/runs`, `/api/mrp/recommendations`
- `/api/planning-purchasing/workbench`, `/api/planning-purchasing/release`, `/api/planning-purchasing/exceptions`
- `/api/search` — global cross-entity search
- `/api/smarttransfer/jobs`, `/api/smarttransfer/mappings`
- `/api/roles`, `/api/users`

## Seed Data
### Base Seed (`artifacts/api-server/src/lib/seed.ts`)
- 3 customers, 2 vendors, items, BOMs, work orders, sales orders, purchase orders, inventory

### Go-Kart Seed (`artifacts/api-server/src/lib/gokart-seed.ts`)
- **Go-Kart Model R1** — 6-level BOM with 30+ items (GK-1000 → Level 1-6 sub-assemblies and components)
- Item types: manufactured, subassembly_order_built, subassembly_stocked, purchased, phantom, raw_material
- **3 enriched vendors**: Midwest Steel (V-1003), PowerDrive Engines (V-1004), ProKart Components (V-1005)
  - Each with addresses (remit_to, ship_from) and named contacts
- **Existing customers** (C-1001, C-1002, C-1003) enriched with addresses (bill_to, ship_to, service_site) and contacts
- **Warehouse hierarchy**: MAIN → RECV, RM-A1, WIP-01, FG-01, SHIP locations, with bins per location
- **Inventory lots**: Frame Tube Set, Spindle Blank, Battery 12V
- **Serial records**: 3 engine serials (ENG-2026-00101..103)
- **PO-1002**: 10x 9HP engines from PowerDrive, with **RCT-1001** (5 received, confirmed, inspection passed)
- **WO-GK-001**: Go-kart build WO in_progress with material lines and seat issue record

## Key Design Patterns
- Numeric fields from PostgreSQL come back as **strings** — wrap with `Number(...)` before math
- `supply_type` values: `purchased`, `manufactured`, `subassembly_order_built`, `subassembly_stocked`, `phantom`, `service`
- All frontend pages use `api.ts` directly (no code-gen client) with React Query
- Sidebar uses wouter `useLocation` for active state detection
- Dark mode default, enterprise dense layout, monospace part numbers
