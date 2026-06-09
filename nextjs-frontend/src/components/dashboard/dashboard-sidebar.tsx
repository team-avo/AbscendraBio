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
    ChevronDown,
    ChevronRight,
    Tag,
    Warehouse,
    MessageSquare,
    X,
    Clock,
    TrendingUp,
    CheckCircle,
    XCircle,
    UserPlus,
    Building,
    Crown,
    Shield,
    LogOut,
    Search as SearchIcon,
    User as UserIcon,
    Heart,
    ArrowLeft,
    Mail,
    Zap
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
        href: "/admin-dashboard",
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
            { title: "Stock Receipts", href: "/inventory/receipts", icon: Mail },
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
    // {
    //     title: "Customer Comments",
    //     href: "/admin/comments",
    //     icon: MessageSquare,
    // },
    // Customer specific items
    {
        title: "Personal",
        href: "/account",
        icon: UserIcon,
        children: [
            { title: "Profile", href: "/account", icon: UserIcon },
            { title: "My Orders", href: "/account/orders", icon: ShoppingCart },
            { title: "Favorites", href: "/account/favorites", icon: Heart },
            { title: "Bulk Quotes", href: "/account/bulk-quotes", icon: FileText },
        ]
    },
    {
        title: "Return to Shop",
        href: "/landing",
        icon: ArrowLeft,
    },
    {
        title: "Payments",
        href: "/payments",
        icon: CreditCard,
    },
    {
        title: "Zelle Payments",
        href: "/payments/zelle",
        icon: Zap,
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
    const { user, logout, hasPermission } = useAuth();
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
            <div key={item.title} className="space-y-0.5">
                <div className="flex items-center">
                    <Link
                        href={item.href}
                        className={cn(
                            "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                            "w-full text-left",
                            level > 0 && "ml-6 text-xs",
                            isActive && !isChildActive && "bg-[#3A6FA0]/15 text-white border-l-2 border-[#3A6FA0]",
                            isChildActive && "text-white/90 font-semibold",
                            !isActive && "text-slate-400 hover:bg-white/5 hover:text-white"
                        )}
                        aria-current={isActive ? "page" : undefined}
                    >
                        <item.icon className={cn(
                            "h-[18px] w-[18px] flex-shrink-0",
                            isActive && !isChildActive ? "text-[#3A6FA0]" : "text-current opacity-70"
                        )} />
                        <span className="flex-1 truncate">{item.title}</span>
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
                            className="h-8 w-8 p-0 ml-1 text-white/30 hover:text-white/60 hover:bg-transparent flex-shrink-0"
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
                    <div className="ml-4 pl-4 border-l border-white/10 space-y-0.5 mt-0.5">
                        {item.children?.map(child => renderNavItem(child, level + 1))}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className={cn(
            "fixed inset-y-0 left-0 z-50 w-72 transition-all duration-300",
            open ? "translate-x-0" : "-translate-x-full",
            "lg:translate-x-0"
        )}>
            <div className="flex h-full flex-col bg-[#0F1A2E]">
                {/* Logo Header */}
                <div className="px-6 py-5 flex items-center justify-between border-b border-white/10 flex-shrink-0">
                    <Link href="/">
                        <Image
                            src="/logo.png"
                            alt="Ascendra Bio"
                            width={130}
                            height={36}
                            className="h-8 w-auto brightness-0 invert"
                        />
                    </Link>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="lg:hidden h-8 w-8 p-0 text-white/50 hover:text-white hover:bg-white/10 rounded-lg"
                        onClick={() => onOpenChange(false)}
                    >
                        <X className="h-5 w-5" />
                    </Button>
                </div>

                {/* Search */}
                <div className="px-4 pt-4 pb-2 flex-shrink-0">
                    <div className="relative">
                        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
                        <input
                            type="text"
                            placeholder="Search..."
                            className="w-full bg-white/[0.08] border border-white/10 rounded-lg py-2.5 pl-9 pr-3 text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-[#3A6FA0]/60 transition-all"
                        />
                    </div>
                </div>

                {/* Navigation */}
                <div className="flex-1 min-h-0">
                    <ScrollArea className="h-full px-3" scrollHideDelay={100}>
                        <nav className="space-y-0.5 py-3">
                            {(
                                navItems
                                    .filter(item => {
                                        if (user?.role === 'CUSTOMER') {
                                            const allowed = ['Personal', 'Return to Shop', 'Support'];
                                            return allowed.includes(item.title);
                                        }
                                        if (user?.role === 'SALES_MANAGER') {
                                            const allowed = ['Orders', 'Customers'];
                                            if (!allowed.includes(item.title)) return false;
                                        }
                                        if (user?.role === 'SALES_REP') {
                                            const allowed = ['Orders', 'Customers', 'Bulk Quotes', 'Tier Upgrades'];
                                            if (item.title === 'Analytics') {
                                                return !!hasPermission?.('ANALYTICS', 'READ');
                                            }
                                            return allowed.includes(item.title);
                                        }
                                        // Hide personal/return for non-customers, hide sensitive for non-admins
                                        if (item.title === 'Personal' || item.title === 'Return to Shop') return false;
                                        return !['Tier Upgrades', 'Assign Customers', 'Analytics'].includes(item.title);
                                    })
                            ).map(item => renderNavItem(item))}
                        </nav>
                    </ScrollArea>
                </div>

                {/* User Footer */}
                <div className="p-4 border-t border-white/10 flex-shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-full bg-gradient-to-br from-[#1B2D4F] to-[#3A6FA0] flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                            {user?.email?.[0].toUpperCase() || 'A'}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-white truncate">
                                {user?.role === 'CUSTOMER' ? 'Account' : (user?.role?.replace(/_/g, ' ') || 'Admin')}
                            </p>
                            <p className="text-[10px] text-white/40 truncate">{user?.email}</p>
                        </div>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => logout()}
                            className="h-8 w-8 p-0 rounded-lg hover:bg-red-500/20 hover:text-red-400 text-white/40 transition-colors"
                        >
                            <LogOut className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}
