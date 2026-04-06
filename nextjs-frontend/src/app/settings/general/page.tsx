import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { ProtectedRoute } from "@/contexts/auth-context";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Globe, Store, Upload } from "lucide-react";

export default function GeneralSettingsPage() {
  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">General Settings</h1>
              <p className="text-muted-foreground">Basic information about your store</p>
            </div>
            <Button>Save Changes</Button>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Store className="h-5 w-5" />
                  Store Information
                </CardTitle>
                <CardDescription>Basic information about your store</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-2">
                  <Label htmlFor="store-name">Store Name</Label>
                  <Input id="store-name" type="text" defaultValue="Centre Research" />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="store-description">Description</Label>
                  <Textarea id="store-description" defaultValue="Premium peptides for research and development" rows={3} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="store-email">Contact Email</Label>
                  <Input id="store-email" type="email" defaultValue="contact@centreresearch.com" />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="store-phone">Phone Number</Label>
                  <Input id="store-phone" type="text" defaultValue="+1 (555) 123-4567" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Globe className="h-5 w-5" />
                  Store Address
                </CardTitle>
                <CardDescription>Your business address and location</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-2">
                  <Label htmlFor="address-line1">Address Line 1</Label>
                  <Input id="address-line1" type="text" defaultValue="123 Research Boulevard" />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="address-line2">Address Line 2</Label>
                  <Input id="address-line2" type="text" placeholder="Suite, apartment, etc." />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="city">City</Label>
                    <Input id="city" type="text" defaultValue="Boston" />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="state">State</Label>
                    <Input id="state" type="text" defaultValue="MA" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="zip">ZIP Code</Label>
                    <Input id="zip" type="text" defaultValue="02101" />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="country">Country</Label>
                    <Select defaultValue="US">
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="US">United States</SelectItem>
                        <SelectItem value="CA">Canada</SelectItem>
                        <SelectItem value="UK">United Kingdom</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Store Logo</CardTitle>
              <CardDescription>Upload your store logo (recommended size: 200x200px)</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <Avatar className="h-20 w-20">
                  <AvatarImage src="/logo.png" alt="Store Logo" />
                  <AvatarFallback>CR</AvatarFallback>
                </Avatar>
                <div className="space-y-2">
                  <Button variant="outline">
                    <Upload className="h-4 w-4 mr-2" />
                    Upload New Logo
                  </Button>
                  <p className="text-sm text-muted-foreground">JPG, PNG, or SVG. Max file size 2MB.</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
} 