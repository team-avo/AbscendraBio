'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Package, TrendingDown, Zap } from 'lucide-react';
import { api } from '@/lib/api';
import logger from '@/lib/logger';

interface StockItem {
  id: string;
  quantity: number;
  reservedQty?: number;
  lowStockAlert: number;
  variant: {
    id: string;
    sku: string;
    name: string;
    product: {
      name: string;
      status: string;
    };
  };
  location: {
    id: string;
    name: string;
  };
}

export function StockAlerts() {
  const router = useRouter();
  const [lowStockItems, setLowStockItems] = useState<StockItem[]>([]);
  const [outOfStockItems, setOutOfStockItems] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    fetchStockData();
  }, []);

  const fetchStockData = async () => {
    try {
      setLoading(true);

      // Fetch low stock items
      try {
        const lowStockResponse = await api.getLowStockItems();
        if (lowStockResponse.success) {
          setLowStockItems(lowStockResponse.data || []);
        } else {
          logger.warn('Failed to fetch low stock items:', { warning: lowStockResponse.error });
          setLowStockItems([]);
        }
      } catch (error) {
        logger.warn('Error fetching low stock items:', { warning: error });
        setLowStockItems([]);
      }

      // Fetch out of stock items
      try {
        const outOfStockResponse = await api.getOutOfStockItems();
        if (outOfStockResponse.success) {
          const data = outOfStockResponse.data?.inventory || outOfStockResponse.data || [];
          setOutOfStockItems(data);
        } else {
          logger.warn('Failed to fetch out of stock items:', { warning: outOfStockResponse.error });
          setOutOfStockItems([]);
        }
      } catch (error) {
        logger.warn('Error fetching out of stock items:', { warning: error });
        setOutOfStockItems([]);
      }
    } catch (error) {
      logger.error('Failed to fetch stock data:', { error: error });
      setLowStockItems([]);
      setOutOfStockItems([]);
    } finally {
      setLoading(false);
    }
  };

  const getAvailableQuantity = (item: StockItem) => {
    const total = item.quantity || 0;
    const reserved = item.reservedQty || 0;
    return Math.max(0, total - reserved);
  };

  const getStockBadge = (item: StockItem) => {
    const available = getAvailableQuantity(item);

    if (available <= 0) {
      return <Badge variant="destructive" className="flex items-center gap-1">
        <AlertTriangle className="h-3 w-3" />
        Out of Stock
      </Badge>;
    } else if (available <= item.lowStockAlert) {
      return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 flex items-center gap-1">
        <TrendingDown className="h-3 w-3" />
        Low Stock
      </Badge>; 
    }

    return <Badge variant="outline">Normal</Badge>;
  };

  const totalAlerts = lowStockItems.length + outOfStockItems.length;
  const displayItems = showAll
    ? [...outOfStockItems, ...lowStockItems]
    : [...outOfStockItems.slice(0, 2), ...lowStockItems.slice(0, 3)];

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-blue-500" />
            Stock Alerts
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
            Stock Alerts
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <Package className="h-12 w-12 mx-auto mb-3 text-green-500 opacity-50" />
            <p className="text-sm font-medium text-muted-foreground mb-1">All Stock Levels Healthy</p>
            <p className="text-xs text-muted-foreground">No low stock or out of stock items detected</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-blue-500" />
            <span>Stock Alerts</span>
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

        {/* Stock Breakdown - Top */}
        <div className="grid grid-cols-2 gap-2">
          <div className="text-center py-2 rounded-lg bg-red-50 border border-red-200">
            <div className="text-2xl font-bold text-red-600">{outOfStockItems.length}</div>
            <div className="text-xs text-muted-foreground">Out of Stock</div>
          </div>
          <div className="text-center py-2 rounded-lg bg-yellow-50 border border-yellow-200">
            <div className="text-2xl font-bold text-yellow-600">{lowStockItems.length}</div>
            <div className="text-xs text-muted-foreground">Low Stock</div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col space-y-3 overflow-hidden">
        {/* Stock Items List - Scrollable */}
        <div className={`flex-1 overflow-y-auto pr-2 space-y-3 ${showAll ? 'max-h-96' : 'max-h-64'}`}>
          {displayItems.map((item) => {
            const available = getAvailableQuantity(item);
            const isOutOfStock = available <= 0;

            return (
              <div
                key={item.id}
                className={`p-3 rounded-lg border transition-colors flex-shrink-0 ${isOutOfStock
                  ? 'border-red-500 bg-red-50/50 hover:bg-red-50'
                  : 'border-yellow-500 bg-yellow-50/50 hover:bg-yellow-50'
                  }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <h4 className="font-semibold text-sm">
                        {item.variant.product.name}
                      </h4>
                      {getStockBadge(item)}
                    </div>
                    <div className="text-xs text-muted-foreground space-y-1">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <span className="font-medium">{item.variant.name}</span>
                        <span>SKU: {item.variant.sku}</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <div className="flex items-center gap-2">
                          <span>Available:</span>
                          <span className={`font-semibold ${isOutOfStock ? 'text-red-600' : 'text-yellow-600'}`}>
                            {available}
                          </span>
                        </div>
                        <span>•</span>
                        <div className="flex items-center gap-2">
                          <span>Total:</span>
                          <span>{item.quantity}</span>
                        </div>
                        {(item.reservedQty ?? 0) > 0 && (
                          <>
                            <span>•</span>
                            <div className="flex items-center gap-2">
                              <span>Reserved:</span>
                              <span>{item.reservedQty}</span>
                            </div>
                          </>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span>Location: {item.location.name}</span>
                        <span>•</span>
                        <span>Low Stock Threshold: {item.lowStockAlert}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 ml-2 flex-shrink-0">
                    {isOutOfStock ? (
                      <AlertTriangle className="h-5 w-5 text-red-500" />
                    ) : (
                      <TrendingDown className="h-5 w-5 text-yellow-500" />
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Quick Actions */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t mt-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchStockData}
            disabled={loading}
          >
            Refresh
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push('/inventory')}
          >
            Manage Inventory
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
