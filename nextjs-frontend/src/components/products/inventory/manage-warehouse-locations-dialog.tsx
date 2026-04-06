'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { Country, State, City } from 'country-state-city';
import { Warehouse } from 'lucide-react';
import logger from '@/lib/logger';

interface WarehouseLocation {
  id: string;
  name: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
  email?: string;
  mobile?: string;
  isActive?: boolean;
}

interface ManageWarehouseLocationsDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  location: WarehouseLocation | null;
}

export function ManageWarehouseLocationsDialog({
  open,
  onClose,
  onSuccess,
  location
}: ManageWarehouseLocationsDialogProps) {
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [isActive, setIsActive] = useState(true);

  // Location address details
  const [country, setCountry] = useState('US');
  const [state, setState] = useState('');
  const [city, setCity] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [email, setEmail] = useState('');
  const [mobileCountryCode, setMobileCountryCode] = useState('US');
  const [mobileNumber, setMobileNumber] = useState('');

  // Country/State/City data
  const countries = Country.getAllCountries();
  const states = country ? State.getStatesOfCountry(country) : [];
  const cities = country && state ? City.getCitiesOfState(country, state) : [];

  // Initialize form when editing
  useEffect(() => {
    if (location) {
      setName(location.name || '');
      setAddress(location.address || '');
      setIsActive(location.isActive !== false);
      const countryCode = location.country || 'US';
      setCountry(countryCode);

      // Set state - convert from saved value to dropdown value if needed
      const savedState = location.state || '';
      const stateStates = State.getStatesOfCountry(countryCode);
      const stateMatch = stateStates.find(s => s.isoCode === savedState || s.name === savedState);
      setState(stateMatch?.isoCode || savedState);

      setCity(location.city || '');
      setPostalCode(location.postalCode || '');
      setEmail(location.email || '');

      // Parse mobile number for country code and number
      const mobile = location.mobile || '';
      if (mobile.startsWith('+')) {
        // Extract country code from mobile number
        const countryMatch = countries.find(c => mobile.startsWith(`+${c.phonecode}`));
        if (countryMatch) {
          setMobileCountryCode(countryMatch.isoCode);
          setMobileNumber(mobile.substring(`+${countryMatch.phonecode}`.length));
        } else {
          setMobileCountryCode('US');
          setMobileNumber(mobile);
        }
      } else {
        setMobileCountryCode('US');
        setMobileNumber(mobile);
      }
    } else {
      // Reset form for new location
      setName('');
      setAddress('');
      setIsActive(true);
      setCountry('US');
      setState('');
      setCity('');
      setPostalCode('');
      setEmail('');
      setMobileCountryCode('US');
      setMobileNumber('');
    }
  }, [location, open]);

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error('Warehouse name is required');
      return;
    }
    setLoading(true);
    try {
      // Get state name from ISO code if needed
      const stateObj = states.find(s => s.isoCode === state);
      const stateName = stateObj?.name || state;

      // Format mobile number with country code
      const countryObj = countries.find(c => c.isoCode === mobileCountryCode);
      const formattedMobile = countryObj && mobileNumber
        ? `+${countryObj.phonecode}${mobileNumber}`
        : mobileNumber || null;

      const locationData = {
        name,
        address: address || null,
        country: country || 'US',
        state: stateName || null,
        city: city || null,
        postalCode: postalCode || null,
        email: email || null,
        mobile: formattedMobile,
        isActive
      };

      if (location) {
        await api.put(`/locations/${location.id}`, locationData);
        toast.success('Warehouse location updated');
      } else {
        await api.post('/locations', locationData);
        toast.success('Warehouse location created');
      }
      onSuccess();
    } catch (e) {
      logger.error('Error saving warehouse location:', { error: e });
      toast.error('Failed to save warehouse location');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] md:max-w-3xl w-[95vw] max-h-[90vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Warehouse className="h-5 w-5" />
            {location ? 'Edit Warehouse Location' : 'Add Warehouse Location'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="location-name">Warehouse Name *</Label>
            <Input
              id="location-name"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g., Main Warehouse, Distribution Center"
            />
          </div>

          <div>
            <Label htmlFor="location-address">Street Address (optional)</Label>
            <Input
              id="location-address"
              value={address}
              onChange={e => setAddress(e.target.value)}
              placeholder="123 Warehouse St"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="country">Country</Label>
              <Select
                value={country}
                onValueChange={(value) => {
                  setCountry(value);
                  setState('');
                  setCity('');
                }}
              >
                <SelectTrigger id="country">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  {countries.map((c) => (
                    <SelectItem key={c.isoCode} value={c.isoCode}>
                      {c.flag} {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="state">State</Label>
              <Select
                value={state}
                onValueChange={(value) => {
                  setState(value);
                  setCity('');
                }}
                disabled={states.length === 0}
              >
                <SelectTrigger id="state">
                  <SelectValue placeholder={states.length === 0 ? "Select country first" : "Select state"} />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  {states.map((s) => (
                    <SelectItem key={s.isoCode} value={s.isoCode}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="city">City</Label>
              <Select
                value={city}
                onValueChange={setCity}
                disabled={cities.length === 0}
              >
                <SelectTrigger id="city">
                  <SelectValue placeholder={cities.length === 0 ? "Select state first" : "Select city"} />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  {cities.map((c) => (
                    <SelectItem key={c.name} value={c.name}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="postal-code">Postal Code (optional)</Label>
            <Input
              id="postal-code"
              value={postalCode}
              onChange={e => setPostalCode(e.target.value)}
              placeholder="12345"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="warehouse@example.com"
                type="email"
              />
            </div>
            <div>
              <Label htmlFor="mobile">Mobile Number</Label>
              <div className="flex gap-2">
                <Select
                  value={mobileCountryCode}
                  onValueChange={setMobileCountryCode}
                >
                  <SelectTrigger className="w-[120px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {countries.map((c) => (
                      <SelectItem key={c.isoCode} value={c.isoCode}>
                        {c.flag} +{c.phonecode}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  id="mobile"
                  value={mobileNumber}
                  onChange={e => setMobileNumber(e.target.value)}
                  placeholder="234 567 8900"
                  className="flex-1"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="is-active"
              checked={isActive}
              onCheckedChange={setIsActive}
            />
            <Label htmlFor="is-active">Active</Label>
            <span className="text-sm text-muted-foreground">
              {isActive ? '' : ''}
            </span>
          </div>

          <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="button" onClick={handleSave} disabled={loading || !name.trim()}>
              {location ? 'Update' : 'Add'} Warehouse Location
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}

