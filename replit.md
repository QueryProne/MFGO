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
| CRM / Customers | `/customers`, `/customers/:id` | ✅ Full CRUD + detail |
| Sales Orders | `/salesorders` | ✅ Full CRUD + SO→WO conversion |
| Planning & Purchasing Workbench | `/planning` | ✅ MRP + shortage analysis + release |
| Purchase Orders | `/purchaseorders` | ✅ Full CRUD |
| Item Master | `/items`, `/items/:id` | ✅ Full CRUD + vendor/purchasing tab |
| Bills of Material | `/boms` | ✅ API complete, frontend placeholder |
| Work Centers | `/workcenters` | Placeholder |
| Work Orders | `/workorders`, `/workorders/:id` | ✅ Detail with materials + operations |
| Service Orders | `/serviceorders` | ✅ List + SO conversion |
| Inventory | `/inventory` | ✅ Real-time balances |
| Shipping | `/shipments` | ✅ Full CRUD |
| Invoicing | `/invoices` | ✅ A/R tracking |
| Quality | `/quality` | ✅ Inspections + NCR |

## Backend API Routes
All routes mount at `/api/*`:
- `/api/auth/me` — current user session
- `/api/dashboard/kpis` — aggregate metrics
- `/api/customers`, `/api/vendors`, `/api/contacts`
- `/api/items` — CRUD + `/api/items/:id/vendors` (ItemVendor CRUD)
- `/api/boms`, `/api/boms/:id/lines` (inline item creation)
- `/api/routings`, `/api/workcenters`
- `/api/inventory`, `/api/inventory/transactions`, `/api/inventory/warehouses`
- `/api/quotes`, `/api/salesorders`, `/api/salesorders/:id/convert-to-downstream`
- `/api/purchaseorders` (with `/receive` endpoint)
- `/api/workorders`, `/api/workorders/:id/materials`
- `/api/serviceorders`
- `/api/shipments`, `/api/invoices`
- `/api/quality/inspections`, `/api/quality/nonconformances`
- `/api/mrp/runs`, `/api/mrp/recommendations`
- `/api/planning-purchasing/workbench`, `/api/planning-purchasing/release`, `/api/planning-purchasing/exceptions`
- `/api/search` — global cross-entity search
- `/api/smarttransfer/jobs`, `/api/smarttransfer/mappings`
- `/api/roles`, `/api/users`

## Database Schema (lib/db/src/schema/)
- `users.ts` — users, roles
- `crm.ts` — customers, vendors, contacts
- `items.ts` — items master (supplyType, makeBuy fields)
- `engineering.ts` — boms (revision/status/effectivity), bom_lines (lineType/issuePolicy/phantom), routings, routing_operations, workcenters
- `inventory.ts` — warehouses, inventory_balances, inventory_transactions
- `sales.ts` — quotes, quote_lines, sales_orders, sales_order_lines
- `purchasing.ts` — purchase_orders, purchase_order_lines, **item_vendors** (new)
- `production.ts` — work_orders (salesOrderId, parentWorkOrderId pegging), work_order_operations, **work_order_materials** (new), **service_orders** (new)
- `shipping.ts` — shipments, shipment_lines
- `invoices.ts` — invoices, invoice_lines
- `quality.ts` — inspections, nonconformances
- `planning.ts` — mrp_runs, mrp_recommendations (with pegging/vendor fields), planning_scenarios
- `audit.ts` — audit_logs

## Key Business Logic
- **Item Vendor Model**: `item_vendors` table — one item, many vendors, preferred/approved flags. MRP uses preferred approved vendor lead time; raises vendor exception if none found.
- **Supply Types**: `purchased`, `manufactured`, `subassembly_stocked`, `subassembly_order_built`, `phantom`, `service`
- **SO Conversion**: `POST /api/salesorders/:id/convert-to-downstream` creates WOs/SVCs based on item supply type
- **MRP Engine**: Time-aware, demand-pegged, produces `planned_po`/`planned_wo`/`shortage`/`vendor_missing` recommendations with full supply/demand analysis
- **Work Order Materials**: BOM explosion with subassembly policy evaluation, shortage analysis

## Design System
- Enterprise dark mode (dark bg ~#0a0a0f)
- Sidebar navigation with grouped modules: Core / Planning & Purchasing / Engineering / Production / Fulfillment / System
- Dense table views with color-coded status badges
- Recharts for metrics visualization
- shadcn/ui components throughout

## Demo Data
Seeded on first startup via `artifacts/api-server/src/lib/seed.ts`:
- 3 customers, 2 vendors, 5 items (with supply types + item_vendor records)
- 1 BOM + routing with 3 operations
- 5 inventory balances (with allocated/available calculations)
- 3 sales orders, 1 purchase order
- 2 work orders (WO-1001 released, WO-1002 in progress at 48%)
- 1 shipment, 1 invoice, 2 inspections, 1 NCR
- MRP run with planning recommendations
