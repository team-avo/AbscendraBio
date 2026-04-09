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
    Shield,
    LogOut,
    Search as SearchIcon,
    User as UserIcon,
    Plus
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
            <div key={item.title} className="space-y-1">
                <div className="flex items-center">
                    <Link
                        href={item.href}
                        className={cn(
                            "flex items-center gap-3 rounded-2xl px-3.5 py-3 text-sm font-medium transition-all duration-300",
                            "w-full text-left font-heading tracking-wide",
                            level > 0 && "ml-8 text-muted-foreground/80 font-sans",
                            isActive && !isChildActive && "bg-[#3A6FA0] text-white shadow-lg shadow-[#3A6FA0]/30 scale-[1.02]",
                            isChildActive && "bg-sidebar-accent/50 text-[#1B2D4F] font-bold",
                            !isActive && "text-muted-foreground hover:bg-sidebar-accent hover:text-[#1B2D4F]"
                        )}
                        aria-current={isActive ? "page" : undefined}
                    >
                        <item.icon className={cn(
                            "h-[18px] w-[18px]",
                            isActive && !isChildActive ? "text-white" : "text-[#3A6FA0]/70"
                        )} />
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
                "fixed inset-y-0 left-0 z-50 w-72 transition-all duration-500 ease-in-out",
                open ? "translate-x-0" : "-translate-x-full",
                "lg:translate-x-0 p-4" // Floating margin
            )}>
                <div className="flex h-full flex-col bg-white/80 backdrop-blur-2xl border border-white/40 shadow-[0_20px_50px_rgba(0,0,0,0.1)] rounded-[2.5rem] overflow-hidden">
                    {/* Brand Header */}
                    <div className="p-8 flex items-center justify-between border-b border-gray-100/50">
                        <Link href="/" className="flex items-center gap-2 group transition-all">
                            <Image
                                src="/logo.png"
                                alt="Abscendra Bio"
                                width={140}
                                height={40}
                                className="w-auto h-8 group-hover:scale-105 transition-transform"
                            />
                        </Link>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="lg:hidden hover:bg-gray-100 rounded-full h-8 w-8 p-0"
                            onClick={() => onOpenChange(false)}
                        >
                            <X className="h-5 w-5 text-gray-500" />
                        </Button>
                    </div>

                    {/* Integrated Quick Tools (Search & Notifs) */}
                    <div className="px-6 pt-4 space-y-3">
                        <div className="relative group">
                            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 group-hover:text-[#3A6FA0] transition-colors" />
                            <input 
                                type="text"
                                placeholder="Universal Search..."
                                className="w-full bg-gray-50/50 border border-gray-100 rounded-full py-2.5 pl-10 pr-4 text-xs focus:outline-none focus:ring-2 focus:ring-[#3A6FA0]/10 transition-all font-medium"
                            />
                        </div>
                        <div className="flex items-center gap-2">
                             <Button variant="outline" className="flex-1 rounded-full text-[11px] font-bold h-9 border-gray-100 bg-white/50 hover:bg-white">
                                <Plus className="w-3 h-3 mr-1.5 text-[#3A6FA0]" />
                                Quick Action
                             </Button>
                             <Button variant="outline" size="icon" className="rounded-full h-9 w-9 border-gray-100 bg-white/50 hover:bg-white relative">
                                <Bell className="w-4 h-4 text-gray-500" />
                                <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
                             </Button>
                        </div>
                    </div>

                    {/* Navigation */}
                    <div className="flex-1 min-h-0">
                        <ScrollArea className="h-full px-4" scrollHideDelay={100}>
                            <nav className="space-y-1.5 py-6">
                            {(
                                navItems
                                    .filter(item => {
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
                                        return !['Tier Upgrades', 'Assign Customers', 'Analytics'].includes(item.title);
                                    })
                            ).map(item => renderNavItem(item))}
                        </nav>
                        </ScrollArea>
                    </div>

                    {/* User Profile & Footer */}
                    <div className="p-4 border-t border-gray-100/50 bg-gray-50/30">
                        <div className="flex items-center gap-3 p-3 bg-white/80 rounded-3xl border border-white shadow-sm">
                            <div className="h-10 w-10 rounded-full bg-gradient-to-br from-[#1B2D4F] to-[#3A6FA0] flex items-center justify-center text-white font-bold text-sm shadow-md">
                                {user?.email?.[0].toUpperCase() || 'A'}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-xs font-bold text-[#1B2D4F] truncate uppercase tracking-tighter">
                                    {user?.role?.replace('_', ' ') || 'Admin'}
                                </p>
                                <p className="text-[10px] text-gray-400 truncate">
                                    {user?.email}
                                </p>
                            </div>
                            <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={() => logout()}
                                className="h-8 w-8 p-0 rounded-full hover:bg-red-50 hover:text-red-500 transition-colors"
                            >
                                <LogOut className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
            
            <style jsx global>{`
                [data-slot="scroll-area-viewport"]::-webkit-scrollbar {
                    width: 4px;
                }
                [data-slot="scroll-area-viewport"]::-webkit-scrollbar-track {
                    background: transparent;
                }
                [data-slot="scroll-area-viewport"]::-webkit-scrollbar-thumb {
                    background: rgba(0, 0, 0, 0.05);
                    border-radius: 10px;
                }
                [data-slot="scroll-area-viewport"]::-webkit-scrollbar-thumb:hover {
                    background: rgba(0, 0, 0, 0.1);
                }
            `}</style>
        </>
    );
}
