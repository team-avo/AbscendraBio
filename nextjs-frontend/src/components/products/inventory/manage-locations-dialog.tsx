'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { Country, State, City } from 'country-state-city';
import logger from '@/lib/logger';

interface Location {
  id: string;
  name: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
  email?: string;
  mobile?: string;
}

interface ManageLocationsDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  locations: Location[];
}

export function ManageLocationsDialog({ open, onClose, onSuccess, locations }: ManageLocationsDialogProps) {
  const [editing, setEditing] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [loading, setLoading] = useState(false);
  
  // Location address details
  const [country, setCountry] = useState('US');
  const [state, setState] = useState('');
  const [city, setCity] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [email, setEmail] = useState('');
  const [mobile, setMobile] = useState('');

  // Country/State/City data
  const countries = Country.getAllCountries();
  const states = country ? State.getStatesOfCountry(country) : [];
  const cities = country && state ? City.getCitiesOfState(country, state) : [];

  const handleEdit = (loc: Location) => {
    setEditing(loc.id);
    setName(loc.name);
    setAddress(loc.address || '');
    const countryCode = loc.country || 'US';
    setCountry(countryCode);
    
    // Set state - convert from saved value to dropdown value if needed
    const savedState = loc.state || '';
    const stateStates = State.getStatesOfCountry(countryCode);
    const stateMatch = stateStates.find(s => s.isoCode === savedState || s.name === savedState);
    setState(stateMatch?.isoCode || savedState);
    
    // Set city - this is stored as a name, so we just use it directly
    setCity(loc.city || '');
    setPostalCode(loc.postalCode || '');
    setEmail(loc.email || '');
    setMobile(loc.mobile || '');
  };

  const handleCancel = () => {
    setEditing(null);
    setName('');
    setAddress('');
    setCountry('US');
    setState('');
    setCity('');
    setPostalCode('');
    setEmail('');
    setMobile('');
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error('Name is required');
      return;
    }
    setLoading(true);
    try {
      // Get state name from ISO code if needed
      const stateObj = states.find(s => s.isoCode === state);
      const stateName = stateObj?.name || state;
      
      const locationData = {
        name,
        address: address || null,
        country: country || 'US',
        state: stateName || null,
        city: city || null,
        postalCode: postalCode || null,
        email: email || null,
        mobile: mobile || null
      };

      if (editing) {
        await api.put(`/locations/${editing}`, locationData);
        toast.success('Location updated');
      } else {
        await api.post('/locations', locationData);
        toast.success('Location created');
      }
      handleCancel();
      onSuccess();
    } catch (e) {
      logger.error('Error saving location:', { error: e });
      toast.error('Failed to save location');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this location?')) return;
    setLoading(true);
    try {
      await api.delete(`/locations/${id}`);
      toast.success('Location deleted');
      onSuccess();
    } catch (e) {
      toast.error('Failed to delete location');
    } finally {
      setLoading(false);
    }
  };

  const getStateName = () => {
    const stateObj = states.find(s => s.isoCode === state);
    return stateObj?.name || state;
  };

  const getCountryName = () => {
    const countryObj = countries.find(c => c.isoCode === country);
    return countryObj?.name || country;
  };

  const formatLocationAddress = (loc: Location) => {
    const parts = [];
    if (loc.address) parts.push(loc.address);
    if (loc.city) parts.push(loc.city);
    if (loc.state) parts.push(loc.state);
    if (loc.postalCode) parts.push(loc.postalCode);
    if (loc.country && loc.country !== 'US') parts.push(loc.country);
    return parts.join(', ');
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Manage Inventory Locations</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Name</Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="Location name" />
          </div>
          <div>
            <Label>Address</Label>
            <Input value={address} onChange={e => setAddress(e.target.value)} placeholder="Street address (optional)" />
          </div>
          
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label>Country</Label>
              <Select 
                value={country}
                onValueChange={(value) => {
                  setCountry(value);
                  setState('');
                  setCity('');
                }}
              >
                <SelectTrigger>
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
              <Label>State</Label>
              <Select 
                value={state}
                onValueChange={(value) => {
                  setState(value);
                  setCity('');
                }}
                disabled={states.length === 0}
              >
                <SelectTrigger>
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
              <Label>City</Label>
              <Select 
                value={city}
                onValueChange={setCity}
                disabled={cities.length === 0}
              >
                <SelectTrigger>
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
            <Label>Postal Code</Label>
            <Input value={postalCode} onChange={e => setPostalCode(e.target.value)} placeholder="Postal code (optional)" />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Email</Label>
              <Input value={email} onChange={e => setEmail(e.target.value)} placeholder="email@example.com" type="email" />
            </div>
            <div>
              <Label>Mobile</Label>
              <Input value={mobile} onChange={e => setMobile(e.target.value)} placeholder="Mobile number" />
            </div>
          </div>
          
          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleCancel} disabled={loading}>
              Cancel
            </Button>
            <Button type="button" onClick={handleSave} disabled={loading}>
              {editing ? 'Update' : 'Add'} Location
            </Button>
          </DialogFooter>
        </div>
        
        <div className="mt-6">
          <h4 className="font-semibold mb-2">Existing Locations</h4>
          <ul className="space-y-2">
            {locations.map((loc: Location) => (
              <li key={loc.id} className="flex items-center justify-between border rounded p-2">
                <div>
                  <div className="font-medium">{loc.name}</div>
                  {formatLocationAddress(loc) && (
                    <div className="text-xs text-muted-foreground">{formatLocationAddress(loc)}</div>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => handleEdit(loc)} disabled={loading}>Edit</Button>
                  <Button size="sm" variant="destructive" onClick={() => handleDelete(loc.id)} disabled={loading}>Delete</Button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </DialogContent>
    </Dialog>
  );
}
