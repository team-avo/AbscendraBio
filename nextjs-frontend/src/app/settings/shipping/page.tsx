import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { ProtectedRoute } from "@/contexts/auth-context";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Plus, Edit, Trash2, Truck } from "lucide-react";

export default function ShippingSettingsPage() {
  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="space-y-4 sm:space-y-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Shipping Settings</h1>
              <p className="text-muted-foreground text-sm sm:text-base">Configure shipping rates and options for your store</p>
            </div>
            <Button className="w-full sm:w-auto">Save Changes</Button>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Truck className="h-5 w-5" />
                Shipping Zones
              </CardTitle>
              <CardDescription>Configure shipping rates for different regions</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-4 border rounded-lg gap-3 sm:gap-0">
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium">United States</h4>
                    <p className="text-sm text-muted-foreground">Free shipping over $100</p>
                  </div>
                  <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                    <Button variant="outline" size="sm"><Edit className="h-3 w-3" /></Button>
                    <Button variant="outline" size="sm"><Trash2 className="h-3 w-3" /></Button>
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-4 border rounded-lg gap-3 sm:gap-0">
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium">Canada</h4>
                    <p className="text-sm text-muted-foreground">$15.00 flat rate</p>
                  </div>
                  <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                    <Button variant="outline" size="sm"><Edit className="h-3 w-3" /></Button>
                    <Button variant="outline" size="sm"><Trash2 className="h-3 w-3" /></Button>
                  </div>
                </div>
                <Button variant="outline" className="w-full">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Shipping Zone
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 sm:gap-6 grid-cols-1 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Shipping Options</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Enable real-time rates</Label>
                    <p className="text-sm text-muted-foreground">Calculate shipping costs from carriers</p>
                  </div>
                  <Switch defaultChecked />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Require signature</Label>
                    <p className="text-sm text-muted-foreground">For orders over certain amount</p>
                  </div>
                  <Switch />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="signature-threshold">Signature threshold</Label>
                  <Input id="signature-threshold" placeholder="$500.00" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Package Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-2">
                  <Label htmlFor="default-weight">Default Package Weight (lbs)</Label>
                  <Input id="default-weight" defaultValue="1.0" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div className="grid gap-2">
                    <Label htmlFor="package-length">Length (in)</Label>
                    <Input id="package-length" defaultValue="10" />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="package-width">Width (in)</Label>
                    <Input id="package-width" defaultValue="8" />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="package-height">Height (in)</Label>
                    <Input id="package-height" defaultValue="6" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
} 