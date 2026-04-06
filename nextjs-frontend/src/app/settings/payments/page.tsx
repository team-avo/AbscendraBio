import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { ProtectedRoute } from "@/contexts/auth-context";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { CreditCard } from "lucide-react";

export default function PaymentsSettingsPage() {
  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Payment Settings</h1>
              <p className="text-muted-foreground">Configure payment methods for your store</p>
            </div>
            <Button>Save Changes</Button>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Payment Gateways
              </CardTitle>
              <CardDescription>Configure payment methods for your store</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-6 bg-blue-600 rounded flex items-center justify-center">
                      <span className="text-white text-xs font-bold">S</span>
                    </div>
                    <div>
                      <h4 className="font-medium">Stripe</h4>
                      <p className="text-sm text-muted-foreground">Accept credit cards and digital payments</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="default">Active</Badge>
                    <Switch defaultChecked />
                  </div>
                </div>
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-6 bg-blue-500 rounded flex items-center justify-center">
                      <span className="text-white text-xs font-bold">PP</span>
                    </div>
                    <div>
                      <h4 className="font-medium">PayPal</h4>
                      <p className="text-sm text-muted-foreground">PayPal payments and digital wallet</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">Inactive</Badge>
                    <Switch />
                  </div>
                </div>
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-6 bg-green-600 rounded flex items-center justify-center">
                      <span className="text-white text-xs font-bold">$</span>
                    </div>
                    <div>
                      <h4 className="font-medium">Bank Transfer</h4>
                      <p className="text-sm text-muted-foreground">Direct bank transfer for large orders</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="default">Active</Badge>
                    <Switch defaultChecked />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Stripe Configuration</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-2">
                  <Label htmlFor="stripe-public">Publishable Key</Label>
                  <Input id="stripe-public" placeholder="pk_test_..." type="password" />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="stripe-secret">Secret Key</Label>
                  <Input id="stripe-secret" placeholder="sk_test_..." type="password" />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="stripe-webhook">Webhook Endpoint</Label>
                  <Input id="stripe-webhook" placeholder="whsec_..." type="password" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Payment Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-2">
                  <Label htmlFor="currency">Default Currency</Label>
                  <Select defaultValue="USD">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="USD">USD - US Dollar</SelectItem>
                      <SelectItem value="EUR">EUR - Euro</SelectItem>
                      <SelectItem value="GBP">GBP - British Pound</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Capture payments immediately</Label>
                    <p className="text-sm text-muted-foreground">Charge customers when order is placed</p>
                  </div>
                  <Switch defaultChecked />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Enable test mode</Label>
                    <p className="text-sm text-muted-foreground">Use test API keys for development</p>
                  </div>
                  <Switch />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
} 