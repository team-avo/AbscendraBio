"use client";

import { usePathname } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import { Bell, Menu, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useDashboard } from "@/contexts/dashboard-context";

interface BreadcrumbSegment {
    label: string;
    href?: string;
}

function getPageMeta(pathname: string): { title: string; breadcrumbs: BreadcrumbSegment[] } {
    const segments: Record<string, { title: string; breadcrumbs: BreadcrumbSegment[] }> = {
        "/admin-dashboard": {
            title: "Dashboard",
            breadcrumbs: [{ label: "Dashboard" }],
        },
        "/orders": {
            title: "Orders",
            breadcrumbs: [{ label: "Orders" }],
        },
        "/orders/pending": {
            title: "Pending Orders",
            breadcrumbs: [{ label: "Orders", href: "/orders" }, { label: "Pending" }],
        },
        "/orders/processing": {
            title: "Processing",
            breadcrumbs: [{ label: "Orders", href: "/orders" }, { label: "Processing" }],
        },
        "/orders/shipped": {
            title: "Shipped",
            breadcrumbs: [{ label: "Orders", href: "/orders" }, { label: "Shipped" }],
        },
        "/orders/delivered": {
            title: "Delivered",
            breadcrumbs: [{ label: "Orders", href: "/orders" }, { label: "Delivered" }],
        },
        "/orders/cancelled": {
            title: "Cancelled",
            breadcrumbs: [{ label: "Orders", href: "/orders" }, { label: "Cancelled" }],
        },
        "/orders/label-printed": {
            title: "Label Printed",
            breadcrumbs: [{ label: "Orders", href: "/orders" }, { label: "Label Printed" }],
        },
        "/orders/failed-payments": {
            title: "Failed Payments",
            breadcrumbs: [{ label: "Orders", href: "/orders" }, { label: "Failed Payments" }],
        },
        "/products": {
            title: "Products",
            breadcrumbs: [{ label: "Products" }],
        },
        "/products/categories": {
            title: "Categories",
            breadcrumbs: [{ label: "Products", href: "/products" }, { label: "Categories" }],
        },
        "/products/collections": {
            title: "Collections",
            breadcrumbs: [{ label: "Products", href: "/products" }, { label: "Collections" }],
        },
        "/inventory": {
            title: "Inventory",
            breadcrumbs: [{ label: "Products", href: "/products" }, { label: "Inventory" }],
        },
        "/products/locations": {
            title: "Warehouse Locations",
            breadcrumbs: [{ label: "Products", href: "/products" }, { label: "Locations" }],
        },
        "/customers": {
            title: "Customers",
            breadcrumbs: [{ label: "Customers" }],
        },
        "/customers/wholesale": {
            title: "Wholesale",
            breadcrumbs: [{ label: "Customers", href: "/customers" }, { label: "Wholesale" }],
        },
        "/customers/enterprise": {
            title: "Enterprise",
            breadcrumbs: [{ label: "Customers", href: "/customers" }, { label: "Enterprise" }],
        },
        "/customers/approvals": {
            title: "Pending Approvals",
            breadcrumbs: [{ label: "Customers", href: "/customers" }, { label: "Approvals" }],
        },
        "/customers/rejected": {
            title: "Rejected Accounts",
            breadcrumbs: [{ label: "Customers", href: "/customers" }, { label: "Rejected" }],
        },
        "/analytics": {
            title: "Analytics",
            breadcrumbs: [{ label: "Analytics" }],
        },
        "/analytics/sales": {
            title: "Sales Reports",
            breadcrumbs: [{ label: "Analytics", href: "/analytics" }, { label: "Sales Reports" }],
        },
        "/analytics/products": {
            title: "Product Performance",
            breadcrumbs: [{ label: "Analytics", href: "/analytics" }, { label: "Products" }],
        },
        "/analytics/sku": {
            title: "SKU Analytics",
            breadcrumbs: [{ label: "Analytics", href: "/analytics" }, { label: "SKU" }],
        },
        "/analytics/customers": {
            title: "Customer Insights",
            breadcrumbs: [{ label: "Analytics", href: "/analytics" }, { label: "Customers" }],
        },
        "/coupons": {
            title: "Promotions",
            breadcrumbs: [{ label: "Promotions" }],
        },
        "/payments": {
            title: "Payments",
            breadcrumbs: [{ label: "Payments" }],
        },
        "/settings": {
            title: "Settings",
            breadcrumbs: [{ label: "Settings" }],
        },
        "/settings/taxes": {
            title: "Taxes",
            breadcrumbs: [{ label: "Settings", href: "/settings" }, { label: "Taxes" }],
        },
        "/settings/sales-channels": {
            title: "Sales Channels",
            breadcrumbs: [{ label: "Settings", href: "/settings" }, { label: "Sales Channels" }],
        },
        "/settings/shipping-tiers": {
            title: "Shipping Tiers",
            breadcrumbs: [{ label: "Settings", href: "/settings" }, { label: "Shipping Tiers" }],
        },
        "/settings/locations": {
            title: "Locations",
            breadcrumbs: [{ label: "Settings", href: "/settings" }, { label: "Locations" }],
        },
        "/users": {
            title: "Users",
            breadcrumbs: [{ label: "Users" }],
        },
        "/users/sales_users": {
            title: "Sales Users",
            breadcrumbs: [{ label: "Users", href: "/users" }, { label: "Sales Users" }],
        },
        "/sales-managers": {
            title: "Sales Managers",
            breadcrumbs: [{ label: "Users", href: "/users" }, { label: "Sales Managers" }],
        },
        "/admin/comments": {
            title: "Customer Comments",
            breadcrumbs: [{ label: "Customer Comments" }],
        },
        "/content": {
            title: "Content",
            breadcrumbs: [{ label: "Content" }],
        },
        "/third-party-testing": {
            title: "3rd Party Testing",
            breadcrumbs: [{ label: "3rd Party Testing" }],
        },
        "/margin-forecaster": {
            title: "Margin Forecaster",
            breadcrumbs: [{ label: "Margin Forecaster" }],
        },
    };

    return segments[pathname] ?? {
        title: pathname.split("/").filter(Boolean).pop()?.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase()) ?? "Admin",
        breadcrumbs: [{ label: "Admin" }],
    };
}

export function DashboardHeader() {
    const pathname = usePathname();
    const { user } = useAuth();
    const { setSidebarOpen } = useDashboard();
    const { title, breadcrumbs } = getPageMeta(pathname);

    return (
        <header className="sticky top-0 z-30 h-14 bg-white border-b border-slate-200/80 flex items-center px-6 gap-4 shrink-0">
            {/* Mobile hamburger */}
            <Button
                variant="ghost"
                size="sm"
                className="lg:hidden h-9 w-9 p-0 text-slate-500 hover:text-slate-800"
                onClick={() => setSidebarOpen(true)}
            >
                <Menu className="h-5 w-5" />
            </Button>

            {/* Breadcrumb */}
            <nav className="flex items-center gap-1.5 flex-1 min-w-0">
                {breadcrumbs.map((seg, i) => (
                    <span key={i} className="flex items-center gap-1.5 min-w-0">
                        {i > 0 && <ChevronRight className="h-3.5 w-3.5 text-slate-300 shrink-0" />}
                        {seg.href ? (
                            <Link
                                href={seg.href}
                                className="text-sm text-slate-400 hover:text-slate-700 transition-colors truncate"
                            >
                                {seg.label}
                            </Link>
                        ) : (
                            <span className="text-sm font-semibold text-slate-800 truncate">{seg.label}</span>
                        )}
                    </span>
                ))}
            </nav>

            {/* Right actions */}
            <div className="flex items-center gap-2 shrink-0">
                {/* Notification bell */}
                <Button
                    variant="ghost"
                    size="sm"
                    className="h-9 w-9 p-0 relative text-slate-500 hover:text-slate-800 hover:bg-slate-100"
                >
                    <Bell className="h-[18px] w-[18px]" />
                    <span className="absolute top-2 right-2 w-1.5 h-1.5 bg-red-500 rounded-full" />
                </Button>

                {/* User avatar */}
                <div className="h-8 w-8 rounded-full bg-gradient-to-br from-[#043061] to-[#5A9ADA] flex items-center justify-center text-white font-semibold text-xs shrink-0 cursor-pointer">
                    {user?.email?.[0].toUpperCase() ?? "A"}
                </div>
            </div>
        </header>
    );
}
