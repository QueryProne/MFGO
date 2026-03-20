import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";

import { PageHeader } from "@/components/ui-patterns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CustomFormsAdminContent } from "@/pages/system/custom-forms";

function readTabFromLocation(location: string): "general" | "custom-forms" {
  const query = location.split("?")[1] ?? "";
  const params = new URLSearchParams(query);
  const tab = params.get("tab");
  return tab === "general" ? "general" : "custom-forms";
}

export default function AdministrationPage() {
  const [location, navigate] = useLocation();
  const initialTab = useMemo(() => readTabFromLocation(location), [location]);
  const [activeTab, setActiveTab] = useState<"general" | "custom-forms">(initialTab);

  useEffect(() => {
    setActiveTab(readTabFromLocation(location));
  }, [location]);

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500">
      <PageHeader
        title="Administration & Governance"
        description="Configure system settings, governance controls, and platform-level modules."
      />

      <Tabs
        value={activeTab}
        onValueChange={(value) => {
          const next = value === "general" ? "general" : "custom-forms";
          setActiveTab(next);
          navigate(`/admin?tab=${next}`);
        }}
        className="w-full"
      >
        <TabsList className="grid w-full grid-cols-2 bg-secondary/50 p-1 rounded-lg">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="custom-forms">Custom Forms</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="mt-4">
          <Card className="border-border/50 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base font-display">General Administration</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Add user/role, policy, and governance controls in this tab as the admin module expands.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="custom-forms" className="mt-4">
          <CustomFormsAdminContent embedded />
        </TabsContent>
      </Tabs>
    </div>
  );
}
