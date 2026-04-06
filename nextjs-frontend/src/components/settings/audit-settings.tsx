"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LoginAuditTab } from "./login-audit-tab";

export function AuditSettings() {
    return (
        <div className="space-y-4">
            <Tabs defaultValue="logins" className="w-full">
                <TabsList className="h-9 p-1 bg-muted/50 border">
                    <TabsTrigger value="logins" className="px-4 py-1 text-xs sm:text-sm">
                        Logins
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="logins" className="mt-4">
                    <LoginAuditTab />
                </TabsContent>
            </Tabs>
        </div>
    );
}
