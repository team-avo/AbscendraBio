'use client';

import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { ProtectedRoute } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Bell,
  TrendingUp,
  User,
  DollarSign,
  ArrowRight,
  CheckCircle,
  Clock,
  Star,
  RefreshCw,
  Search,
} from "lucide-react";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { format } from "date-fns";
import { useState, useEffect } from "react";
import logger from '@/lib/logger';

interface TierUpgradeNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  isRead: boolean;
  metadata?: {
    customerName: string;
    customerEmail: string;
    lifetimeSpending: number;
    threshold: number;
    currentTier: string;
    suggestedTier: string;
    salesRepId: string;
    salesRepName: string;
  };
  customer?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    customerType: string;
  };
  order?: {
    id: string;
    orderNumber: string;
    totalAmount: number;
    status: string;
  };
  createdAt: string;
  readAt?: string;
}

export default function TierUpgradesPage() {
  const [notifications, setNotifications] = useState<TierUpgradeNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [upgradingCustomer, setUpgradingCustomer] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("all");
  const [search, setSearch] = useState<string>("");

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const response = await api.getTierUpgradeNotifications({ limit: 50 });
      if (response.success && response.data) {
        setNotifications(response.data.notifications || []);
      }
    } catch (error) {
      logger.error('Failed to fetch tier upgrade notifications:', { error: error });
      toast.error('Failed to load notifications');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  const handleMarkAsRead = async (notificationId: string) => {
    try {
      await api.markNotificationAsRead(notificationId);
      setNotifications(prev =>
        prev.map(notif =>
          notif.id === notificationId
            ? { ...notif, isRead: true, readAt: new Date().toISOString() }
            : notif
        )
      );
      toast.success('Notification marked as read');
    } catch (error) {
      logger.error('Failed to mark notification as read:', { error: error });
      toast.error('Failed to mark notification as read');
    }
  };

  const handleUpgradeCustomer = async (customerId: string, notificationId: string) => {
    try {
      setUpgradingCustomer(customerId);

      // Update customer tier to B2C
      const response = await api.updateCustomer(customerId, {
        customerType: 'B2C'
      });

      if (response.success) {
        // Mark notification as read
        await api.markNotificationAsRead(notificationId);

        // Remove notification from list
        setNotifications(prev => prev.filter(notif => notif.id !== notificationId));

        toast.success('Customer upgraded to Wholesale successfully');
      } else {
        toast.error(response.error || 'Failed to upgrade customer');
      }
    } catch (error) {
      logger.error('Failed to upgrade customer:', { error: error });
      toast.error('Failed to upgrade customer');
    } finally {
      setUpgradingCustomer(null);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'URGENT': return 'bg-red-100 text-red-800 border-red-200';
      case 'HIGH': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'MEDIUM': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'LOW': return 'bg-gray-100 text-gray-800 border-gray-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'URGENT': return <Star className="h-4 w-4" />;
      case 'HIGH': return <TrendingUp className="h-4 w-4" />;
      case 'MEDIUM': return <Bell className="h-4 w-4" />;
      case 'LOW': return <Clock className="h-4 w-4" />;
      default: return <Bell className="h-4 w-4" />;
    }
  };

  // Filter notifications based on search and filter
  const filteredNotifications = notifications.filter(notification => {
    const matchesSearch = !search ||
      notification.customer?.firstName?.toLowerCase().includes(search.toLowerCase()) ||
      notification.customer?.lastName?.toLowerCase().includes(search.toLowerCase()) ||
      notification.customer?.email?.toLowerCase().includes(search.toLowerCase()) ||
      notification.message.toLowerCase().includes(search.toLowerCase());

    const matchesFilter = filter === "all" ||
      (filter === "unread" && !notification.isRead) ||
      (filter === "read" && notification.isRead) ||
      (filter === "high" && notification.priority === "HIGH") ||
      (filter === "urgent" && notification.priority === "URGENT");

    return matchesSearch && matchesFilter;
  });

  const filterPills: { label: string; value: string }[] = [
    { label: "All", value: "all" },
    { label: "Unread", value: "unread" },
    { label: "Read", value: "read" },
    { label: "High", value: "high" },
    { label: "Urgent", value: "urgent" },
  ];

  return (
    <ProtectedRoute requiredRoles={["SALES_REP"]}>
      <DashboardLayout>
        <div className="p-2 sm:p-4 lg:p-6 space-y-4 sm:space-y-5">

          {/* Dark Hero Strip */}
          <div
            className="relative bg-[#070B14] rounded-2xl mx-1 sm:mx-0 overflow-hidden"
            style={{ backgroundImage: 'linear-gradient(rgba(77,125,242,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(77,125,242,0.6) 1px, transparent 1px)', backgroundSize: '40px 40px' }}
          >
            {/* Glow */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[200px] bg-[#4D7DF2]/8 rounded-full blur-[100px] pointer-events-none" />

            <div className="relative px-5 py-5 sm:px-7 sm:py-6 space-y-4">
              {/* Top row */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">Tier Upgrades</h1>
                  <p className="text-sm text-blue-200/70 mt-0.5">Customers requesting account tier upgrades</p>
                </div>
                <div className="flex items-center gap-3">
                  {/* Stat chip */}
                  <div className="flex items-center gap-2 bg-white/10 border border-white/15 rounded-xl px-3 py-1.5">
                    <TrendingUp className="h-4 w-4 text-blue-400" />
                    <span className="text-white font-semibold text-sm">{notifications.filter(n => !n.isRead).length}</span>
                    <span className="text-blue-200/70 text-xs">pending</span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={fetchNotifications}
                    disabled={loading}
                    className="bg-white text-[#070B14] border-white hover:bg-white/90 font-semibold rounded-xl h-9 px-4 text-sm"
                  >
                    {loading ? <LoadingSpinner size={14} className="mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                    Refresh
                  </Button>
                </div>
              </div>

              {/* Filter pills */}
              <div className="flex flex-wrap gap-2">
                {filterPills.map((pill) => (
                  <button
                    key={pill.value}
                    onClick={() => setFilter(pill.value)}
                    className={[
                      "px-3 py-1 rounded-full text-xs font-medium transition-colors",
                      filter === pill.value
                        ? "bg-blue-500 text-white"
                        : "bg-white/10 text-blue-100 hover:bg-white/20",
                    ].join(" ")}
                  >
                    {pill.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Compact filter row */}
          <div className="flex flex-col sm:flex-row gap-3 mx-1 sm:mx-0">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Search customers..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-9 text-sm"
              />
            </div>
          </div>

          {/* Notifications list */}
          <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm overflow-hidden mx-1 sm:mx-0">
            <div className="p-4 sm:p-6 space-y-4">
              {filteredNotifications.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <TrendingUp className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No tier upgrade notifications found.</p>
                  <p className="text-sm">
                    {search || filter !== "all"
                      ? "Try adjusting your search or filter criteria."
                      : "Your assigned customers will appear here when they reach spending thresholds."
                    }
                  </p>
                </div>
              ) : (
                filteredNotifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={`p-4 border rounded-lg ${notification.isRead
                      ? 'bg-gray-50 border-gray-200'
                      : 'bg-blue-50 border-blue-200'
                      }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3 flex-1">
                        <Avatar className="h-10 w-10">
                          <AvatarFallback className="bg-primary text-primary-foreground">
                            {notification.customer?.firstName?.charAt(0) || 'C'}
                          </AvatarFallback>
                        </Avatar>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            <h4 className="font-semibold text-sm">
                              {notification.customer?.firstName} {notification.customer?.lastName}
                            </h4>
                            <Badge className={getPriorityColor(notification.priority)}>
                              {getPriorityIcon(notification.priority)}
                              <span className="ml-1">{notification.priority}</span>
                            </Badge>
                            {!notification.isRead && (
                              <div className="h-2 w-2 bg-blue-500 rounded-full"></div>
                            )}
                          </div>

                          <p className="text-sm text-muted-foreground mb-2">
                            {notification.message.replace('Tier 1 (B2C)', 'Wholesale').replace('Tier 2 (B2B)', 'Wholesale').replace('Enterprise 1', 'Enterprise').replace('Enterprise 2', 'Enterprise')}
                          </p>

                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <DollarSign className="h-3 w-3" />
                              <span>${notification.metadata?.lifetimeSpending?.toLocaleString() || '0'} lifetime spending</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <User className="h-3 w-3" />
                              <span>{notification.metadata?.currentTier?.replace('Tier 2 (B2B)', 'Wholesale').replace('Tier 1 (B2C)', 'Wholesale').replace('Enterprise 1', 'Enterprise').replace('Enterprise 2', 'Enterprise')} → {notification.metadata?.suggestedTier?.replace('Tier 1 (B2C)', 'Wholesale').replace('Tier 2 (B2B)', 'Wholesale').replace('Enterprise 1', 'Enterprise').replace('Enterprise 2', 'Enterprise')}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              <span>{format(new Date(notification.createdAt), 'MMM d, yyyy')}</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 ml-4">
                        {!notification.isRead && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleMarkAsRead(notification.id)}
                            className="text-xs"
                          >
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Mark Read
                          </Button>
                        )}

                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              size="sm"
                              disabled={upgradingCustomer === notification.customer?.id}
                              className="text-xs"
                            >
                              {upgradingCustomer === notification.customer?.id ? (
                                <>
                                  <LoadingSpinner size={12} className="mr-1" />
                                  Upgrading...
                                </>
                              ) : (
                                <>
                                  <ArrowRight className="h-3 w-3 mr-1" />
                                  Upgrade Now
                                </>
                              )}
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Upgrade Customer Tier</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to upgrade {notification.customer?.firstName} {notification.customer?.lastName}
                                from {notification.metadata?.currentTier?.replace('Tier 2 (B2B)', 'Wholesale').replace('Tier 1 (B2C)', 'Wholesale').replace('Enterprise 1', 'Enterprise').replace('Enterprise 2', 'Enterprise')} to {notification.metadata?.suggestedTier?.replace('Tier 1 (B2C)', 'Wholesale').replace('Tier 2 (B2B)', 'Wholesale').replace('Enterprise 1', 'Enterprise').replace('Enterprise 2', 'Enterprise')}?
                                <br /><br />
                                This will give them access to Wholesale pricing and benefits.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleUpgradeCustomer(notification.customer?.id!, notification.id)}
                                className="bg-primary hover:bg-primary/90"
                              >
                                Upgrade Customer
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
