"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
    Menu,
    Search,
    Bell,
    Plus,
    Sun,
    Moon,
    User,
    Settings,
    LogOut,
    CreditCard,
    Users,
    HelpCircle
} from "lucide-react";
import { useTheme } from "next-themes";
import { useAuth } from "@/contexts/auth-context";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { CreateCustomerDialog } from "@/components/customers/create-customer-dialog";
import { CreateOrderDialog } from "@/components/orders/create-order-dialog";
import { api, formatDate } from "@/lib/api";
import { ScrollArea } from "@/components/ui/scroll-area";
import logger from '@/lib/logger';

interface DashboardHeaderProps {
    onMenuClick: () => void;
}

export function DashboardHeader({ onMenuClick }: DashboardHeaderProps) {
    const { setTheme, theme } = useTheme();
    const { logout, user } = useAuth();
    const router = useRouter();
    const [showCreateCustomerDialog, setShowCreateCustomerDialog] = useState(false);
    const [showCreateOrderDialog, setShowCreateOrderDialog] = useState(false);

    const handleAddProduct = () => {
        router.push('/products/create');
    };

    const handleAddCustomer = () => {
        setShowCreateCustomerDialog(true);
    };

    const handleCreateOrder = () => {
        setShowCreateOrderDialog(true);
    };

    const handleCustomerCreated = () => {
        setShowCreateCustomerDialog(false);
        // Optionally refresh the page or show a success message
        window.location.reload();
    };

    const handleOrderCreated = () => {
        setShowCreateOrderDialog(false);
        // Optionally refresh the page or show a success message
        window.location.reload();
    };

    // Notifications state
    const [notifications, setNotifications] = useState<Array<{ id: string; type: string; title: string; description?: string; createdAt: string; target?: string }>>([]);
    const [tierUpgradeNotifications, setTierUpgradeNotifications] = useState<Array<{ id: string; type: string; title: string; message: string; priority: string; isRead: boolean; createdAt: string }>>([]);

    useEffect(() => {
        let isMounted = true;
        const load = async () => {
            try {
                // Load regular notifications
                const res = await api.getNotifications({ limit: 10 });
                if (isMounted && res.success && res.data) {
                    setNotifications(res.data.notifications || []);
                }

                // Load tier upgrade notifications for sales reps
                // if (user?.role === 'SALES_REP') {
                //     const tierRes = await api.getTierUpgradeNotifications({ limit: 5 });
                //     if (isMounted && tierRes.success && tierRes.data) {
                //         setTierUpgradeNotifications(tierRes.data.notifications || []);
                //     }
                // }
            } catch (error) {
                logger.error('Failed to load notifications:', { error: error });
            }
        };
        load();
        const interval = setInterval(load, 60_000);
        return () => { isMounted = false; clearInterval(interval); };
    }, [user?.role]);

    const unreadCount = notifications.length + (user?.role === 'SALES_REP' ? tierUpgradeNotifications.filter(n => !n.isRead).length : 0);

    return (
        <>
            <header className="sticky top-0 z-40 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                <div className="flex flex-wrap gap-2 items-center justify-between px-4 sm:px-6 min-h-14 py-2 sm:py-0 sm:h-16">
                    {/* Left side */}
                    <div className="flex items-center gap-2 sm:gap-4">
                        <Button
                            variant="ghost"
                            size="sm"
                            className="lg:hidden"
                            onClick={onMenuClick}
                        >
                            <Menu className="h-5 w-5" />
                        </Button>

                        {/* Search */}
                        <div className="relative hidden sm:block">
                            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                type="search"
                                placeholder="Search orders, products, customers..."
                                className="w-48 lg:w-64 pl-10"
                            />
                        </div>
                    </div>

                    {/* Right side */}
                    <div className="flex items-center gap-1 sm:gap-2">
                        {/* View Store for Sales Rep */}
                        {user?.role === 'SALES_REP' && (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => router.push('/landing')}
                            >
                                View Store
                            </Button>
                        )}

                        {/* Quick Actions (hidden for SALES_REP) */}
                        {user?.role !== 'SALES_REP' && (
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="outline" size="sm" className="hidden sm:flex">
                                        <Plus className="h-4 w-4 mr-2" />
                                        Create
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-48">
                                    <DropdownMenuItem onClick={handleAddProduct}>
                                        <Plus className="h-4 w-4 mr-2" />
                                        Add Product
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={handleAddCustomer}>
                                        <Users className="h-4 w-4 mr-2" />
                                        Add Customer
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={handleCreateOrder}>
                                        <CreditCard className="h-4 w-4 mr-2" />
                                        Manual Order
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        )}

                        {/* Mobile Create Button (hidden for SALES_REP) */}
                        {user?.role !== 'SALES_REP' && (
                            <Button
                                variant="outline"
                                size="sm"
                                className="sm:hidden"
                                onClick={handleAddProduct}
                            >
                                <Plus className="h-4 w-4" />
                            </Button>
                        )}

                        {/* Theme Toggle */}
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                        >
                            <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                            <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
                            <span className="sr-only">Toggle theme</span>
                        </Button>

                        {/* Notifications (show for all users EXCEPT ADMIN, SALES_REP, MANAGER, STAFF, and SALES_MANAGER) */}
                        {user?.role !== 'ADMIN' && user?.role !== 'SALES_REP' && user?.role !== 'MANAGER' && user?.role !== 'STAFF' && user?.role !== 'SALES_MANAGER' && unreadCount > 0 && (
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="sm" className="relative">
                                        <Bell className="h-4 w-4" />
                                        <Badge
                                            variant="destructive"
                                            className="absolute -top-1 -right-1 h-5 w-5 p-0 text-xs"
                                        >
                                            {Math.min(unreadCount, 99)}
                                        </Badge>
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-72">
                                    <DropdownMenuLabel>Notifications</DropdownMenuLabel>
                                    <DropdownMenuSeparator />
                                    <ScrollArea className="h-64">
                                        <div className="space-y-2 p-2">
                                            {/* Tier Upgrade Notifications were here, removed implies dead code since this block is for non-sales-reps */}

                                            {/* Regular Notifications */}
                                            {notifications.map((n) => (
                                                <div key={n.id} className="flex items-start gap-3 p-2 rounded-lg hover:bg-accent cursor-pointer" onClick={() => n.target ? router.push(n.target) : null}>
                                                    <div className={`h-2 w-2 rounded-full mt-2 ${n.type === 'order' ? 'bg-blue-500' : n.type === 'warning' ? 'bg-yellow-500' : n.type === 'success' ? 'bg-green-500' : 'bg-muted-foreground'}`}></div>
                                                    <div className="flex-1">
                                                        <p className="text-sm font-medium">{n.title}</p>
                                                        {n.description && <p className="text-xs text-muted-foreground">{n.description}</p>}
                                                        <p className="text-xs text-muted-foreground">{formatDate(n.createdAt)}</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </ScrollArea>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem className="justify-center" onClick={() => router.push('/settings/notifications')}>
                                        View all notifications
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        )}

                        {/* Profile Menu */}
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                                    <Avatar className="h-8 w-8">
                                        <AvatarImage src="/avatars/01.png" alt={user?.firstName || 'User'} />
                                        <AvatarFallback>
                                            {(user?.firstName?.[0] || '').toUpperCase()}{(user?.lastName?.[0] || '').toUpperCase()}
                                        </AvatarFallback>
                                    </Avatar>
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent className="w-56" align="end" forceMount>
                                <DropdownMenuLabel className="font-normal">
                                    <div className="flex flex-col space-y-1">
                                        <p className="text-sm font-medium leading-none">{user ? `${user.firstName} ${user.lastName}` : 'User'}</p>
                                        <p className="text-xs leading-none text-muted-foreground">
                                            {user?.email || ''}
                                        </p>
                                    </div>
                                </DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                {/* <DropdownMenuItem>
                                <User className="mr-2 h-4 w-4" />
                                <span>Profile</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                                <Settings className="mr-2 h-4 w-4" />
                                <span>Settings</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                                <HelpCircle className="mr-2 h-4 w-4" />
                                <span>Help & Support</span>
                            </DropdownMenuItem> */}
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                    onClick={() => {
                                        logout();
                                    }}
                                >
                                    <LogOut className="mr-2 h-4 w-4" />
                                    <span>Log out</span>
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </div>

                {/* Dialogs */}
                <CreateCustomerDialog
                    open={showCreateCustomerDialog}
                    onOpenChange={setShowCreateCustomerDialog}
                    onSuccess={handleCustomerCreated}
                />
                <CreateOrderDialog
                    open={showCreateOrderDialog}
                    onOpenChange={setShowCreateOrderDialog}
                    onSuccess={handleOrderCreated}
                />
            </header>
        </>
    );
}
