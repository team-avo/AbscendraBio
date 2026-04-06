'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Warehouse, MapPin, Package, Truck } from 'lucide-react';

interface WarehouseSelectionInfo {
  warehouseId: string;
  warehouseName: string;
  distance: number;
  stockAvailable: boolean;
  coordinates: { lat: number; lng: number };
}

interface ShippingRateInfo {
  rate: number;
  carrier: string;
  estimatedDays: number;
  distance: number;
  warehouse: string;
  warehouseLocation: string;
  reason?: string;
}

interface WarehouseSelectionCardProps {
  warehouseSelection?: WarehouseSelectionInfo;
  shippingRate?: ShippingRateInfo;
  className?: string;
}

export function WarehouseSelectionCard({ 
  warehouseSelection, 
  shippingRate, 
  className 
}: WarehouseSelectionCardProps) {
  if (!warehouseSelection) {
    return null;
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Warehouse className="h-5 w-5" />
          Dispatch Warehouse
        </CardTitle>
        <CardDescription>
          Automatically selected based on your location and stock availability
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Warehouse Info */}
        <div className="flex items-start gap-3">
          <div className="p-2 bg-blue-100 rounded-lg">
            <MapPin className="h-4 w-4 text-blue-600" />
          </div>
          <div className="flex-1">
            <h4 className="font-semibold text-sm">{warehouseSelection.warehouseName}</h4>
            <p className="text-xs text-muted-foreground">
              Distance: {warehouseSelection.distance.toFixed(1)} km
            </p>
          </div>
          <Badge variant={warehouseSelection.stockAvailable ? "default" : "destructive"}>
            {warehouseSelection.stockAvailable ? "In Stock" : "Limited Stock"}
          </Badge>
        </div>

        {/* Shipping Info */}
        {shippingRate && (
          <div className="flex items-start gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <Truck className="h-4 w-4 text-green-600" />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-sm">{shippingRate.carrier}</h4>
                <span className="font-bold text-sm">
                  ${shippingRate.rate.toFixed(2)}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Estimated delivery: {shippingRate.estimatedDays} day{shippingRate.estimatedDays !== 1 ? 's' : ''}
              </p>
              {shippingRate.reason && (
                <p className="text-xs text-green-600 mt-1">
                  {shippingRate.reason}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Stock Warning */}
        {!warehouseSelection.stockAvailable && (
          <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-yellow-600" />
              <p className="text-sm text-yellow-800">
                Some items may be shipped from multiple warehouses
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
