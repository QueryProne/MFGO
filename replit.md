# ManufactureOS — Enterprise ERP

## Overview
Full-stack manufacturing ERP for small-to-medium manufacturers. Enterprise dark-mode UI, real-time data from PostgreSQL, complete module suite.

## Architecture
- **Frontend**: React + Vite (artifact `erp`, port from `PORT` env, previewPath `/`)
- **Backend**: Express 5 API server (artifact `api-server`, port 8080)
- **Database**: PostgreSQL via Drizzle ORM (`lib/db`)
- **API Client**: Auto-generated React Query hooks (`lib/api-client-react`) + custom `api.ts` client

## Modules
| Module | Route | Status |
|---|---|---|
| Dashboard | `/` | ✅ Live KPIs from DB |
| CRM / Customers | `/customers` | ✅ Full CRUD |
| Sales Orders | `/salesorders` | ✅ Full CRUD |
| Purchase Orders | `/purchaseorders` | ✅ Full CRUD |
| Item Master | `/items` | ✅ Full CRUD |
| Inventory | `/inventory` | ✅ Real-time balances |
| Work Orders | `/workorders` | ✅ Progress tracking |
| Shipping | `/shipments` | ✅ Full CRUD |
| Invoicing | `/invoices` | ✅ A/R tracking |
| Quality (Inspections + NCR) | `/quality` | ✅ Full CRUD |
| MRP & Planning | `/mrp` | ✅ Engine + runs |
| BOM / Routing | via API | ✅ Routes + models |

## Backend API Routes
All routes mount at `/api/*`:
- `/api/auth/me` — current user (static for now)
- `/api/dashboard/kpis` — aggregate metrics
- `/api/customers`, `/api/vendors`, `/api/contacts`
- `/api/items`, `/api/boms`, `/api/routings`, `/api/workcenters`
- `/api/inventory`, `/api/inventory/transactions`, `/api/inventory/warehouses`
- `/api/quotes`, `/api/salesorders`
- `/api/purchaseorders` (with `/receive` endpoint)
- `/api/workorders` (with `/complete` endpoint)
- `/api/shipments`, `/api/invoices`
- `/api/quality/inspections`, `/api/quality/nonconformances`
- `/api/mrp/runs`, `/api/mrp/recommendations`
- `/api/planning/scenarios`
- `/api/search` — global cross-entity search
- `/api/smarttransfer/jobs`, `/api/smarttransfer/mappings`
- `/api/roles`, `/api/users`

## Database Schema (lib/db/src/schema/)
- `users.ts` — users, roles
- `crm.ts` — customers, vendors, contacts
- `items.ts` — items master
- `engineering.ts` — boms, bom_lines, routings, routing_operations, workcenters
- `inventory.ts` — warehouses, inventory_balances, inventory_transactions
- `sales.ts` — quotes, quote_lines, sales_orders, sales_order_lines
- `purchasing.ts` — purchase_orders, purchase_order_lines
- `production.ts` — work_orders, work_order_operations
- `shipping.ts` — shipments, shipment_lines
- `invoices.ts` — invoices, invoice_lines (within shipping.ts)
- `quality.ts` — inspections, nonconformances
- `planning.ts` — mrp_runs, mrp_recommendations, planning_scenarios, smart_transfer_jobs, smart_transfer_mappings
- `audit.ts` — audit_logs
- `dashboard.ts` — dashboard_widgets (within audit.ts or planning.ts)

## Demo Data
Seeded on first startup via `artifacts/api-server/src/lib/seed.ts`:
- 3 customers (Acme Industrial, BuildRight, Precision Dynamics)
- 2 vendors (SteelCo Materials, FastFab Components)
- 5 items (2 raw materials, 2 manufactured, 1 finished good)
- 1 BOM + routing with 3 operations
- 5 inventory balances
- 3 sales orders (SO-1001 to SO-1003)
- 1 purchase order (PO-1001)
- 2 work orders (WO-1001 released, WO-1002 in progress at 48%)
- 1 shipment (SHP-1001 shipped via UPS Freight)
- 1 invoice (INV-1001 sent, $16,848 outstanding)
- 2 quality inspections + 1 NCR

## Design System
- Enterprise dark mode (dark bg ~#0a0a0f)
- Sidebar navigation with grouped modules
- Dense table views with color-coded status badges
- Recharts for metrics visualization
- Framer Motion for page transitions
- shadcn/ui components throughout
