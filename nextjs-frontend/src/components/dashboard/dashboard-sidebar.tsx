"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
    LayoutDashboard,
    ShoppingCart,
    Package,
    Users,
    BarChart3,
    Settings,
    Gift,
    Truck,
    CreditCard,
    FileText,
    FlaskConical,
    Bell,
    ChevronDown,
    ChevronRight,
    Home,
    Tag,
    Warehouse,
    MessageSquare,
    Mail,
    X,
    Clock,
    TrendingUp,
    CheckCircle,
    XCircle,
    UserPlus,
    Building,
    Link2,
    Crown,
    Shield
} from "lucide-react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";

interface DashboardSidebarProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

interface NavItem {
    title: string;
    href: string;
    icon: React.ComponentType<any>;
    badge?: string;
    children?: NavItem[];
}

const navItems: NavItem[] = [
    {
        title: "Dashboard",
        href: "/",
        icon: LayoutDashboard,
    },
    {
        title: "Orders",
        href: "/orders",
        icon: ShoppingCart,
        children: [
            { title: "All Orders", href: "/orders", icon: ShoppingCart },
            { title: "Pending", href: "/orders/pending", icon: Clock },
            { title: "Processing", href: "/orders/processing", icon: Package },
            { title: "Label Printed", href: "/orders/label-printed", icon: FileText },
            { title: "Shipped", href: "/orders/shipped", icon: Truck },
            { title: "Delivered", href: "/orders/delivered", icon: CheckCircle },
            { title: "Cancelled", href: "/orders/cancelled", icon: XCircle },
            { title: "Failed Payments", href: "/orders/failed-payments", icon: XCircle },
            // { title: "Shipping Monitor", href: "/admin/shipping-status", icon: Truck },
        ]
    },
    {
        title: "Products",
        href: "/products",
        icon: Package,
        children: [
            { title: "All Products", href: "/products", icon: Package },
            { title: "Categories", href: "/products/categories", icon: Tag },
            { title: "Collections", href: "/products/collections", icon: Package },
            // { title: "Inventory", href: "/products/inventory", icon: Warehouse },
            { title: "Inventory", href: "/inventory", icon: Warehouse },
            { title: "Warehouse Locations", href: "/products/locations", icon: Warehouse },
        ]
    },
    {
        title: "Customers",
        href: "/customers",
        icon: Users,
        children: [
            { title: "All Customers", href: "/customers", icon: Users },
            { title: "Wholesale", href: "/customers/wholesale", icon: Building },
            { title: "Enterprise", href: "/customers/enterprise", icon: Crown },
            { title: "Pending Approvals", href: "/customers/approvals", icon: Clock },
            { title: "Rejected Accounts", href: "/customers/rejected", icon: XCircle },
        ]
    },
    {
        title: "Abandoned Carts",
        href: "/admin/abandoned-carts",
        icon: ShoppingCart,
    },
    {
        title: "Assign Customers",
        href: "/assign-customers",
        icon: UserPlus,
    },
    // {
    //     title: "Bulk Quotes",
    //     href: "/bulk-quotes",
    //     icon: MessageSquare,
    // },
    // {
    //     title: "Tier Upgrades",
    //     href: "/tier-upgrades",
    //     icon: TrendingUp,
    // },
    {
        title: "Analytics",
        href: "/analytics",
        icon: BarChart3,
        children: [
            { title: "Overview", href: "/analytics", icon: BarChart3 },
            { title: "Sales Reports", href: "/analytics/sales", icon: BarChart3 },
            { title: "Product Performance", href: "/analytics/products", icon: Package },
            { title: "SKU Analytics", href: "/analytics/sku", icon: TrendingUp },
            { title: "Customer Insights", href: "/analytics/customers", icon: Users },
            { title: "Sales Rep Performance", href: "/analytics/sales-reps", icon: BarChart3 },
            { title: "Sales Manager Performance", href: "/analytics/sales-managers", icon: BarChart3 },
        ]
    },
    {
        title: "Promotions",
        href: "/coupons",
        icon: Gift,
    },
    // {
    //     title: "Marketing",
    //     href: "/marketing",
    //     icon: MessageSquare,
    //     children: [
    //         { title: "Dashboard", href: "/marketing", icon: LayoutDashboard },
    //         { title: "Targeted Email Blast", href: "/marketing/targeted-blast", icon: Mail },
    //         { title: "Campaigns", href: "/marketing/campaigns", icon: MessageSquare },
    //         { title: "Promotions", href: "/coupons", icon: Gift },
    //     ]
    // },
    {
        title: "Customer Comments",
        href: "/admin/comments",
        icon: MessageSquare,
    },
    {
        title: "Payments",
        href: "/payments",
        icon: CreditCard,
    },
    // {
    //     title: "Shipping",
    //     href: "/shipping",
    //     icon: Truck,
    // },
    {
        title: "Sales Channels",
        href: "/settings/sales-channels",
        icon: MessageSquare,
    },
    {
        title: "Shipping Tiers",
        href: "/settings/shipping-tiers",
        icon: Truck,
    },
    {
        title: "Content",
        href: "/content",
        icon: FileText,
        children: [
            { title: "Pages", href: "/content/pages", icon: FileText },
            { title: "Blog", href: "/content/blog", icon: FileText },
            { title: "Navigation", href: "/content/navigation", icon: FileText },
            { title: "Media", href: "/content/media", icon: FileText },
        ]
    },
    {
        title: "3rd Party Testing",
        href: "/third-party-testing",
        icon: FlaskConical,
        children: [
            { title: "Purity & Net Peptide Content", href: "/third-party-testing/purity", icon: FlaskConical },
            { title: "Endotoxicity", href: "/third-party-testing/endotoxicity", icon: FlaskConical },
            { title: "Sterility", href: "/third-party-testing/sterility", icon: FlaskConical },
        ],
    },
    {
        title: "Users",
        href: "/users",
        icon: Users,
        children: [
            { title: "All Users", href: "/users", icon: Users },
            { title: "Sales Users", href: "/users/sales_users", icon: Users },
            { title: "Sales Managers", href: "/sales-managers", icon: Users },
            // { title: "Manager Assignments", href: "/admin/sales-manager-assignments", icon: UserPlus },
        ]
    },
    {
        title: "Manage locations",
        href: "/settings/locations",
        icon: Warehouse,
    },
    {
        title: "Settings",
        href: "/settings",
        icon: Settings,
        children: [
            // { title: "General", href: "/settings/general", icon: Settings },
            // { title: "Payments", href: "/settings/payments", icon: CreditCard },
            // { title: "Shipping", href: "/settings/shipping", icon: Truck },
            { title: "Taxes", href: "/settings/taxes", icon: Settings },
            { title: "Audit Logs", href: "/settings?tab=audit", icon: Shield },
            // { title: "Sales Channels", href: "/settings/sales-channels", icon: Link2 },
            // { title: "Locations", href: "/settings/locations", icon: Warehouse },
            // { title: "Notifications", href: "/settings/notifications", icon: Bell },
        ]
    },
];

export function DashboardSidebar({ open, onOpenChange }: DashboardSidebarProps) {
    const pathname = usePathname();
    const { user, hasPermission } = useAuth();
    const [expandedItems, setExpandedItems] = useState<string[]>(() => {
        // Auto-expand parent section if current route is inside it
        const expanded: string[] = [];
        navItems.forEach(item => {
            if (item.children && item.children.some(child => pathname.startsWith(child.href))) {
                expanded.push(item.title);
            }
        });
        return expanded;
    });

    useEffect(() => {
        // Auto-expand parent section on route change
        navItems.forEach(item => {
            if (item.children && item.children.some(child => pathname.startsWith(child.href))) {
                setExpandedItems(prev => prev.includes(item.title) ? prev : [...prev, item.title]);
            }
        });
    }, [pathname]);

    const toggleExpanded = (title: string) => {
        setExpandedItems(prev =>
            prev.includes(title)
                ? prev.filter(item => item !== title)
                : [...prev, title]
        );
    };

    const renderNavItem = (item: NavItem, level = 0) => {
        const isExpanded = expandedItems.includes(item.title);
        const hasChildren = item.children && item.children.length > 0;
        const isActive = pathname === item.href || (hasChildren && item.children?.some(child => pathname === child.href));
        const isChildActive = hasChildren && item.children?.some(child => pathname === child.href);

        return (
            <div key={item.title} className="space-y-1">
                <div className="flex items-center">
                    <Link
                        href={item.href}
                        className={cn(
                            "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors",
                            "w-full text-left",
                            level > 0 && "ml-6 text-muted-foreground",
                            isActive && "bg-accent text-accent-foreground font-semibold shadow",
                            isChildActive && "bg-accent/70 text-accent-foreground font-semibold"
                        )}
                        aria-current={isActive ? "page" : undefined}
                    >
                        <item.icon className="h-4 w-4" />
                        <span className="flex-1">{item.title}</span>
                        {item.badge && (
                            <Badge variant="secondary" className="ml-auto">
                                {item.badge}
                            </Badge>
                        )}
                    </Link>
                    {hasChildren && (
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 ml-2"
                            onClick={() => toggleExpanded(item.title)}
                            tabIndex={-1}
                        >
                            {isExpanded ? (
                                <ChevronDown className="h-4 w-4" />
                            ) : (
                                <ChevronRight className="h-4 w-4" />
                            )}
                        </Button>
                    )}
                </div>
                {hasChildren && isExpanded && (
                    <div className="space-y-1">
                        {item.children?.map(child => renderNavItem(child, level + 1))}
                    </div>
                )}
            </div>
        );
    };

    return (
        <>
            <div className={cn(
                "fixed inset-y-0 left-0 z-50 w-64 bg-background border-r border-border transition-transform duration-300 ease-in-out",
                open ? "translate-x-0" : "-translate-x-full",
                "lg:translate-x-0"
            )}>
                <div className="flex h-full flex-col">
                    {/* Header */}
                    <div className="flex items-center justify-between p-4 sm:p-6 border-b border-border">
                        <Link href="/" className="flex items-center gap-2 dark:bg-white dark:rounded-2xl dark:p-2 dark:w-full">
                            <Image
                                src="/logo.png"
                                alt="Centre Labs"
                                width={120}
                                height={40}
                                className="rounded-lg sm:w-[150px] sm:h-[50px]"
                            />
                        </Link>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="lg:hidden"
                            onClick={() => onOpenChange(false)}
                        >
                            <X className="h-4 w-4" />
                        </Button>
                    </div>

                    {/* Navigation */}
                    <ScrollArea className="flex-1 px-3 sm:px-4 py-4 sm:py-6 overflow-y-auto scrollbar-hide">
                        <nav className="space-y-2">
                            {(
                                navItems
                                    .filter(item => {
                                        if (user?.role === 'SALES_MANAGER') {
                                            // Sales managers: show Orders, Customers, and specialized items
                                            const allowed = ['Orders', 'Customers'];
                                            if (!allowed.includes(item.title)) return false;
                                        }
                                        if (user?.role === 'SALES_REP') {
                                            // Sales reps: allow core items; show Analytics only if permission granted
                                            const allowed = ['Orders', 'Customers', 'Bulk Quotes', 'Tier Upgrades'];
                                            if (item.title === 'Analytics') {
                                                return !!hasPermission?.('ANALYTICS', 'READ');
                                            }
                                            return allowed.includes(item.title);
                                        }
                                        // For all other users (admin, etc.), exclude Tier Upgrades and Assign Customers
                                        return !['Tier Upgrades', 'Assign Customers'].includes(item.title);
                                    })
                                    .map(item => {
                                        if ((user?.role === 'SALES_REP' || user?.role === 'SALES_MANAGER') && item.title === 'Customers') {
                                            const excluded = ['Pending Approvals', 'Rejected Accounts'];
                                            return { ...item, children: item.children?.filter(child => !excluded.includes(child.title)) };
                                        }
                                        return item;
                                    })
                            ).map(item => renderNavItem(item))}
                            {user?.role === 'SALES_MANAGER' && (
                                <div className="space-y-1">
                                    <Link
                                        href="/sales-manager/my-team"
                                        className={cn(
                                            "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors",
                                            "w-full text-left",
                                            pathname === '/sales-manager/my-team' && "bg-accent text-accent-foreground font-semibold shadow"
                                        )}
                                        aria-current={pathname === '/sales-manager/my-team' ? "page" : undefined}
                                    >
                                        <Users className="h-4 w-4" />
                                        <span className="flex-1">My Sales Team</span>
                                    </Link>
                                    <Link
                                        href="/sales-manager/analytics"
                                        className={cn(
                                            "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors",
                                            "w-full text-left",
                                            pathname === '/sales-manager/analytics' && "bg-accent text-accent-foreground font-semibold shadow"
                                        )}
                                        aria-current={pathname === '/sales-manager/analytics' ? "page" : undefined}
                                    >
                                        <BarChart3 className="h-4 w-4" />
                                        <span className="flex-1">Analytics</span>
                                    </Link>
                                </div>
                            )}
                        </nav>
                    </ScrollArea>

                    {/* Footer */}
                    <div className="p-3 sm:p-4 border-t border-border">
                        <div className="flex items-center gap-3 text-xs sm:text-sm text-muted-foreground">
                            <div className="h-2 w-2 bg-green-500 rounded-full"></div>
                            <span>System Status: Online</span>
                        </div>
                    </div>
                </div>
            </div>
            <style jsx global>{`
                .scrollbar-hide::-webkit-scrollbar {
                    display: none;
                }
                .scrollbar-hide {
                    -ms-overflow-style: none;
                    scrollbar-width: none;
                }
            `}</style>
        </>
    );
}
