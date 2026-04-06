"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Package, Truck, Eye, Download, X } from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { format } from "date-fns";
import logger from '@/lib/logger';

interface ShipmentData {
  id: string;
  orderId: string;
  carrier: string;
  trackingNumber?: string;
  trackingUrl?: string;
  status: string;
  shippedAt?: string;
  deliveredAt?: string;
  createdAt: string;
  updatedAt: string;
}

interface TrackingEvent {
  id: string;
  eventType: string;
  description: string;
  location?: string;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
  occurredAt: string;
}

interface ShipmentManagerProps {
  orderId: string;
  order: {
    id: string;
    orderNumber: string;
    status: string;
    shippingAddress: any;
    billingAddress: any;
    items: any[];
    shipmentTrackingNumber?: string;
    estimatedShippingCost?: number;
    shipmentRequestStatus?: string;
  };
  onShipmentCreated?: (shipment: ShipmentData) => void;
}

export default function ShipmentManager({ orderId, order, onShipmentCreated }: ShipmentManagerProps) {
  const [shipment, setShipment] = useState<ShipmentData | null>(null);
  const [trackingEvents, setTrackingEvents] = useState<TrackingEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [creatingShipment, setCreatingShipment] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showTrackingDialog, setShowTrackingDialog] = useState(false);
  
  // Shipment creation form
  const [shipmentForm, setShipmentForm] = useState({
    carrierCode: '',
    serviceCode: '',
    packageCode: '',
    weightOz: 16,
    dimensions: {
      length: 10,
      width: 8,
      height: 6,
      unit: 'inches'
    }
  });

  const [carriers, setCarriers] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [packages, setPackages] = useState<any[]>([]);

  useEffect(() => {
    fetchCarriers();
    if (order.shipmentTrackingNumber) {
      fetchTrackingEvents();
    }
  }, [order.shipmentTrackingNumber]);

  const fetchCarriers = async () => {
    try {
      const response = await api.get('/shipstation/carriers');
      logger.info('Shipment Manager - Carriers API response:', { data: response });
      if (response.success) {
        const carriersData = response.data;
        if (Array.isArray(carriersData)) {
          setCarriers(carriersData);
        } else if (carriersData && Array.isArray(carriersData.carriers)) {
          setCarriers(carriersData.carriers);
        } else if (carriersData && Array.isArray(carriersData.data)) {
          setCarriers(carriersData.data);
        } else {
          logger.warn('Unexpected carriers response structure:', { warning: carriersData });
          setCarriers([]);
        }
      } else {
        logger.error('Failed to fetch carriers:', { error: response.error });
        setCarriers([]);
      }
    } catch (error) {
      logger.error('Failed to fetch carriers:', { error: error });
      setCarriers([]);
    }
  };

  const fetchServices = async (carrierId: string) => {
    try {
      const response = await api.get(`/shipstation/carriers/${carrierId}/services`);
      if (response.success) {
        const servicesData = response.data;
        if (Array.isArray(servicesData)) {
          setServices(servicesData);
        } else if (servicesData && Array.isArray(servicesData.services)) {
          setServices(servicesData.services);
        } else if (servicesData && Array.isArray(servicesData.data)) {
          setServices(servicesData.data);
        } else {
          setServices([]);
        }
      } else {
        setServices([]);
      }
    } catch (error) {
      logger.error('Failed to fetch services:', { error: error });
      setServices([]);
    }
  };

  const fetchPackages = async (carrierId: string) => {
    try {
      const response = await api.get(`/shipstation/carriers/${carrierId}/packages`);
      if (response.success) {
        const packagesData = response.data;
        if (Array.isArray(packagesData)) {
          setPackages(packagesData);
        } else if (packagesData && Array.isArray(packagesData.packages)) {
          setPackages(packagesData.packages);
        } else if (packagesData && Array.isArray(packagesData.data)) {
          setPackages(packagesData.data);
        } else {
          setPackages([]);
        }
      } else {
        setPackages([]);
      }
    } catch (error) {
      logger.error('Failed to fetch packages:', { error: error });
      setPackages([]);
    }
  };

  const fetchTrackingEvents = async () => {
    if (!order.shipmentTrackingNumber) return;
    
    setLoading(true);
    try {
      const response = await api.post('/shipstation/tracking/sync', {
        orderId: order.id,
        trackingNumber: order.shipmentTrackingNumber
      });

      if (response.success) {
        // Fetch tracking events from our database
        const eventsResponse = await api.get(`/orders/${orderId}/tracking-events`);
        if (eventsResponse.success) {
          setTrackingEvents(eventsResponse.data || []);
        }
      }
    } catch (error) {
      logger.error('Failed to fetch tracking events:', { error: error });
    } finally {
      setLoading(false);
    }
  };

  const createShipment = async () => {
    if (!order.shippingAddress) {
      toast.error('No shipping address found');
      return;
    }

    setCreatingShipment(true);
    try {
      const response = await api.post('/shipstation/labels', {
        orderId: order.id,
        shipTo: {
          name: `${order.shippingAddress.firstName} ${order.shippingAddress.lastName}`,
          address1: order.shippingAddress.address1,
          address2: order.shippingAddress.address2,
          city: order.shippingAddress.city,
          state: order.shippingAddress.state,
          postalCode: order.shippingAddress.postalCode,
          country: order.shippingAddress.country
        },
        shipFrom: {
          name: "Your Store",
          address1: "123 Warehouse St",
          city: "Los Angeles",
          state: "CA",
          postalCode: "90210",
          country: "US"
        },
        ...shipmentForm
      });

      if (response.success) {
        toast.success('Shipment created successfully');
        setShowCreateDialog(false);
        onShipmentCreated?.(response.data.order);
        
        // Update local state
        if (response.data.label?.trackingNumber) {
          fetchTrackingEvents();
        }
      } else {
        toast.error(response.error || 'Failed to create shipment');
      }
    } catch (error: any) {
      logger.error('Shipment creation error:', { error: error });
      toast.error(error.message || 'Failed to create shipment');
    } finally {
      setCreatingShipment(false);
    }
  };

  const handleCarrierChange = (carrierId: string) => {
    setShipmentForm(prev => ({ ...prev, carrierCode: carrierId, serviceCode: '', packageCode: '' }));
    setServices([]);
    setPackages([]);
    
    if (carrierId) {
      fetchServices(carrierId);
      fetchPackages(carrierId);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'delivered': return 'bg-green-100 text-green-800';
      case 'in_transit': return 'bg-blue-100 text-blue-800';
      case 'shipped': return 'bg-purple-100 text-purple-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getShipmentStatusColor = (status: string) => {
    switch (status) {
      case 'DELIVERED': return 'bg-green-100 text-green-800';
      case 'ON_THE_WAY': return 'bg-blue-100 text-blue-800';
      case 'ACCEPTED_BY_SHIPPER': return 'bg-purple-100 text-purple-800';
      case 'CREATED': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-4">
      {/* Shipment Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Shipment Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          {order.shipmentTrackingNumber ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">Tracking Number</div>
                  <div className="text-sm text-gray-600">{order.shipmentTrackingNumber}</div>
                </div>
                <Badge className={getShipmentStatusColor(order.shipmentRequestStatus || 'CREATED')}>
                  {order.shipmentRequestStatus || 'CREATED'}
                </Badge>
              </div>
              
              {order.estimatedShippingCost && (
                <div className="text-sm text-gray-600">
                  Shipping Cost: ${order.estimatedShippingCost.toFixed(2)}
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowTrackingDialog(true)}
                >
                  <Eye className="h-4 w-4 mr-2" />
                  View Tracking
                </Button>
                
                {(order as any).trackingUrl && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open((order as any).trackingUrl, '_blank')}
                  >
                    <Truck className="h-4 w-4 mr-2" />
                    Track Package
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center py-4">
              <Package className="h-12 w-12 text-gray-400 mx-auto mb-2" />
              <div className="text-gray-600 mb-4">No shipment created yet</div>
              <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
                <DialogTrigger asChild>
                  <Button>Create Shipment</Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Create Shipment</DialogTitle>
                  </DialogHeader>
                  
                  <div className="space-y-4">
                    {/* Carrier Selection */}
                    <div className="space-y-2">
                      <Label>Carrier</Label>
                      <Select value={shipmentForm.carrierCode} onValueChange={handleCarrierChange}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select carrier" />
                        </SelectTrigger>
                        <SelectContent>
                          {Array.isArray(carriers) && carriers.map((carrier) => (
                            <SelectItem key={carrier.carrierId || carrier.id} value={carrier.carrierId || carrier.id}>
                              {carrier.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Service Selection */}
                    {services.length > 0 && (
                      <div className="space-y-2">
                        <Label>Service</Label>
                        <Select value={shipmentForm.serviceCode} onValueChange={(value) => 
                          setShipmentForm(prev => ({ ...prev, serviceCode: value }))
                        }>
                          <SelectTrigger>
                            <SelectValue placeholder="Select service" />
                          </SelectTrigger>
                          <SelectContent>
                            {Array.isArray(services) && services.map((service) => (
                              <SelectItem key={service.serviceId || service.id} value={service.serviceCode || service.code}>
                                {service.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    {/* Package Selection */}
                    {packages.length > 0 && (
                      <div className="space-y-2">
                        <Label>Package Type</Label>
                        <Select value={shipmentForm.packageCode} onValueChange={(value) => 
                          setShipmentForm(prev => ({ ...prev, packageCode: value }))
                        }>
                          <SelectTrigger>
                            <SelectValue placeholder="Select package type" />
                          </SelectTrigger>
                          <SelectContent>
                            {Array.isArray(packages) && packages.map((pkg) => (
                              <SelectItem key={pkg.packageId || pkg.id} value={pkg.packageId || pkg.id}>
                                {pkg.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    {/* Weight */}
                    <div className="space-y-2">
                      <Label>Weight (oz)</Label>
                      <Input
                        type="number"
                        value={shipmentForm.weightOz}
                        onChange={(e) => setShipmentForm(prev => ({ 
                          ...prev, 
                          weightOz: parseFloat(e.target.value) || 16 
                        }))}
                      />
                    </div>

                    {/* Dimensions */}
                    <div className="grid grid-cols-3 gap-2">
                      <div className="space-y-2">
                        <Label>Length</Label>
                        <Input
                          type="number"
                          value={shipmentForm.dimensions.length}
                          onChange={(e) => setShipmentForm(prev => ({ 
                            ...prev, 
                            dimensions: { 
                              ...prev.dimensions, 
                              length: parseFloat(e.target.value) || 10 
                            }
                          }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Width</Label>
                        <Input
                          type="number"
                          value={shipmentForm.dimensions.width}
                          onChange={(e) => setShipmentForm(prev => ({ 
                            ...prev, 
                            dimensions: { 
                              ...prev.dimensions, 
                              width: parseFloat(e.target.value) || 8 
                            }
                          }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Height</Label>
                        <Input
                          type="number"
                          value={shipmentForm.dimensions.height}
                          onChange={(e) => setShipmentForm(prev => ({ 
                            ...prev, 
                            dimensions: { 
                              ...prev.dimensions, 
                              height: parseFloat(e.target.value) || 6 
                            }
                          }))}
                        />
                      </div>
                    </div>

                    <div className="flex gap-2 pt-4">
                      <Button
                        variant="outline"
                        onClick={() => setShowCreateDialog(false)}
                        className="flex-1"
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={createShipment}
                        disabled={creatingShipment || !shipmentForm.carrierCode}
                        className="flex-1"
                      >
                        {creatingShipment ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Creating...
                          </>
                        ) : (
                          'Create Shipment'
                        )}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tracking Events Dialog */}
      <Dialog open={showTrackingDialog} onOpenChange={setShowTrackingDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Tracking Information</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : trackingEvents.length > 0 ? (
              <div className="space-y-3">
                {trackingEvents.map((event, index) => (
                  <div key={event.id} className="flex items-start gap-3 p-3 border rounded-lg">
                    <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
                    <div className="flex-1">
                      <div className="font-medium">{event.description}</div>
                      {event.location && (
                        <div className="text-sm text-gray-600">{event.location}</div>
                      )}
                      <div className="text-xs text-gray-500">
                        {format(new Date(event.occurredAt), 'MMM dd, yyyy h:mm a')}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                No tracking events available
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
