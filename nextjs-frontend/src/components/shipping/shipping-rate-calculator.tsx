"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Loader2, Truck, Package } from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import logger from '@/lib/logger';

interface ShippingRate {
  carrier: string;
  serviceName: string;
  serviceCode: string;
  rate: number;
  currency: string;
  deliveryDays?: number;
  estimatedDelivery?: string;
}

interface ShippingRateCalculatorProps {
  shipTo: {
    name: string;
    address1: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
  shipFrom: {
    name: string;
    address1: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
  weightOz: number;
  dimensions?: {
    length: number;
    width: number;
    height: number;
    unit: string;
  };
  onRateSelect: (rate: ShippingRate) => void;
  selectedRate?: ShippingRate;
}

export default function ShippingRateCalculator({
  shipTo,
  shipFrom,
  weightOz,
  dimensions,
  onRateSelect,
  selectedRate
}: ShippingRateCalculatorProps) {
  const [rates, setRates] = useState<ShippingRate[]>([]);
  const [loading, setLoading] = useState(false);
  const [carriers, setCarriers] = useState<any[]>([]);
  const [selectedCarrier, setSelectedCarrier] = useState<string>("");
  const [services, setServices] = useState<any[]>([]);
  const [packages, setPackages] = useState<any[]>([]);
  const [selectedService, setSelectedService] = useState<string>("");
  const [selectedPackage, setSelectedPackage] = useState<string>("");

  // Fetch carriers on mount
  useEffect(() => {
    fetchCarriers();
  }, []);

  const fetchCarriers = async () => {
    try {
      const response = await api.get('/shipstation/carriers');
      logger.info('Carriers API response:', { data: response });
      if (response.success) {
        // Handle different response structures
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
      logger.info('Services API response:', { data: response });
      if (response.success) {
        const servicesData = response.data;
        if (Array.isArray(servicesData)) {
          setServices(servicesData);
        } else if (servicesData && Array.isArray(servicesData.services)) {
          setServices(servicesData.services);
        } else if (servicesData && Array.isArray(servicesData.data)) {
          setServices(servicesData.data);
        } else {
          logger.warn('Unexpected services response structure:', { warning: servicesData });
          setServices([]);
        }
      } else {
        logger.error('Failed to fetch services:', { error: response.error });
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
      logger.info('Packages API response:', { data: response });
      if (response.success) {
        const packagesData = response.data;
        if (Array.isArray(packagesData)) {
          setPackages(packagesData);
        } else if (packagesData && Array.isArray(packagesData.packages)) {
          setPackages(packagesData.packages);
        } else if (packagesData && Array.isArray(packagesData.data)) {
          setPackages(packagesData.data);
        } else {
          logger.warn('Unexpected packages response structure:', { warning: packagesData });
          setPackages([]);
        }
      } else {
        logger.error('Failed to fetch packages:', { error: response.error });
        setPackages([]);
      }
    } catch (error) {
      logger.error('Failed to fetch packages:', { error: error });
      setPackages([]);
    }
  };

  const calculateRates = async () => {
    if (!shipTo || !shipFrom || !weightOz) {
      toast.error('Missing required shipping information');
      return;
    }

    setLoading(true);
    try {
      const response = await api.post('/shipstation/rates/estimate', {
        shipTo,
        shipFrom,
        weightOz,
        dimensions,
        carrierCode: selectedCarrier,
        serviceCode: selectedService,
        packageCode: selectedPackage
      });

      if (response.success) {
        const ratesData = response.data;
        let ratesArray = [];
        
        if (Array.isArray(ratesData)) {
          ratesArray = ratesData;
        } else if (ratesData && Array.isArray(ratesData.rates)) {
          ratesArray = ratesData.rates;
        } else if (ratesData && Array.isArray(ratesData.data)) {
          ratesArray = ratesData.data;
        } else {
          logger.warn('Unexpected rates response structure:', { warning: ratesData });
          ratesArray = [];
        }
        
        setRates(ratesArray);
        if (ratesArray.length === 0) {
          toast.info('No shipping rates available for this destination');
        }
      } else {
        toast.error(response.error || 'Failed to calculate shipping rates');
      }
    } catch (error: any) {
      logger.error('Rate calculation error:', { error: error });
      toast.error(error.message || 'Failed to calculate shipping rates');
    } finally {
      setLoading(false);
    }
  };

  const handleCarrierChange = (carrierId: string) => {
    setSelectedCarrier(carrierId);
    setSelectedService("");
    setSelectedPackage("");
    setServices([]);
    setPackages([]);
    
    if (carrierId) {
      fetchServices(carrierId);
      fetchPackages(carrierId);
    }
  };

  const formatDeliveryDate = (estimatedDelivery: string) => {
    try {
      const date = new Date(estimatedDelivery);
      return date.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric'
      });
    } catch {
      return 'TBD';
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Truck className="h-5 w-5" />
          Shipping Options
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Carrier Selection */}
        <div className="space-y-2">
          <Label htmlFor="carrier">Carrier</Label>
          <Select value={selectedCarrier} onValueChange={handleCarrierChange}>
            <SelectTrigger>
              <SelectValue placeholder="Select a carrier" />
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
            <Label htmlFor="service">Service</Label>
            <Select value={selectedService} onValueChange={setSelectedService}>
              <SelectTrigger>
                <SelectValue placeholder="Select a service" />
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
            <Label htmlFor="package">Package Type</Label>
            <Select value={selectedPackage} onValueChange={setSelectedPackage}>
              <SelectTrigger>
                <SelectValue placeholder="Select a package type" />
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

        {/* Calculate Button */}
        <Button 
          onClick={calculateRates} 
          disabled={loading || !selectedCarrier}
          className="w-full"
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Calculating Rates...
            </>
          ) : (
            'Calculate Shipping Rates'
          )}
        </Button>

        {/* Shipping Rates */}
        {Array.isArray(rates) && rates.length > 0 && (
          <div className="space-y-3">
            <Label>Available Rates</Label>
            {rates.map((rate, index) => (
              <Card 
                key={index} 
                className={`cursor-pointer transition-colors ${
                  selectedRate?.serviceCode === rate.serviceCode 
                    ? 'ring-2 ring-blue-500 bg-blue-50' 
                    : 'hover:bg-gray-50'
                }`}
                onClick={() => onRateSelect(rate)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Package className="h-4 w-4 text-gray-500" />
                      <div>
                        <div className="font-medium">{rate.serviceName}</div>
                        <div className="text-sm text-gray-500">
                          {rate.carrier.toUpperCase()}
                          {rate.deliveryDays && ` • ${rate.deliveryDays} business days`}
                        </div>
                        {rate.estimatedDelivery && (
                          <div className="text-xs text-gray-400">
                            Est. delivery: {formatDeliveryDate(rate.estimatedDelivery)}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold">
                        ${rate.rate.toFixed(2)}
                      </div>
                      <div className="text-xs text-gray-500">
                        {rate.currency}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Selected Rate Summary */}
        {selectedRate && (
          <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium text-green-800">
                  Selected: {selectedRate.serviceName}
                </div>
                <div className="text-sm text-green-600">
                  {selectedRate.carrier.toUpperCase()}
                </div>
              </div>
              <div className="font-semibold text-green-800">
                ${selectedRate.rate.toFixed(2)}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
