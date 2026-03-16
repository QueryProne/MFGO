import { useState } from "react";
import { Link } from "wouter";
import { Plus, Search, Filter, MoreHorizontal, Building2 } from "lucide-react";
import { PageHeader, StatusBadge, EmptyState, LoadingTable } from "@/components/ui-patterns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useListCustomers, useCreateCustomer } from "@workspace/api-client-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

const customerSchema = z.object({
  name: z.string().min(2, "Name is required"),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional(),
  type: z.enum(['prospect', 'customer', 'inactive']).default('prospect'),
});

export default function CustomersList() {
  const [search, setSearch] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading } = useListCustomers({ search, limit: 50 });
  const createMutation = useCreateCustomer({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['/api/customers'] });
        toast({ title: "Customer created successfully" });
        setIsDialogOpen(false);
      }
    }
  });

  const form = useForm<z.infer<typeof customerSchema>>({
    resolver: zodResolver(customerSchema),
    defaultValues: { name: "", email: "", phone: "", type: "prospect" }
  });

  function onSubmit(values: z.infer<typeof customerSchema>) {
    createMutation.mutate({ data: values });
  }

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500">
      <PageHeader 
        title="Customers" 
        description="Manage your CRM contacts, prospects, and active clients."
        action={
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="shadow-md font-semibold"><Plus className="w-4 h-4 mr-2" /> New Customer</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px] border-border/50 shadow-2xl">
              <DialogHeader>
                <DialogTitle>Create Customer</DialogTitle>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
                  <FormField control={form.control} name="name" render={({ field }) => (
                    <FormItem><FormLabel>Company Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="email" render={({ field }) => (
                    <FormItem><FormLabel>Email</FormLabel><FormControl><Input type="email" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="phone" render={({ field }) => (
                    <FormItem><FormLabel>Phone</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <div className="flex justify-end pt-4 gap-2">
                    <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                    <Button type="submit" disabled={createMutation.isPending}>
                      {createMutation.isPending ? "Creating..." : "Create"}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        }
      />

      <Card className="border-border/50 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-border/50 flex flex-col sm:flex-row gap-4 items-center justify-between bg-card/50">
          <div className="relative w-full sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="Search customers..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 bg-background"
            />
          </div>
          <Button variant="outline" size="sm" className="h-9 w-full sm:w-auto"><Filter className="w-4 h-4 mr-2" /> Filters</Button>
        </div>

        {isLoading ? (
          <div className="p-6"><LoadingTable /></div>
        ) : !data?.data?.length ? (
          <EmptyState 
            icon={Building2}
            title="No customers found" 
            description={search ? "Try adjusting your search query." : "Get started by adding your first customer."}
            action={<Button variant="outline" onClick={() => setIsDialogOpen(true)}>Add Customer</Button>}
          />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-secondary/50">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="font-semibold text-foreground">Name</TableHead>
                  <TableHead className="font-semibold text-foreground">Number</TableHead>
                  <TableHead className="font-semibold text-foreground">Contact</TableHead>
                  <TableHead className="font-semibold text-foreground">Status</TableHead>
                  <TableHead className="text-right"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.data.map((customer) => (
                  <TableRow key={customer.id} className="group hover:bg-secondary/20 transition-colors">
                    <TableCell className="font-medium text-foreground">
                      <Link href={`/customers/${customer.id}`} className="hover:underline decoration-primary underline-offset-4">
                        {customer.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground font-mono text-xs">{customer.number || '-'}</TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="text-sm">{customer.email || '-'}</span>
                        <span className="text-xs text-muted-foreground">{customer.phone}</span>
                      </div>
                    </TableCell>
                    <TableCell><StatusBadge status={customer.status} /></TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <Link href={`/customers/${customer.id}`}>
                            <DropdownMenuItem className="cursor-pointer">View Details</DropdownMenuItem>
                          </Link>
                          <DropdownMenuItem className="cursor-pointer">Edit</DropdownMenuItem>
                          <Link href={`/salesorders/new?customer=${customer.id}`}>
                            <DropdownMenuItem className="cursor-pointer">Create Order</DropdownMenuItem>
                          </Link>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>
    </div>
  );
}
