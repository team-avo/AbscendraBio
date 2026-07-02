'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
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
} from '@/components/ui/alert-dialog';
import {
  Bell,
  TrendingUp,
  User,
  DollarSign,
  ArrowRight,
  CheckCircle,
  Clock,
  Star,
  Users,
  ShoppingCart,
  RefreshCw
} from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { format } from 'date-fns';
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

interface SalesRepStats {
  assignedCustomers: number;
  totalOrders: number;
  totalRevenue: number;
  tierUpgradeNotifications: number;
}

export function SalesRepDashboard() {
  const [notifications, setNotifications] = useState<TierUpgradeNotification[]>([]);
  const [stats, setStats] = useState<SalesRepStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [upgradingCustomer, setUpgradingCustomer] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);

      logger.info('[SALES REP] Fetching tier upgrade notifications...');

      // Fetch tier upgrade notifications
      const notificationsRes = await api.getTierUpgradeNotifications({ limit: 10 });
      logger.info('[SALES REP] Notifications response:', { data: notificationsRes });

      if (notificationsRes.success && notificationsRes.data) {
        logger.info('[SALES REP] Setting notifications:', { data: notificationsRes.data.notifications });
        setNotifications(notificationsRes.data.notifications || []);
      } else {
        logger.info('[SALES REP] No notifications data or failed response:', { data: notificationsRes });
        setNotifications([]);
      }

      // Fetch sales rep stats (you'll need to create this endpoint)
      // For now, we'll calculate from notifications
      const unreadNotifications = notificationsRes.data?.notifications?.filter(n => !n.isRead) || [];
      setStats({
        assignedCustomers: 0, // This would come from a dedicated endpoint
        totalOrders: 0, // This would come from a dedicated endpoint
        totalRevenue: 0, // This would come from a dedicated endpoint
        tierUpgradeNotifications: unreadNotifications.length
      });
    } catch (error) {
      logger.error('Failed to fetch sales rep data:', { error: error });
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
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

        toast.success('Customer upgraded to Tier 1 successfully');
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

  if (loading) {
    return (
      <div className="space-y-6">
        {/* Dark hero strip — loading state */}
        <div className="relative bg-mist border border-line border-t-2 border-t-[#5A9ADA] rounded-2xl mx-1 sm:mx-0 overflow-hidden">
          <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'linear-gradient(rgba(77,125,242,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(77,125,242,0.6) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
          <div className="absolute top-0 right-0 w-[400px] h-[200px] bg-[#5A9ADA]/8 rounded-full blur-[100px] pointer-events-none" />
          <div className="relative z-10 px-6 py-6 sm:px-8 sm:py-7">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h1 className="text-2xl font-black text-[#043061] tracking-tight">Sales Rep Dashboard</h1>
                <p className="text-xs text-[#6b7d93] mt-1">Loading your assigned customers and notifications...</p>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" onClick={fetchData} disabled className="rounded-xl">
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Refresh
                </Button>
              </div>
            </div>
          </div>
        </div>
        <div className="text-center py-8 text-muted-foreground">
          Loading dashboard data...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Dark hero strip */}
      <div className="relative bg-mist border border-line border-t-2 border-t-[#5A9ADA] rounded-2xl mx-1 sm:mx-0 overflow-hidden">
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'linear-gradient(rgba(77,125,242,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(77,125,242,0.6) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
        <div className="absolute top-0 right-0 w-[400px] h-[200px] bg-[#5A9ADA]/8 rounded-full blur-[100px] pointer-events-none" />
        <div className="relative z-10 px-6 py-6 sm:px-8 sm:py-7">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-black text-[#043061] tracking-tight">Sales Rep Dashboard</h1>
              <p className="text-xs text-[#6b7d93] mt-1">Your performance overview and assigned customers</p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={fetchData}
                disabled={loading}
                className="rounded-xl bg-white/5 border-white/10 text-white hover:bg-white/10 hover:text-white"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
          <div className="flex flex-row items-center justify-between pb-2">
            <span className="text-sm font-medium text-gray-600">Assigned Customers</span>
            <Users className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="text-2xl font-bold">{stats?.assignedCustomers || 0}</div>
          <p className="text-xs text-muted-foreground mt-1">Customers under your management</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
          <div className="flex flex-row items-center justify-between pb-2">
            <span className="text-sm font-medium text-gray-600">Total Orders</span>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="text-2xl font-bold">{stats?.totalOrders || 0}</div>
          <p className="text-xs text-muted-foreground mt-1">Orders from your customers</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
          <div className="flex flex-row items-center justify-between pb-2">
            <span className="text-sm font-medium text-gray-600">Total Revenue</span>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="text-2xl font-bold">${stats?.totalRevenue?.toLocaleString() || '0'}</div>
          <p className="text-xs text-muted-foreground mt-1">Revenue from your customers</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
          <div className="flex flex-row items-center justify-between pb-2">
            <span className="text-sm font-medium text-gray-600">Tier Upgrades</span>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="text-2xl font-bold">{stats?.tierUpgradeNotifications || 0}</div>
          <p className="text-xs text-muted-foreground mt-1">Customers eligible for upgrade</p>
        </div>
      </div>

      {/* Tier Upgrade Notifications */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Tier Upgrade Notifications
            <Badge variant="secondary" className="ml-2">
              {notifications.length}
            </Badge>
          </CardTitle>
          <CardDescription>
            Your assigned customers eligible for tier upgrades based on their spending
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {notifications.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <TrendingUp className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No tier upgrade notifications at this time.</p>
              <p className="text-sm">Your assigned customers will appear here when they reach spending thresholds.</p>
            </div>
          ) : (
            notifications.map((notification) => (
              <div
                key={notification.id}
                className={`p-4 border rounded-lg ${
                  notification.isRead
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
                        {notification.message.replace('Tier 1 (B2C)', 'Tier 1').replace('Tier 2 (B2B)', 'Tier 2')}
                      </p>

                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <DollarSign className="h-3 w-3" />
                          <span>${notification.metadata?.lifetimeSpending?.toLocaleString() || '0'} lifetime spending</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          <span>{notification.metadata?.currentTier?.replace('Tier 2 (B2B)', 'Tier 2')} → {notification.metadata?.suggestedTier?.replace('Tier 1 (B2C)', 'Tier 1')}</span>
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
                        className="text-xs rounded-xl"
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
                          className="text-xs bg-[#043061] hover:bg-[#0b4f96] text-white rounded-xl"
                        >
                          {upgradingCustomer === notification.customer?.id ? (
                            <>
                              <Clock className="h-3 w-3 mr-1 animate-spin" />
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
                            from {notification.metadata?.currentTier?.replace('Tier 2 (B2B)', 'Tier 2')} to {notification.metadata?.suggestedTier?.replace('Tier 1 (B2C)', 'Tier 1')}?
                            <br /><br />
                            This will give them access to Tier 1 pricing and benefits.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleUpgradeCustomer(notification.customer?.id!, notification.id)}
                            className="bg-[#043061] hover:bg-[#0b4f96] text-white rounded-xl"
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
  );
}
