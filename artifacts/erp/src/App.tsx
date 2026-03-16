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
import ItemsList from "@/pages/inventory/items";
import SalesOrdersList from "@/pages/sales/orders";
import WorkOrdersList from "@/pages/production/work-orders";
import MrpDashboard from "@/pages/mrp/mrp-dashboard";
import PurchaseOrdersPage from "@/pages/purchasing";
import InventoryPage from "@/pages/inventory";
import ShippingPage from "@/pages/shipping";
import InvoicingPage from "@/pages/invoicing";
import QualityPage from "@/pages/quality";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function PlaceholderPage({ title }: { title: string }) {
  return (
    <div className="flex items-center justify-center h-full p-8 animate-in fade-in">
      <div className="text-center space-y-3">
        <h2 className="text-2xl font-display font-semibold text-foreground">{title}</h2>
        <p className="text-muted-foreground max-w-md mx-auto">This module is part of the ManufactureOS suite.</p>
      </div>
    </div>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/customers" component={CustomersList} />
      <Route path="/customers/:id" component={CustomerDetail} />
      <Route path="/salesorders" component={SalesOrdersList} />
      <Route path="/purchaseorders" component={PurchaseOrdersPage} />
      <Route path="/items" component={ItemsList} />
      <Route path="/inventory" component={InventoryPage} />
      <Route path="/workorders" component={WorkOrdersList} />
      <Route path="/shipments" component={ShippingPage} />
      <Route path="/invoices" component={InvoicingPage} />
      <Route path="/quality" component={QualityPage} />
      <Route path="/mrp" component={MrpDashboard} />
      <Route path="/boms"><PlaceholderPage title="Bill of Materials" /></Route>
      <Route path="/vendors"><PlaceholderPage title="Vendor Management" /></Route>
      <Route path="/smarttransfer"><PlaceholderPage title="Smart Transfer Engine" /></Route>
      <Route path="/admin"><PlaceholderPage title="Administration & Governance" /></Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  const sidebarStyle = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "4rem",
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
