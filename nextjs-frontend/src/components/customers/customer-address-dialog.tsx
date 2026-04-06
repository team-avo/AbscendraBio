'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Plus, Edit, Trash2, MapPin, Home, Building } from 'lucide-react';
import { api, Customer, Address, getCustomCountries, getCustomStates, getCustomCities } from '@/lib/api';
import { toast } from 'sonner';
import { Country, State, City } from 'country-state-city';
import { PhoneInputWithFlag } from './phone-input-with-flag';
import logger from '@/lib/logger';

interface CustomerAddressDialogProps {
  customer: Customer | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

interface AddressFormData {
  type: 'BILLING' | 'SHIPPING';
  firstName: string;
  lastName: string;
  company: string;
  address1: string;
  address2: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  phone: string;
  isDefault: boolean;
}

export function CustomerAddressDialog({ customer, open, onOpenChange, onSuccess }: CustomerAddressDialogProps) {
  const [loading, setLoading] = useState(false);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingAddress, setEditingAddress] = useState<Address | null>(null);
  const [formData, setFormData] = useState<AddressFormData>({
    type: 'BILLING',
    firstName: '',
    lastName: '',
    company: '',
    address1: '',
    address2: '',
    city: '',
    state: '',
    postalCode: '',
    country: 'United States',
    phone: '',
    isDefault: false,
  });

  // Country-State-City data
  const [selectedCountry, setSelectedCountry] = useState('United States');
  const [selectedState, setSelectedState] = useState('');
  const [selectedCity, setSelectedCity] = useState('');

  // Custom location states
  const [customCountries, setCustomCountries] = useState<string[]>([]);
  const [customStates, setCustomStates] = useState<string[]>([]);
  const [customCities, setCustomCities] = useState<string[]>([]);

  // Add new location dialog
  const [addLocationDialog, setAddLocationDialog] = useState<{
    open: boolean;
    type: 'state' | 'city' | null;
    country: string;
    state?: string;
  }>({
    open: false,
    type: null,
    country: '',
    state: ''
  });
  const [newLocationName, setNewLocationName] = useState('');
  const [savingLocation, setSavingLocation] = useState(false);

  // Load custom countries on mount
  useEffect(() => {
    const loadCountries = async () => {
      try {
        const response = await getCustomCountries();
        if (response.success && response.data) {
          setCustomCountries(response.data);
        }
      } catch (error) {
        logger.error('Failed to load custom countries:', { error: error });
      }
    };
    loadCountries();
  }, []);

  // Load custom states when country changes
  useEffect(() => {
    const loadStates = async () => {
      if (!selectedCountry) {
        setCustomStates([]);
        return;
      }
      try {
        const response = await getCustomStates(selectedCountry);
        if (response.success && response.data) {
          setCustomStates(response.data);
        }
      } catch (error) {
        setCustomStates([]);
      }
    };
    loadStates();
  }, [selectedCountry]);

  // Load custom cities when state changes
  useEffect(() => {
    const loadCities = async () => {
      if (!selectedCountry || !selectedState) {
        setCustomCities([]);
        return;
      }
      try {
        const response = await getCustomCities(selectedCountry, selectedState);
        if (response.success && response.data) {
          setCustomCities(response.data);
        }
      } catch (error) {
        setCustomCities([]);
      }
    };
    loadCities();
  }, [selectedCountry, selectedState]);

  const resolveCountryIso = (value: string) => {
    if (!value) return "United States";
    const byIso = Country.getAllCountries().find(
      c => c.isoCode.toLowerCase() === value.toLowerCase()
    );
    if (byIso) return byIso.name;
    const byName = Country.getAllCountries().find(
      c => c.name.toLowerCase() === value.toLowerCase()
    );
    if (byName) return byName.name;
    return value;
  };

  const resolveStateIso = (countryName: string, value: string) => {
    if (!countryName || !value) return "";
    const country = Country.getAllCountries().find(
      c => c.name.toLowerCase() === countryName.toLowerCase() ||
        c.isoCode.toLowerCase() === countryName.toLowerCase()
    );
    if (country) {
      const states = State.getStatesOfCountry(country.isoCode);
      const byIso = states.find(s => s.isoCode.toLowerCase() === value.toLowerCase());
      if (byIso) return byIso.name;
      const byName = states.find(s => s.name.toLowerCase() === value.toLowerCase());
      if (byName) return byName.name;
    }
    return value;
  };

  // Handle adding new location locally
  const handleAddLocation = (type: 'state' | 'city') => {
    setAddLocationDialog({
      open: true,
      type,
      country: selectedCountry,
      state: type === 'city' ? selectedState : undefined
    });
    setNewLocationName('');
  };

  const handleSaveLocation = async () => {
    if (!newLocationName.trim()) {
      toast.error('Please enter a name');
      return;
    }
    setSavingLocation(true);
    await new Promise(resolve => setTimeout(resolve, 300)); // Sim delay

    try {
      const newValue = newLocationName.trim();
      if (addLocationDialog.type === 'state') {
        setSelectedState(newValue);
        setFormData(prev => ({ ...prev, state: newValue, city: '' }));
        setCustomCities([]);
      } else if (addLocationDialog.type === 'city') {
        setSelectedCity(newValue);
        setFormData(prev => ({ ...prev, city: newValue }));
      }
      toast.success(`${addLocationDialog.type === 'state' ? 'State' : 'City'} added to address`);
      setAddLocationDialog({ open: false, type: null, country: '', state: '' });
      setNewLocationName('');
    } finally {
      setSavingLocation(false);
    }
  };

  // Initialize with US as default when dialog opens
  useEffect(() => {
    if (open && !editingAddress) {
      resetForm();
    }
  }, [open, editingAddress]);

  useEffect(() => {
    if (customer && open) {
      fetchAddresses();
    }
  }, [customer, open]);

  const fetchAddresses = async () => {
    if (!customer) return;

    try {
      const response = await api.getCustomer(customer.id);
      if (response.success && response.data) {
        setAddresses(response.data.addresses || []);
      }
    } catch (error) {
      logger.error('Failed to fetch addresses:', { error: error });
      toast.error('Failed to load addresses');
    }
  };

  const resetForm = () => {
    setFormData({
      type: 'BILLING',
      firstName: customer?.firstName || '',
      lastName: customer?.lastName || '',
      company: '',
      address1: '',
      address2: '',
      city: '',
      state: '',
      postalCode: '',
      country: 'United States',
      phone: customer?.mobile || '',
      isDefault: false,
    });
    setSelectedCountry('United States');
    setSelectedState('');
    setSelectedCity('');
  };

  const handleAddAddress = () => {
    resetForm();
    setShowAddForm(true);
    setEditingAddress(null);
  };

  const handleEditAddress = (address: Address) => {
    // Resolve location names from potential ISO codes
    const cName = resolveCountryIso(address.country);
    const sName = resolveStateIso(cName, address.state);

    setFormData({
      type: address.type,
      firstName: address.firstName,
      lastName: address.lastName,
      company: address.company || '',
      address1: address.address1,
      address2: address.address2 || '',
      city: address.city,
      state: sName,
      postalCode: address.postalCode,
      country: cName,
      phone: address.phone || '',
      isDefault: address.isDefault,
    });

    setSelectedCountry(cName);
    setSelectedState(sName);
    setSelectedCity(address.city);

    setEditingAddress(address);
    setShowAddForm(true);
  };

  const handleDeleteAddress = async (addressId: string) => {
    if (!customer) return;

    try {
      setLoading(true);
      const response = await api.deleteAddress(customer.id, addressId);
      if (response.success) {
        toast.success('Address deleted successfully');
        fetchAddresses();
      } else {
        toast.error(response.error || 'Failed to delete address');
      }
    } catch (error) {
      logger.error('Failed to delete address:', { error: error });
      toast.error('Failed to delete address');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!customer || !formData.firstName || !formData.lastName || !formData.address1 || !formData.city || !formData.state || !formData.postalCode) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      setLoading(true);

      if (editingAddress) {
        const response = await api.updateAddress(customer.id, editingAddress.id, formData);
        if (response.success) {
          toast.success('Address updated successfully');
        } else {
          toast.error(response.error || 'Failed to update address');
          return;
        }
      } else {
        const response = await api.createAddress(customer.id, formData);
        if (response.success) {
          toast.success('Address added successfully');
        } else {
          toast.error(response.error || 'Failed to add address');
          return;
        }
      }
      setShowAddForm(false);
      setEditingAddress(null);
      fetchAddresses();
    } catch (error) {
      logger.error('Failed to save address:', { error: error });
      toast.error('Failed to save address');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: keyof AddressFormData, value: string | boolean) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };



  const getAddressTypeIcon = (type: string) => {
    return type === 'BILLING' ? <Building className="h-4 w-4" /> : <Home className="h-4 w-4" />;
  };

  if (!customer) return null;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto w-[calc(100vw-2rem)] sm:w-full p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle>Manage Addresses</DialogTitle>
            <DialogDescription>
              Manage addresses for {customer.firstName} {customer.lastName}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* Address List */}
            {!showAddForm && (
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <h3 className="text-lg font-medium">Addresses ({addresses.length})</h3>
                  <Button onClick={handleAddAddress} size="sm" className="w-full sm:w-auto">
                    <Plus className="mr-2 h-4 w-4" />
                    Add Address
                  </Button>
                </div>

                {addresses.length === 0 ? (
                  <Card>
                    <CardContent className="flex flex-col items-center justify-center py-8">
                      <MapPin className="h-12 w-12 text-muted-foreground mb-4" />
                      <p className="text-muted-foreground text-center">
                        No addresses found for this customer.
                      </p>
                      <Button onClick={handleAddAddress} className="mt-4">
                        <Plus className="mr-2 h-4 w-4" />
                        Add First Address
                      </Button>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-3">
                    {addresses.map((address) => (
                      <Card key={address.id}>
                        <CardHeader className="p-4 sm:pb-3">
                          <div className="flex flex-col xs:flex-row items-start xs:items-center justify-between gap-3">
                            <div className="flex items-center space-x-2">
                              {getAddressTypeIcon(address.type)}
                              <CardTitle className="text-sm sm:text-base font-semibold">
                                {address.type} Address
                              </CardTitle>
                              {address.isDefault && (
                                <Badge variant="outline" className="bg-primary/5 text-primary text-[10px] h-5">Default</Badge>
                              )}
                            </div>
                            <div className="flex flex-wrap items-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground hover:text-primary"
                                onClick={() => handleEditAddress(address)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                onClick={() => handleDeleteAddress(address.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="pt-0">
                          <div className="space-y-2 text-sm">
                            <div>
                              <strong>{address.firstName} {address.lastName}</strong>
                              {address.company && (
                                <span className="text-muted-foreground"> • {address.company}</span>
                              )}
                            </div>
                            <div>{address.address1}</div>
                            {address.address2 && <div>{address.address2}</div>}
                            <div>
                              {address.city}, {address.state} {address.postalCode}
                            </div>
                            <div>{address.country}</div>
                            {address.phone && <div>{address.phone}</div>}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Add/Edit Address Form */}
            {showAddForm && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium">
                    {editingAddress ? 'Edit Address' : 'Add New Address'}
                  </h3>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setShowAddForm(false);
                      setEditingAddress(null);
                    }}
                  >
                    Cancel
                  </Button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="type">Address Type *</Label>
                      <Select
                        value={formData.type}
                        onValueChange={(value: 'BILLING' | 'SHIPPING') => handleInputChange('type', value)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="BILLING">Billing Address</SelectItem>
                          <SelectItem value="SHIPPING">Shipping Address</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="isDefault">Default Address</Label>
                      <div className="flex items-center space-x-2">
                        <Switch
                          id="isDefault"
                          checked={formData.isDefault}
                          onCheckedChange={(checked) => handleInputChange('isDefault', checked)}
                        />
                        <Label htmlFor="isDefault" className="text-sm">
                          Set as default {formData.type.toLowerCase()} address
                        </Label>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="firstName">First Name *</Label>
                      <Input
                        id="firstName"
                        value={formData.firstName}
                        onChange={(e) => handleInputChange('firstName', e.target.value)}
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="lastName">Last Name *</Label>
                      <Input
                        id="lastName"
                        value={formData.lastName}
                        onChange={(e) => handleInputChange('lastName', e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="company">Company</Label>
                    <Input
                      id="company"
                      value={formData.company}
                      onChange={(e) => handleInputChange('company', e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="address1">Address Line 1 *</Label>
                    <Input
                      id="address1"
                      value={formData.address1}
                      onChange={(e) => handleInputChange('address1', e.target.value)}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="address2">Address Line 2</Label>
                    <Input
                      id="address2"
                      value={formData.address2}
                      onChange={(e) => handleInputChange('address2', e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="country">Country *</Label>
                    <Select
                      value={selectedCountry}
                      onValueChange={(value) => {
                        setSelectedCountry(value);
                        handleInputChange('country', value);
                        handleInputChange('state', '');
                        handleInputChange('city', '');
                        setSelectedState('');
                        setSelectedCity('');
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select country" />
                      </SelectTrigger>
                      <SelectContent className="max-h-60">
                        {selectedCountry && !customCountries.includes(selectedCountry) && (
                          <SelectItem value={selectedCountry}>{selectedCountry}</SelectItem>
                        )}
                        {customCountries.map((country) => (
                          <SelectItem key={country} value={country}>
                            <div className="flex items-center gap-2">
                              <span>{country}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="state">State/Province *</Label>
                      <Select
                        value={selectedState}
                        onValueChange={(value) => {
                          if (value === '__add_new__') {
                            handleAddLocation('state');
                            return;
                          }
                          setSelectedState(value);
                          handleInputChange('state', value);
                          handleInputChange('city', '');
                          setSelectedCity('');
                        }}
                        disabled={!selectedCountry}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select state/province" />
                        </SelectTrigger>
                        <SelectContent className="max-h-60">
                          <SelectItem value="__add_new__" className="text-blue-600 font-medium">
                            + Add New State
                          </SelectItem>
                          {selectedState && !customStates.includes(selectedState) && (
                            <SelectItem value={selectedState}>{selectedState}</SelectItem>
                          )}
                          {customStates.map((state) => (
                            <SelectItem key={state} value={state}>
                              {state}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="city">City *</Label>
                      <Select
                        value={selectedCity}
                        onValueChange={(value) => {
                          if (value === '__add_new__') {
                            handleAddLocation('city');
                            return;
                          }
                          setSelectedCity(value);
                          handleInputChange('city', value);
                        }}
                        disabled={!selectedState}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select city" />
                        </SelectTrigger>
                        <SelectContent className="max-h-60">
                          <SelectItem value="__add_new__" className="text-blue-600 font-medium">
                            + Add New City
                          </SelectItem>
                          {selectedCity && !customCities.includes(selectedCity) && (
                            <SelectItem value={selectedCity}>{selectedCity}</SelectItem>
                          )}
                          {customCities.map((city) => (
                            <SelectItem key={city} value={city}>
                              {city}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="postalCode">Postal Code *</Label>
                    <Input
                      id="postalCode"
                      value={formData.postalCode}
                      onChange={(e) => handleInputChange('postalCode', e.target.value)}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone</Label>
                    <PhoneInputWithFlag
                      id="phone"
                      placeholder="Enter phone number"
                      value={formData.phone}
                      onChange={(value) => handleInputChange('phone', value)}
                    />
                  </div>

                  <DialogFooter>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setShowAddForm(false);
                        setEditingAddress(null);
                      }}
                      disabled={loading}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" disabled={loading}>
                      {loading ? 'Saving...' : (editingAddress ? 'Update Address' : 'Add Address')}
                    </Button>
                  </DialogFooter>
                </form>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={addLocationDialog.open} onOpenChange={(open) => !open && setAddLocationDialog(prev => ({ ...prev, open: false }))}>
        <DialogContent className="sm:max-w-[425px] force-light bg-background text-foreground">
          <DialogHeader>
            <DialogTitle>Add {addLocationDialog.type === 'state' ? 'State' : 'City'}</DialogTitle>
            <DialogDescription>
              Add a new {addLocationDialog.type} for {addLocationDialog.type === 'city' ? addLocationDialog.state : addLocationDialog.country}.
              This will be valid for your address.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="name" className="text-right">
                Name
              </Label>
              <Input
                id="name"
                value={newLocationName}
                onChange={(e) => setNewLocationName(e.target.value)}
                className="col-span-3"
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddLocationDialog(prev => ({ ...prev, open: false }))}>
              Cancel
            </Button>
            <Button onClick={handleSaveLocation} disabled={savingLocation}>
              {savingLocation ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
} 