import { Link, useLocation } from "wouter";
import { 
  LayoutDashboard, 
  Users, 
  ShoppingCart, 
  Package, 
  Wrench, 
  Boxes, 
  Truck, 
  FileText, 
  CheckSquare, 
  LineChart, 
  Database, 
  Settings 
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
} from "@/components/ui/sidebar";

const navGroups = [
  {
    label: "Core",
    items: [
      { title: "Dashboard", url: "/", icon: LayoutDashboard },
      { title: "CRM", url: "/customers", icon: Users },
      { title: "Sales", url: "/salesorders", icon: ShoppingCart },
      { title: "Purchasing", url: "/purchaseorders", icon: Package },
    ]
  },
  {
    label: "Manufacturing",
    items: [
      { title: "Item Master", url: "/items", icon: Boxes },
      { title: "Engineering", url: "/boms", icon: Wrench },
      { title: "Production", url: "/workorders", icon: Settings },
      { title: "MRP & Planning", url: "/mrp", icon: LineChart },
    ]
  },
  {
    label: "Fulfillment",
    items: [
      { title: "Inventory", url: "/inventory", icon: Boxes },
      { title: "Shipping", url: "/shipments", icon: Truck },
      { title: "Invoicing", url: "/invoices", icon: FileText },
      { title: "Quality", url: "/quality", icon: CheckSquare },
    ]
  },
  {
    label: "System",
    items: [
      { title: "Smart Transfer", url: "/smarttransfer", icon: Database },
      { title: "Administration", url: "/admin", icon: Settings },
    ]
  }
];

export function AppSidebar() {
  const [location] = useLocation();

  return (
    <Sidebar className="border-r border-border/50 bg-sidebar/50 backdrop-blur-xl">
      <SidebarHeader className="p-4 flex flex-row items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center border border-primary/30">
          <img src={`${import.meta.env.BASE_URL}images/logo.png`} alt="Logo" className="w-5 h-5 object-contain" />
        </div>
        <div className="flex flex-col">
          <span className="font-display font-bold text-base leading-tight tracking-tight">ManufactureOS</span>
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Enterprise ERP</span>
        </div>
      </SidebarHeader>
      
      <SidebarContent className="px-2 scrollbar-none">
        {navGroups.map((group) => (
          <SidebarGroup key={group.label} className="mt-2">
            <SidebarGroupLabel className="text-xs uppercase tracking-wider text-muted-foreground/70 font-semibold px-3 mb-1">
              {group.label}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => {
                  const isActive = location === item.url || (item.url !== "/" && location.startsWith(item.url));
                  return (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton 
                        asChild 
                        isActive={isActive}
                        className={`
                          transition-all duration-200 group rounded-lg h-9 my-[1px]
                          ${isActive ? 'bg-primary/10 text-primary font-medium border border-primary/20 shadow-sm' : 'text-muted-foreground hover:text-foreground hover:bg-secondary/80'}
                        `}
                      >
                        <Link href={item.url} className="flex items-center gap-3 px-3">
                          <item.icon className={`w-4 h-4 transition-colors ${isActive ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'}`} />
                          <span className="text-sm">{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
    </Sidebar>
  );
}
