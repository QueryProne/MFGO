import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { Topbar } from "@/components/topbar";
import NotFound from "@/pages/not-found";

// Pages
import Dashboard from "@/pages/dashboard";
import CustomersList from "@/pages/crm/customers";
import CustomerDetail from "@/pages/crm/customers/detail";
import VendorsList from "@/pages/crm/vendors";
import VendorDetail from "@/pages/crm/vendors/detail";
import LeadsListPage from "@/pages/crm/leads";
import LeadDetailPage from "@/pages/crm/leads/detail";
import OpportunitiesPage from "@/pages/crm/opportunities";
import OpportunityDetailPage from "@/pages/crm/opportunities/detail";
import ItemsList from "@/pages/inventory/items";
import ItemDetail from "@/pages/inventory/items/detail";
import SalesOrdersList from "@/pages/sales/orders";
import WorkOrdersList from "@/pages/production/work-orders";
import WorkOrderDetail from "@/pages/production/work-orders/detail";
import PurchaseOrdersPage from "@/pages/purchasing";
import InventoryPage from "@/pages/inventory";
import ShippingPage from "@/pages/shipping";
import InvoicingPage from "@/pages/invoicing";
import QualityPage from "@/pages/quality";
import PlanningPage from "@/pages/planning";
import ServiceOrdersPage from "@/pages/service-orders";
import CopilotPage from "@/pages/copilot";
import AdministrationPage from "@/pages/system/administration";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false },
  },
});

function PlaceholderPage({ title, description }: { title: string; description?: string }) {
  return (
    <div className="flex items-center justify-center h-full p-8 animate-in fade-in">
      <div className="text-center space-y-3">
        <h2 className="text-2xl font-display font-semibold text-foreground">{title}</h2>
        <p className="text-muted-foreground max-w-md mx-auto">{description ?? "This module is part of the ManufactureOS suite."}</p>
      </div>
    </div>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      {/* CRM */}
      <Route path="/customers" component={CustomersList} />
      <Route path="/customers/:id" component={CustomerDetail} />
      <Route path="/vendors" component={VendorsList} />
      <Route path="/vendors/:id" component={VendorDetail} />
      <Route path="/leads" component={LeadsListPage} />
      <Route path="/leads/:id" component={LeadDetailPage} />
      <Route path="/opportunities" component={OpportunitiesPage} />
      <Route path="/opportunities/:id" component={OpportunityDetailPage} />
      {/* Sales */}
      <Route path="/salesorders" component={SalesOrdersList} />
      {/* Planning & Purchasing */}
      <Route path="/planning" component={PlanningPage} />
      <Route path="/purchaseorders" component={PurchaseOrdersPage} />
      {/* Engineering */}
      <Route path="/items" component={ItemsList} />
      <Route path="/items/:id" component={ItemDetail} />
      <Route path="/boms"><PlaceholderPage title="Bills of Material" description="BOM management with revision control and inline part creation." /></Route>
      <Route path="/workcenters"><PlaceholderPage title="Work Centers" description="Configure manufacturing work centers and capacity." /></Route>
      {/* Production */}
      <Route path="/workorders" component={WorkOrdersList} />
      <Route path="/workorders/:id" component={WorkOrderDetail} />
      <Route path="/serviceorders" component={ServiceOrdersPage} />
      {/* Fulfillment */}
      <Route path="/inventory" component={InventoryPage} />
      <Route path="/shipments" component={ShippingPage} />
      <Route path="/invoices" component={InvoicingPage} />
      <Route path="/quality" component={QualityPage} />
      {/* System */}
      <Route path="/copilot" component={CopilotPage} />
      <Route path="/custom-forms" component={AdministrationPage} />
      <Route path="/smarttransfer"><PlaceholderPage title="Smart Transfer Engine" description="Data import, export, and ETL mapping." /></Route>
      <Route path="/admin" component={AdministrationPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  const sidebarStyle = {
    "--sidebar-width": "15rem",
    "--sidebar-width-icon": "3.5rem",
  };

  return (
    <ThemeProvider defaultTheme="dark" storageKey="manufactureos-theme">
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <SidebarProvider style={sidebarStyle as React.CSSProperties}>
              <div className="flex h-screen w-full bg-background overflow-hidden selection:bg-primary/30">
                <AppSidebar />
                <div className="flex flex-col flex-1 relative overflow-hidden">
                  <Topbar />
                  <main className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-border/50 scrollbar-track-transparent">
                    <Router />
                  </main>
                </div>
              </div>
            </SidebarProvider>
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
