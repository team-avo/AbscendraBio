"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
    Search,
    Download,
    Eye,
    Edit,
    MoreHorizontal,
    Plus,
    Users,
    Building,
    DollarSign,
    ShoppingCart,
    Calendar,
    Mail,
    Phone,
    MapPin,
    Clock
} from "lucide-react";

// Mock customers data
const customers = [
    {
        id: "CUST-001",
        firstName: "John",
        lastName: "Doe",
        companyName: "Harmony Wellness",
        licenseNumber: "NPI-1000001",
        email: "john.doe@example.com",
        phone: "+1 (555) 123-4567",
        type: "b2c",
        joinDate: "2024-01-15",
        totalOrders: 12,
        totalSpent: 2450.00,
        averageOrderValue: 204.17,
        lastOrderDate: "2024-06-25",
        status: "active",
        addresses: [
            {
                type: "billing",
                street: "123 Main St",
                city: "New York",
                state: "NY",
                zipCode: "10001",
                country: "USA"
            }
        ]
    },
    {
        id: "CUST-002",
        firstName: "Sarah",
        lastName: "Wilson",
        companyName: "BioTech Labs",
        licenseNumber: "NPI-2000002",
        email: "sarah.wilson@biotech.com",
        phone: "+1 (555) 987-6543",
        type: "b2b",
        joinDate: "2024-02-08",
        totalOrders: 8,
        totalSpent: 4200.00,
        averageOrderValue: 525.00,
        lastOrderDate: "2024-06-28",
        status: "active",
        addresses: [
            {
                type: "billing",
                street: "456 Research Blvd",
                city: "Boston",
                state: "MA",
                zipCode: "02101",
                country: "USA"
            }
        ]
    },
    {
        id: "CUST-003",
        firstName: "Dr. Michael",
        lastName: "Johnson",
        companyName: "University Research Center",
        licenseNumber: "NPI-3000003",
        email: "michael.johnson@university.edu",
        phone: "+1 (555) 555-0123",
        type: "enterprise",
        joinDate: "2023-11-22",
        totalOrders: 24,
        totalSpent: 12800.00,
        averageOrderValue: 533.33,
        lastOrderDate: "2024-06-30",
        status: "active",
        addresses: [
            {
                type: "billing",
                street: "789 University Ave",
                city: "Stanford",
                state: "CA",
                zipCode: "94305",
                country: "USA"
            }
        ]
    },
    {
        id: "CUST-004",
        firstName: "Emily",
        lastName: "Chen",
        companyName: "Pharma Partners",
        licenseNumber: "NPI-4000004",
        email: "emily.chen@pharma.com",
        phone: "+1 (555) 246-8135",
        type: "b2b",
        joinDate: "2024-03-12",
        totalOrders: 6,
        totalSpent: 1890.00,
        averageOrderValue: 315.00,
        lastOrderDate: "2024-06-20",
        status: "active",
        addresses: [
            {
                type: "billing",
                street: "321 Pharma Plaza",
                city: "Chicago",
                state: "IL",
                zipCode: "60601",
                country: "USA"
            }
        ]
    },
];

const CustomerTypeBadge = ({ type }: { type: string }) => {
    const variants: { [key: string]: { variant: "default" | "secondary" | "destructive" | "outline", label: string, color: string } } = {
        b2c: { variant: "outline", label: "Tier 1", color: "text-blue-600" },
        b2b: { variant: "secondary", label: "Tier 2", color: "text-green-600" }
    };

    const config = variants[type] || { variant: "outline", label: type, color: "text-gray-600" };
    return <Badge variant={config.variant} className={config.color}>{config.label}</Badge>;
};

const StatusBadge = ({ status }: { status: string }) => {
    const variants: { [key: string]: { variant: "default" | "secondary" | "destructive" | "outline", label: string } } = {
        active: { variant: "default", label: "Active" },
        inactive: { variant: "outline", label: "Inactive" },
        suspended: { variant: "destructive", label: "Suspended" }
    };

    const config = variants[status] || { variant: "outline", label: status };
    return <Badge variant={config.variant}>{config.label}</Badge>;
};

export function CustomersContent() {
    const [searchTerm, setSearchTerm] = useState("");
    const [typeFilter, setTypeFilter] = useState("all");
    const [statusFilter, setStatusFilter] = useState("all");

    const filteredCustomers = customers.filter(customer => {
        const fullName = [customer.firstName, customer.lastName].filter(Boolean).join(" ").toLowerCase();
        const companyName = (customer.companyName || '').toLowerCase();
        const licenseNumber = (customer.licenseNumber || '').toLowerCase();
        const matchesSearch = fullName.includes(searchTerm.toLowerCase()) ||
            customer.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
            customer.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
            companyName.includes(searchTerm.toLowerCase()) ||
            licenseNumber.includes(searchTerm.toLowerCase());
        const matchesType = typeFilter === "all" || customer.type === typeFilter;
        const matchesStatus = statusFilter === "all" || customer.status === statusFilter;

        return matchesSearch && matchesType && matchesStatus;
    });

    const customerStats = {
        total: customers.length,
        b2c: customers.filter(c => c.type === "b2c").length,
        b2b: customers.filter(c => c.type === "b2b").length,
        enterprise: customers.filter(c => c.type === "enterprise").length,
        totalRevenue: customers.reduce((sum, customer) => sum + customer.totalSpent, 0),
        averageOrderValue: customers.reduce((sum, customer) => sum + customer.averageOrderValue, 0) / customers.length
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Customers</h1>
                    <p className="text-muted-foreground">
                        Manage your customer relationships and accounts
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <Button variant="outline" asChild size="sm" className="w-full sm:w-auto">
                        <a href="/customers/approvals">
                            <Clock className="h-4 w-4 mr-2" />
                            Pending Approvals
                        </a>
                    </Button>
                    <Button variant="outline" size="sm" className="w-full sm:w-auto">
                        <Download className="h-4 w-4 mr-2" />
                        Export
                    </Button>
                    <Button size="sm" className="w-full sm:w-auto">
                        <Plus className="h-4 w-4 mr-2" />
                        Add Customer
                    </Button>
                </div>
            </div>

            {/* Statistics Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Customers</CardTitle>
                        <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{customerStats.total}</div>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground mt-2">
                            <span>Tier 1: {customerStats.b2c}</span>
                            <span>Tier 2: {customerStats.b2b}</span>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            ${customerStats.totalRevenue.toLocaleString()}
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Avg. Order Value</CardTitle>
                        <ShoppingCart className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            ${customerStats.averageOrderValue.toFixed(2)}
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Tier 2 Clients</CardTitle>
                        <Building className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{customerStats.enterprise}</div>
                    </CardContent>
                </Card>
            </div>

            {/* Customers Management */}
            <Card>
                <CardHeader>
                    <CardTitle>Customers List</CardTitle>
                    <CardDescription>
                        View and manage all customer accounts
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {/* Filters */}
                    <div className="flex flex-col md:flex-row items-end gap-4 mb-6">
                        <div className="w-full md:flex-1">
                            <Label htmlFor="search">Search Customers</Label>
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                <Input
                                    id="search"
                                    placeholder="Search by name, email, or customer ID..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="pl-10"
                                />
                            </div>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto">
                            <div className="flex-1 sm:w-40">
                                <Label htmlFor="type-filter">Customer Type</Label>
                                <Select value={typeFilter} onValueChange={setTypeFilter}>
                                    <SelectTrigger id="type-filter" className="w-full">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Types</SelectItem>
                                        <SelectItem value="b2c">Tier 1</SelectItem>
                                        <SelectItem value="b2b">Tier 2</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="flex-1 sm:w-40">
                                <Label htmlFor="status-filter">Status</Label>
                                <Select value={statusFilter} onValueChange={setStatusFilter}>
                                    <SelectTrigger id="status-filter" className="w-full">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Status</SelectItem>
                                        <SelectItem value="active">Active</SelectItem>
                                        <SelectItem value="inactive">Inactive</SelectItem>
                                        <SelectItem value="suspended">Suspended</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </div>

                    {/* Customers Table */}
                    <div className="rounded-md border overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="whitespace-nowrap">Customer</TableHead>
                                    <TableHead className="whitespace-nowrap">Type</TableHead>
                                    <TableHead className="whitespace-nowrap">Contact</TableHead>
                                    <TableHead className="whitespace-nowrap">Orders</TableHead>
                                    <TableHead className="whitespace-nowrap text-right">Total Spent</TableHead>
                                    <TableHead className="whitespace-nowrap text-right">Avg. Order</TableHead>
                                    <TableHead className="whitespace-nowrap">Status</TableHead>
                                    <TableHead className="whitespace-nowrap text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredCustomers.map((customer) => (
                                    <TableRow key={customer.id}>
                                        <TableCell>
                                            <div className="flex items-center gap-3">
                                                <Avatar className="h-10 w-10 flex-shrink-0">
                                                    <AvatarImage src={`/avatars/${customer.id}.jpg`} alt={customer.firstName} />
                                                    <AvatarFallback>
                                                        {customer.firstName.charAt(0)}{customer.lastName.charAt(0)}
                                                    </AvatarFallback>
                                                </Avatar>
                                                <div className="min-w-0">
                                                    <div className="font-medium truncate">
                                                        {[customer.firstName, customer.lastName].filter(Boolean).join(" ")}
                                                    </div>
                                                    <div className="text-xs text-muted-foreground">{customer.id}</div>
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <CustomerTypeBadge type={customer.type} />
                                        </TableCell>
                                        <TableCell>
                                            <div className="space-y-1 min-w-[150px]">
                                                <div className="flex items-center gap-1 text-sm">
                                                    <Mail className="h-3 w-3 flex-shrink-0" />
                                                    <span className="truncate">{customer.email}</span>
                                                </div>
                                                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                                    <Phone className="h-3 w-3 flex-shrink-0" />
                                                    <span className="truncate">{customer.phone}</span>
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell>{customer.totalOrders}</TableCell>
                                        <TableCell className="text-right">${customer.totalSpent.toLocaleString()}</TableCell>
                                        <TableCell className="text-right">${customer.averageOrderValue.toFixed(2)}</TableCell>
                                        <TableCell>
                                            <StatusBadge status={customer.status} />
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" className="h-8 w-8 p-0">
                                                        <MoreHorizontal className="h-4 w-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                                    <DropdownMenuItem>
                                                        <Eye className="mr-2 h-4 w-4" />
                                                        View Profile
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem>
                                                        <Edit className="mr-2 h-4 w-4" />
                                                        Edit Customer
                                                    </DropdownMenuItem>
                                                    <DropdownMenuSeparator />
                                                    <DropdownMenuItem>
                                                        <ShoppingCart className="mr-2 h-4 w-4" />
                                                        View Orders
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem>
                                                        <Mail className="mr-2 h-4 w-4" />
                                                        Send Email
                                                    </DropdownMenuItem>
                                                    <DropdownMenuSeparator />
                                                    <DropdownMenuItem className="text-red-600">
                                                        Suspend Account
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>

                    {filteredCustomers.length === 0 && (
                        <div className="text-center py-12">
                            <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                            <h3 className="text-lg font-medium">No customers found</h3>
                            <p className="text-muted-foreground">
                                {searchTerm || typeFilter !== "all" || statusFilter !== "all"
                                    ? "Try adjusting your search or filters"
                                    : "You don't have any customers yet"}
                            </p>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Customer Insights */}
            <div className="grid gap-6 md:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle>Recent Customers</CardTitle>
                        <CardDescription>
                            Latest customer registrations
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {customers
                                .sort((a, b) => new Date(b.joinDate).getTime() - new Date(a.joinDate).getTime())
                                .slice(0, 5)
                                .map((customer) => (
                                    <div key={customer.id} className="flex items-center gap-4">
                                        <Avatar className="h-10 w-10">
                                            <AvatarImage src={`/avatars/${customer.id}.jpg`} alt={customer.firstName} />
                                            <AvatarFallback>
                                                {customer.firstName.charAt(0)}{customer.lastName.charAt(0)}
                                            </AvatarFallback>
                                        </Avatar>
                                        <div className="flex-1">
                                            <div className="font-medium">
                                                {customer.firstName} {customer.lastName}
                                            </div>
                                            <div className="text-sm text-muted-foreground">
                                                {customer.email}
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <CustomerTypeBadge type={customer.type} />
                                            <div className="text-xs text-muted-foreground mt-1">
                                                {new Date(customer.joinDate).toLocaleDateString()}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Top Customers</CardTitle>
                        <CardDescription>
                            Highest spending customers
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {customers
                                .sort((a, b) => b.totalSpent - a.totalSpent)
                                .slice(0, 5)
                                .map((customer, index) => (
                                    <div key={customer.id} className="flex items-center gap-4">
                                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary text-sm font-medium">
                                            {index + 1}
                                        </div>
                                        <Avatar className="h-10 w-10">
                                            <AvatarImage src={`/avatars/${customer.id}.jpg`} alt={customer.firstName} />
                                            <AvatarFallback>
                                                {customer.firstName.charAt(0)}{customer.lastName.charAt(0)}
                                            </AvatarFallback>
                                        </Avatar>
                                        <div className="flex-1">
                                            <div className="font-medium">
                                                {customer.firstName} {customer.lastName}
                                            </div>
                                            <div className="text-sm text-muted-foreground">
                                                {customer.totalOrders} orders
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="font-medium">${customer.totalSpent.toLocaleString()}</div>
                                            <CustomerTypeBadge type={customer.type} />
                                        </div>
                                    </div>
                                ))}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
