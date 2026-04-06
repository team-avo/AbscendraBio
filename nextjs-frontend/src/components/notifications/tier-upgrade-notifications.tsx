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
  Star
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

export function TierUpgradeNotifications() {
  const [notifications, setNotifications] = useState<TierUpgradeNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [upgradingCustomer, setUpgradingCustomer] = useState<string | null>(null);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const response = await api.getTierUpgradeNotifications({ limit: 10 });
      if (response.success && response.data) {
        setNotifications(response.data.notifications);
      }
    } catch (error) {
      logger.error('Failed to fetch tier upgrade notifications', { error });
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
      logger.error('Failed to mark notification as read', { error, notificationId });
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
      logger.error('Failed to upgrade customer', { error, customerId, notificationId });
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
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Tier Upgrade Notifications
          </CardTitle>
          <CardDescription>
            Loading notifications...
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            Loading tier upgrade notifications...
          </div>
        </CardContent>
      </Card>
    );
  }

  if (notifications.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Tier Upgrade Notifications
          </CardTitle>
          <CardDescription>
            No customers are currently eligible for tier upgrades
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <TrendingUp className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No tier upgrade notifications at this time.</p>
            <p className="text-sm">Customers will appear here when they reach spending thresholds.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
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
          Customers eligible for tier upgrades based on their spending
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {notifications.map((notification) => (
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
        ))}
      </CardContent>
    </Card>
  );
}
