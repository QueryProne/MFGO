import { useParams } from "wouter";
import { useGetCustomer } from "@workspace/api-client-react";
import { PageHeader, StatusBadge } from "@/components/ui-patterns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Mail, Phone, MapPin, CreditCard, Clock, FileText, ShoppingCart } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { TaskList } from "@/components/tasks/task-list";
import { EmailComposer } from "@/components/email/email-composer";
import { AICopilotChat } from "@/components/ai/ai-copilot-chat";
import { UnifiedActivityTimeline } from "@/components/activity/unified-activity-timeline";
import { CustomFormsPanel } from "@/components/custom/custom-forms-panel";

export default function CustomerDetail() {
  const { id } = useParams();
  const { data: customer, isLoading, error } = useGetCustomer(id || "", {
    query: {
      enabled: !!id,
      queryKey: ["/api/customers", id],
    },
  });

  if (isLoading) {
    return (
      <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
        <Skeleton className="h-10 w-1/3 mb-2" />
        <Skeleton className="h-4 w-1/4 mb-8" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Skeleton className="h-[200px] rounded-xl" />
          <Skeleton className="h-[200px] md:col-span-2 rounded-xl" />
        </div>
      </div>
    );
  }

  if (error || !customer) {
    return <div className="p-8 text-center text-destructive">Failed to load customer</div>;
  }

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-300">
      <PageHeader 
        title={customer.name}
        description={`Customer ID: ${customer.number || customer.id}`}
        backUrl="/customers"
        action={
          <div className="flex items-center gap-2">
            <StatusBadge status={customer.status} />
            <Button variant="outline" size="sm">Edit</Button>
            <Button size="sm" className="shadow-md">New Order</Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="space-y-6 lg:col-span-1">
          <Card className="border-border/50 shadow-sm">
            <CardHeader className="pb-4">
              <CardTitle className="text-base font-display">Contact Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-3 text-sm">
                <Mail className="w-4 h-4 text-muted-foreground mt-0.5" />
                <div className="flex flex-col">
                  <span className="font-medium">{customer.email || 'No email provided'}</span>
                  <span className="text-xs text-muted-foreground">Primary Email</span>
                </div>
              </div>
              <div className="flex items-start gap-3 text-sm">
                <Phone className="w-4 h-4 text-muted-foreground mt-0.5" />
                <div className="flex flex-col">
                  <span className="font-medium">{customer.phone || 'No phone provided'}</span>
                  <span className="text-xs text-muted-foreground">Work Phone</span>
                </div>
              </div>
              <div className="flex items-start gap-3 text-sm">
                <MapPin className="w-4 h-4 text-muted-foreground mt-0.5" />
                <div className="flex flex-col">
                  <span className="font-medium">
                    {customer.address?.line1 || 'No address'}<br/>
                    {customer.address?.city && `${customer.address.city}, `}{customer.address?.state} {customer.address?.postalCode}
                  </span>
                  <span className="text-xs text-muted-foreground mt-1">Billing Address</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/50 shadow-sm">
            <CardHeader className="pb-4">
              <CardTitle className="text-base font-display">Financial Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between text-sm border-b border-border/50 pb-2">
                <span className="text-muted-foreground flex items-center gap-2"><CreditCard className="w-4 h-4"/> Credit Limit</span>
                <span className="font-semibold">${(customer.creditLimit || 0).toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between text-sm border-b border-border/50 pb-2">
                <span className="text-muted-foreground flex items-center gap-2"><Clock className="w-4 h-4"/> Terms</span>
                <span className="font-medium">{customer.paymentTerms || 'Net 30'}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground flex items-center gap-2"><FileText className="w-4 h-4"/> Tax ID</span>
                <span className="font-mono text-xs">{customer.taxId || 'N/A'}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2">
          <Tabs defaultValue="orders" className="w-full">
            <TabsList className="grid w-full grid-cols-6 bg-secondary/50 p-1 rounded-lg">
              <TabsTrigger value="orders">Orders</TabsTrigger>
              <TabsTrigger value="timeline">Timeline</TabsTrigger>
              <TabsTrigger value="tasks">Tasks</TabsTrigger>
              <TabsTrigger value="email">Email</TabsTrigger>
              <TabsTrigger value="custom">Custom</TabsTrigger>
              <TabsTrigger value="copilot">Copilot</TabsTrigger>
            </TabsList>
            
            <TabsContent value="orders" className="mt-4 focus-visible:outline-none focus-visible:ring-0">
              <Card className="border-border/50 shadow-sm min-h-[400px]">
                <CardContent className="p-0">
                  <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
                    <ShoppingCart className="w-10 h-10 text-muted-foreground/50 mb-4" />
                    <h3 className="text-base font-semibold text-foreground">No recent orders</h3>
                    <p className="text-sm text-muted-foreground max-w-sm mt-1 mb-4">This customer hasn't placed any orders yet.</p>
                    <Button variant="outline" size="sm">Create Order</Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="timeline" className="mt-4 focus-visible:outline-none focus-visible:ring-0">
              <UnifiedActivityTimeline entityType="customer" entityId={customer.id} />
            </TabsContent>
            <TabsContent value="tasks" className="mt-4 focus-visible:outline-none focus-visible:ring-0">
              <TaskList entityType="customer" entityId={customer.id} />
            </TabsContent>
            <TabsContent value="email" className="mt-4 focus-visible:outline-none focus-visible:ring-0">
              <EmailComposer entityType="customer" entityId={customer.id} defaultTo={customer.email || undefined} />
            </TabsContent>
            <TabsContent value="custom" className="mt-4 focus-visible:outline-none focus-visible:ring-0">
              <CustomFormsPanel entityType="customer" entityId={customer.id} />
            </TabsContent>
            <TabsContent value="copilot" className="mt-4 focus-visible:outline-none focus-visible:ring-0">
              <AICopilotChat entityType="customer" entityId={customer.id} />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
