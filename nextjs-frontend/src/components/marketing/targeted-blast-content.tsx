"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { Search, Send, Loader2, Users } from "lucide-react";
import { api, Customer } from "@/lib/api";
import { toast } from "sonner";
import logger from '@/lib/logger';

export function TargetedBlastContent() {
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [search, setSearch] = useState("");
    const [sending, setSending] = useState(false);

    useEffect(() => {
        fetchCustomers();
    }, [search]);

    const fetchCustomers = async () => {
        try {
            setLoading(true);
            const res = await api.getCustomers({
                page: 1,
                limit: 50,
                search: search || undefined,
                isActive: true,
                approvalStatus: 'APPROVED'
            });

            if (res.success && res.data) {
                // Handle different response shapes if necessary
                const customerList = (res.data as any).customers || res.data || [];
                setCustomers(customerList);
            }
        } catch (err) {
            logger.error("Failed to fetch customers:", { error: err });
            toast.error("Failed to load customers");
        } finally {
            setLoading(false);
        }
    };

    const toggleSelectAll = () => {
        if (selectedIds.length === customers.length) {
            setSelectedIds([]);
        } else {
            setSelectedIds(customers.map(c => c.id));
        }
    };

    const toggleSelect = (id: string) => {
        setSelectedIds(prev =>
            prev.includes(id)
                ? prev.filter(i => i !== id)
                : [...prev, id]
        );
    };

    const handleBlast = async () => {
        if (selectedIds.length === 0) {
            toast.error("Please select at least one customer");
            return;
        }

        try {
            setSending(true);
            const res = await api.blastSelectedCustomers(selectedIds);
            if (res.success) {
                toast.success(`Marketing blast started for ${selectedIds.length} customers!`);
                setSelectedIds([]);
            } else {
                toast.error(res.error || "Failed to start marketing blast");
            }
        } catch (err) {
            logger.error("Blast error:", { error: err });
            toast.error("An error occurred while sending emails");
        } finally {
            setSending(false);
        }
    };

    const getInitials = (firstName: string, lastName: string) => {
        return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Targeted Marketing Blast</h1>
                    <p className="text-muted-foreground">
                        Select specific customers to receive the MARKETING_GENERIC email template.
                    </p>
                </div>
                <Button
                    onClick={handleBlast}
                    disabled={selectedIds.length === 0 || sending}
                    className="w-full sm:w-auto"
                >
                    {sending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
                    Send to {selectedIds.length} Selected
                </Button>
            </div>

            <Card>
                <CardHeader>
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                            <CardTitle>Select Recipients</CardTitle>
                            <CardDescription>
                                Only active and approved customers are shown here.
                            </CardDescription>
                        </div>
                        <div className="relative w-full md:w-72">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                type="search"
                                placeholder="Search customers..."
                                className="pl-8"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-12">
                                        <Checkbox
                                            checked={customers.length > 0 && selectedIds.length === customers.length}
                                            onCheckedChange={toggleSelectAll}
                                        />
                                    </TableHead>
                                    <TableHead>Customer</TableHead>
                                    <TableHead>Email</TableHead>
                                    <TableHead>Type</TableHead>
                                    <TableHead>Status</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="h-24 text-center">
                                            <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                                            <span className="mt-2 block text-sm text-muted-foreground">Loading customers...</span>
                                        </TableCell>
                                    </TableRow>
                                ) : customers.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                                            No customers found.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    customers.map((customer) => (
                                        <TableRow key={customer.id}>
                                            <TableCell>
                                                <Checkbox
                                                    checked={selectedIds.includes(customer.id)}
                                                    onCheckedChange={() => toggleSelect(customer.id)}
                                                />
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-3">
                                                    <Avatar className="h-8 w-8">
                                                        <AvatarFallback className="text-[10px]">
                                                            {getInitials(customer.firstName, customer.lastName)}
                                                        </AvatarFallback>
                                                    </Avatar>
                                                    <span className="font-medium">
                                                        {customer.firstName} {customer.lastName}
                                                    </span>
                                                </div>
                                            </TableCell>
                                            <TableCell>{customer.email}</TableCell>
                                            <TableCell>
                                                <Badge variant="outline">{customer.customerType}</Badge>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="default" className="bg-green-600">
                                                    {customer.approvalStatus}
                                                </Badge>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
