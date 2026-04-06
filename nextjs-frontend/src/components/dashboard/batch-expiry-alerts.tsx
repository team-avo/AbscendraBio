'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar, AlertTriangle, Package, Clock } from 'lucide-react';
import { api } from '@/lib/api';
import logger from '@/lib/logger';

interface ExpiringBatch {
  id: string;
  batchNumber: string;
  quantity: number;
  expiryDate: string;
  inventory: {
    variant: {
      name: string;
      sku: string;
      product: {
        name: string;
      };
    };
    location: {
      name: string;
    };
  };
}

export function BatchExpiryAlerts() {
  const router = useRouter();
  const [expiringBatches, setExpiringBatches] = useState<ExpiringBatch[]>([]);
  const [expiredBatches, setExpiredBatches] = useState<ExpiringBatch[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    fetchExpiryData();
  }, []);

  const fetchExpiryData = async () => {
    try {
      setLoading(true);

      // Fetch expiring batches
      try {
        const expiringResponse = await api.getExpiringBatches(30);
        if (expiringResponse.success) {
          setExpiringBatches(expiringResponse.data || []);
        } else {
          logger.warn('Failed to fetch expiring batches:', { warning: expiringResponse.error });
          setExpiringBatches([]);
        }
      } catch (error) {
        logger.warn('Error fetching expiring batches:', { warning: error });
        setExpiringBatches([]);
      }

      // Fetch expired batches
      try {
        const expiredResponse = await api.getExpiredBatches();
        if (expiredResponse.success) {
          setExpiredBatches(expiredResponse.data || []);
        } else {
          logger.warn('Failed to fetch expired batches:', { warning: expiredResponse.error });
          setExpiredBatches([]);
        }
      } catch (error) {
        logger.warn('Error fetching expired batches:', { warning: error });
        setExpiredBatches([]);
      }
    } catch (error) {
      logger.error('Failed to fetch batch expiry data:', { error: error });
      // Don't show error toast for batch features that might not be set up yet
      setExpiringBatches([]);
      setExpiredBatches([]);
    } finally {
      setLoading(false);
    }
  };

  const getDaysUntilExpiry = (expiryDate: string) => {
    const expiry = new Date(expiryDate);
    const today = new Date();
    const diffTime = expiry.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const getExpiryBadge = (expiryDate: string) => {
    const daysUntilExpiry = getDaysUntilExpiry(expiryDate);
    
    if (daysUntilExpiry < 0) {
      return <Badge variant="destructive">Expired</Badge>;
    } else if (daysUntilExpiry <= 7) {
      return <Badge variant="destructive">Expires in {daysUntilExpiry} days</Badge>;
    } else if (daysUntilExpiry <= 30) {
      return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
        Expires in {daysUntilExpiry} days
      </Badge>;
    }
    
    return <Badge variant="outline">Valid</Badge>;
  };

  const totalAlerts = expiringBatches.length + expiredBatches.length;
  const displayBatches = showAll 
    ? [...expiredBatches, ...expiringBatches]
    : [...expiredBatches.slice(0, 2), ...expiringBatches.slice(0, 3)];

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-500" />
            Batch Expiry Alerts
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (totalAlerts === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5 text-green-500" />
            Batch Expiry Alerts
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4">
            <Package className="h-12 w-12 mx-auto mb-2 text-green-500 opacity-50" />
            <p className="text-sm text-muted-foreground">No expiring batches</p>
            <p className="text-xs text-muted-foreground">All batches are within safe expiry dates</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-500" />
            <span>Batch Expiry Alerts</span>
            <Badge variant="secondary">{totalAlerts}</Badge>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowAll(!showAll)}
          >
            {showAll ? 'Show Less' : 'Show All'}
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Batch List */}
        <div className="space-y-3">
          {displayBatches.map((batch) => {
            const daysUntilExpiry = getDaysUntilExpiry(batch.expiryDate);
            const isExpired = daysUntilExpiry < 0;
            
            return (
              <div
                key={batch.id}
                className={`p-3 rounded-lg border ${
                  isExpired
                    ? 'border-red-500'
                    : daysUntilExpiry <= 7
                      ? 'border-yellow-500'
                      : 'border-gray-500'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-medium text-sm">
                        {batch.inventory.variant.product.name} - {batch.inventory.variant.name}
                      </h4>
                      {getExpiryBadge(batch.expiryDate)}
                    </div>
                    <div className="text-xs text-muted-foreground space-y-1">
                      <div className="flex items-center gap-4">
                        <span>Batch: {batch.batchNumber}</span>
                        <span>SKU: {batch.inventory.variant.sku}</span>
                        <span>Qty: {batch.quantity}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Calendar className="h-3 w-3 text-muted-foreground" />
                        <span>
                          Expiry: {new Date(batch.expiryDate).toLocaleDateString()}
                        </span>
                        <span>•</span>
                        <span>Location: {batch.inventory.location.name}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 ml-2">
                    {isExpired ? (
                      <AlertTriangle className="h-4 w-4 text-red-500" />
                    ) : daysUntilExpiry <= 7 ? (
                      <Clock className="h-4 w-4 text-yellow-500" />
                    ) : (
                      <Calendar className="h-4 w-4 text-blue-500" />
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Summary */}
        {!showAll && totalAlerts > 5 && (
          <div className="text-center pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAll(true)}
            >
              View {totalAlerts - 5} more alerts
            </Button>
          </div>
        )}

        {/* Quick Actions */}
        <div className="flex items-center gap-2 pt-2 border-t">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchExpiryData}
            disabled={loading}
          >
            Refresh
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push('/products/inventory')}
          >
            Manage Inventory
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
