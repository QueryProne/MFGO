export type AppPageRoute = {
  pageId: string;
  title: string;
  route: string;
  matchPrefixes: string[];
};

export const APP_PAGE_ROUTES: AppPageRoute[] = [
  { pageId: "dashboard", title: "Dashboard", route: "/", matchPrefixes: ["/"] },
  { pageId: "customers", title: "Customers", route: "/customers", matchPrefixes: ["/customers"] },
  { pageId: "vendors", title: "Vendors", route: "/vendors", matchPrefixes: ["/vendors"] },
  { pageId: "leads", title: "Leads", route: "/leads", matchPrefixes: ["/leads"] },
  { pageId: "opportunities", title: "Opportunities", route: "/opportunities", matchPrefixes: ["/opportunities"] },
  { pageId: "salesorders", title: "Sales Orders", route: "/salesorders", matchPrefixes: ["/salesorders"] },
  { pageId: "planning", title: "Workbench", route: "/planning", matchPrefixes: ["/planning"] },
  { pageId: "purchaseorders", title: "Purchase Orders", route: "/purchaseorders", matchPrefixes: ["/purchaseorders"] },
  { pageId: "items", title: "Item Master", route: "/items", matchPrefixes: ["/items"] },
  { pageId: "boms", title: "Bills of Material", route: "/boms", matchPrefixes: ["/boms"] },
  { pageId: "workcenters", title: "Work Centers", route: "/workcenters", matchPrefixes: ["/workcenters"] },
  { pageId: "workorders", title: "Work Orders", route: "/workorders", matchPrefixes: ["/workorders"] },
  { pageId: "serviceorders", title: "Service Orders", route: "/serviceorders", matchPrefixes: ["/serviceorders"] },
  { pageId: "inventory", title: "Inventory", route: "/inventory", matchPrefixes: ["/inventory"] },
  { pageId: "shipments", title: "Shipping", route: "/shipments", matchPrefixes: ["/shipments"] },
  { pageId: "invoices", title: "Invoicing", route: "/invoices", matchPrefixes: ["/invoices"] },
  { pageId: "quality", title: "Quality", route: "/quality", matchPrefixes: ["/quality"] },
  { pageId: "copilot", title: "AI Copilot", route: "/copilot", matchPrefixes: ["/copilot"] },
  { pageId: "smarttransfer", title: "Smart Transfer", route: "/smarttransfer", matchPrefixes: ["/smarttransfer"] },
  { pageId: "administration", title: "Administration", route: "/admin", matchPrefixes: ["/admin", "/custom-forms"] },
];

export function resolvePageIdFromLocation(location: string): AppPageRoute | null {
  const path = (location.split("?")[0] ?? "").trim() || "/";
  if (path === "/") {
    return APP_PAGE_ROUTES.find((entry) => entry.pageId === "dashboard") ?? null;
  }

  return (
    APP_PAGE_ROUTES.find((entry) => entry.matchPrefixes.some((prefix) => prefix !== "/" && path.startsWith(prefix))) ??
    null
  );
}
