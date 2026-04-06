'use client';

import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { ProtectedRoute } from "@/contexts/auth-context";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
  Filter,
  Search
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

  if (loading) {
    return (
      <ProtectedRoute requiredRoles={["SALES_REP"]}>
        <DashboardLayout>
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold">Tier Upgrade Notifications</h1>
                <p className="text-muted-foreground">Loading your assigned customers...</p>
              </div>
            </div>
            <div className="text-center py-8 text-muted-foreground">
              Loading tier upgrade notifications...
            </div>
          </div>
        </DashboardLayout>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute requiredRoles={["SALES_REP"]}>
      <DashboardLayout>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-3xl font-bold">Tier Upgrade Notifications</h1>
              <p className="text-muted-foreground">Manage tier upgrades for your assigned customers</p>
            </div>
            <Button variant="outline" onClick={fetchNotifications} disabled={loading}>
              {loading ? <LoadingSpinner size={16} className="mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
              Refresh
            </Button>
          </div>

          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search customers..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Select value={filter} onValueChange={setFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Notifications</SelectItem>
                  <SelectItem value="unread">Unread Only</SelectItem>
                  <SelectItem value="read">Read Only</SelectItem>
                  <SelectItem value="high">High Priority</SelectItem>
                  <SelectItem value="urgent">Urgent Priority</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Stats */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Notifications</CardTitle>
                <Bell className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{notifications.length}</div>
                <p className="text-xs text-muted-foreground">All tier upgrade notifications</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Unread</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{notifications.filter(n => !n.isRead).length}</div>
                <p className="text-xs text-muted-foreground">Pending your action</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">High Priority</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{notifications.filter(n => n.priority === 'HIGH' || n.priority === 'URGENT').length}</div>
                <p className="text-xs text-muted-foreground">Requires immediate attention</p>
              </CardContent>
            </Card>
          </div>

          {/* Notifications List */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Tier Upgrade Notifications
                <Badge variant="secondary" className="ml-2">
                  {filteredNotifications.length}
                </Badge>
              </CardTitle>
              <CardDescription>
                Your assigned customers eligible for tier upgrades based on their spending
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
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
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
