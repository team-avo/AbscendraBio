"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ProtectedRoute, useAuth } from "@/contexts/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Pencil, Trash2, Save, X, ArrowLeft, LogOut, Users } from "lucide-react";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { api, Customer, Order, formatCurrency, formatDate, getCustomCountries, getCustomStates, getCustomCities, createCustomLocation } from "@/lib/api";
import logger from "@/lib/logger";
import { GooglePlacesAutocomplete, type ParsedAddress } from '@/components/ui/google-places-autocomplete';
import { Country, State, City } from 'country-state-city';
import { PhoneInputWithFlag } from '@/components/customers/phone-input-with-flag';

export default function AccountHomePage() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [adding, setAdding] = useState<boolean>(false);
  const [editingProfile, setEditingProfile] = useState<boolean>(false);
  const [showEditProfile, setShowEditProfile] = useState<boolean>(false);
  const [profile, setProfile] = useState({
    firstName: "",
    lastName: "",
    email: "",
    mobile: "",
    companyName: "",
    licenseNumber: "",
  });
  const [lastOrder, setLastOrder] = useState<Order | null>(null);
  const [totalOrders, setTotalOrders] = useState<number>(0);
  const [salesRepNames, setSalesRepNames] = useState<Record<string, string>>({});
  const [address, setAddress] = useState({
    type: 'SHIPPING' as 'SHIPPING' | 'BILLING',
    address1: '',
    address2: '',
    city: '',
    state: '',
    postalCode: '',
    country: 'United States',
    phone: '',
    isDefault: false,
  });

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

  useEffect(() => {
    const load = async () => {
      try {
        if (user?.customerId) {
          const res = await api.getCustomer(user.customerId);
          if (res.success && res.data) {
            setCustomer(res.data);
            setProfile({
              firstName: res.data.firstName || user.firstName || "",
              lastName: res.data.lastName || user.lastName || "",
              email: user.email,
              mobile: (res.data as any).mobile || "",
              companyName: res.data.companyName || "",
              licenseNumber: res.data.licenseNumber || "",
            });

            // Set total orders count
            setTotalOrders(res.data._count?.orders || 0);

            // Fetch the last order (most recent)
            const ordersRes = await api.getCustomerOrders(user.customerId, { page: 1, limit: 1 });
            if (ordersRes.success && (ordersRes.data as any)?.orders?.length) {
              setLastOrder((ordersRes.data as any).orders[0]);
            } else {
              setLastOrder(null);
            }

            // Extract sales rep names from assignments
            if (res.data.salesAssignments && res.data.salesAssignments.length > 0) {
              const repNames: Record<string, string> = {};
              for (const assignment of res.data.salesAssignments) {
                // Check if salesRep data is included in the response
                if ((assignment as any).salesRep?.user) {
                  repNames[assignment.salesRepId] = `${(assignment as any).salesRep.user.firstName} ${(assignment as any).salesRep.user.lastName}`;
                } else {
                  // Fallback: fetch sales rep if not included
                  try {
                    const repRes = await api.getSalesRep(assignment.salesRepId);
                    if (repRes.success && repRes.data?.user) {
                      repNames[assignment.salesRepId] = `${repRes.data.user.firstName} ${repRes.data.user.lastName}`;
                    }
                  } catch (error) {
                    logger.error('Error fetching sales rep:', { error });
                  }
                }
              }
              setSalesRepNames(repNames);
            }
          }
        }
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user?.customerId]);

  const submitAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.customerId) return;
    setAdding(true);
    try {
      const res = await api.createAddress(user.customerId, {
        ...address,
        firstName: customer?.firstName || profile.firstName || '',
        lastName: customer?.lastName || profile.lastName || '',
      } as any);
      if (res.success) {
        toast.success("Address added");
        const refreshed = await api.getCustomer(user.customerId);
        if (refreshed.success && refreshed.data) setCustomer(refreshed.data);
        setAddress({
          type: 'SHIPPING', address1: '', address2: '', city: '', state: '', postalCode: '', country: 'US', phone: '', isDefault: false,
        });
      }
    } finally {
      setAdding(false);
    }
  };

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.customerId) return;
    try {
      // Update auth profile (email/first/last)
      await api.updateProfile({ firstName: profile.firstName, lastName: profile.lastName, email: profile.email });
      // Update customer (first/last/mobile)
      await api.updateCustomer(user.customerId, {
        firstName: profile.firstName,
        lastName: profile.lastName,
        mobile: profile.mobile,
        companyName: profile.companyName.trim() ? profile.companyName.trim() : undefined,
        licenseNumber: profile.licenseNumber.trim() ? profile.licenseNumber.trim() : undefined,
      });
      const refreshed = await api.getCustomer(user.customerId);
      if (refreshed.success && refreshed.data) setCustomer(refreshed.data);
      toast.success("Profile updated");
      setEditingProfile(false);
    } catch (err) {
      toast.error("Failed to update profile");
    }
  };

  // Address dialog state and submit handler
  const [showAddressDialog, setShowAddressDialog] = useState<boolean>(false);
  const [addressForm, setAddressForm] = useState({
    type: 'SHIPPING' as 'SHIPPING' | 'BILLING',
    firstName: '',
    lastName: '',
    company: '',
    address1: '', address2: '', city: '', state: '', postalCode: '', country: 'US', phone: '', isDefault: false,
  });
  const submitAddressDialog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.customerId) return;
    try {
      if (editingAddressId) {
        const res = await api.updateAddress(user.customerId, editingAddressId, { ...addressForm } as any);
        if (!res.success) throw new Error();
        toast.success('Address updated');
      } else {
        const res = await api.createAddress(user.customerId, {
          ...addressForm,
          firstName: addressForm.firstName || customer?.firstName || profile.firstName || '',
          lastName: addressForm.lastName || customer?.lastName || profile.lastName || '',
        } as any);
        if (!res.success) throw new Error();
        toast.success('Address added');
      }
      const refreshed = await api.getCustomer(user.customerId);
      if (refreshed.success && refreshed.data) setCustomer(refreshed.data);
      setShowAddressDialog(false);
      setEditingAddressId(null);
    } catch {
      toast.error('Failed to save address');
    }
  };

  const [editingAddressId, setEditingAddressId] = useState<string | null>(null);
  const [editingAddress, setEditingAddress] = useState<any>(null);
  // Country/State/City selections for address dialog
  const [addrCountry, setAddrCountry] = useState('United States');
  const [addrState, setAddrState] = useState('');
  const [addrCity, setAddrCity] = useState('');

  // Load custom countries on mount
  useEffect(() => {
    const loadCountries = async () => {
      try {
        const response = await getCustomCountries();
        if (response.success && response.data) {
          setCustomCountries(response.data);
        }
      } catch (error) {
        logger.error('Failed to load custom countries:', { error });
      }
    };
    loadCountries();
  }, []);

  // Load custom states when country changes
  useEffect(() => {
    const loadStates = async () => {
      if (!addrCountry) {
        setCustomStates([]);
        return;
      }
      try {
        const response = await getCustomStates(addrCountry);
        if (response.success && response.data) {
          setCustomStates(response.data);
        }
      } catch (error) {
        setCustomStates([]);
      }
    };
    loadStates();
  }, [addrCountry]);

  // Load custom cities when state changes
  useEffect(() => {
    const loadCities = async () => {
      if (!addrCountry || !addrState) {
        setCustomCities([]);
        return;
      }
      try {
        const response = await getCustomCities(addrCountry, addrState);
        if (response.success && response.data) {
          setCustomCities(response.data);
        }
      } catch (error) {
        setCustomCities([]);
      }
    };
    loadCities();
  }, [addrCountry, addrState]);

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
      country: addrCountry,
      state: type === 'city' ? addrState : undefined
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
        setAddrState(newValue);
        setAddressForm(prev => ({ ...prev, state: newValue, city: '' }));
        setCustomCities([]);
      } else if (addLocationDialog.type === 'city') {
        setAddrCity(newValue);
        setAddressForm(prev => ({ ...prev, city: newValue }));
      }
      toast.success(`${addLocationDialog.type === 'state' ? 'State' : 'City'} added to address`);
      setAddLocationDialog({ open: false, type: null, country: '', state: '' });
      setNewLocationName('');
    } finally {
      setSavingLocation(false);
    }
  };

  const startEditAddress = (a: any) => {
    setEditingAddressId(a.id);
    // Resolve address fields
    const cName = resolveCountryIso(a.country);
    const sName = resolveStateIso(cName, a.state);

    setAddressForm({
      ...a,
      address2: a.address2 || '',
      phone: a.phone || '',
      country: cName,
      state: sName,
      // For city, we just use it as is, or we could verify it against DB but we want to show it anyway
    });
    setAddrCountry(cName);
    setAddrState(sName);
    setAddrCity(a.city);
    setShowAddressDialog(true);
  };
  const cancelEditAddress = () => {
    setEditingAddressId(null);
    setEditingAddress(null);
  };
  const saveEditAddress = async () => {
    if (!user?.customerId || !editingAddressId) return;
    try {
      await api.updateAddress(user.customerId, editingAddressId, {
        type: editingAddress.type,
        firstName: editingAddress.firstName,
        lastName: editingAddress.lastName,
        address1: editingAddress.address1,
        address2: editingAddress.address2,
        city: editingAddress.city,
        state: editingAddress.state,
        postalCode: editingAddress.postalCode,
        country: editingAddress.country,
        phone: editingAddress.phone,
        isDefault: editingAddress.isDefault,
      });
      const refreshed = await api.getCustomer(user.customerId);
      if (refreshed.success && refreshed.data) setCustomer(refreshed.data);
      toast.success("Address updated");
      cancelEditAddress();
    } catch {
      toast.error("Failed to update address");
    }
  };
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const deleteAddress = async (id: string) => {
    if (!user?.customerId) return;
    try {
      await api.deleteAddress(user.customerId, id);
      const refreshed = await api.getCustomer(user.customerId);
      if (refreshed.success && refreshed.data) setCustomer(refreshed.data);
      toast.success("Address deleted");
    } catch {
      toast.error("Failed to delete address");
    } finally {
      setConfirmDeleteId(null);
    }
  };

  return (
    <ProtectedRoute requiredRoles={["CUSTOMER"]}>
      <div className="space-y-8">
        <div>
          <h1 className="text-4xl font-bold text-gray-900">My Account</h1>
          <p className="text-lg text-gray-600 mt-2">Manage your profile, addresses, and orders</p>
        </div>

        <div className="grid gap-8 lg:grid-cols-2">
          <Card className="relative">
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>Profile</CardTitle>
              {!editingProfile && (
                <Button
                  variant="secondary"
                  size="icon"
                  aria-label="Edit profile"
                  className="rounded-full absolute top-3 right-3"
                  onClick={() => setShowEditProfile(true)}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-sm text-muted-foreground">Loading profile...</div>
              ) : !editingProfile ? (
                <div className="space-y-3 text-sm">
                  <div className="flex items-center gap-2"><span className="text-muted-foreground w-24">Name</span> <div className="font-medium">{customer ? `${customer.firstName} ${customer.lastName}` : `${user?.firstName} ${user?.lastName}`}</div></div>
                  <div className="flex items-center gap-2"><span className="text-muted-foreground w-24">Email</span> <div>{user?.email}</div></div>
                  <div className="flex items-center gap-2"><span className="text-muted-foreground w-24">Mobile</span> <div>{customer?.mobile || '-'}</div></div>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground w-24">Company</span>
                    <div>{customer?.companyName || profile.companyName || '—'}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground w-24">License</span>
                    <div>{customer?.licenseNumber || profile.licenseNumber || '—'}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground w-24">City</span>
                    <div>{customer?.city || '—'}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground w-24">ZIP Code</span>
                    <div>{customer?.zip || '—'}</div>
                  </div>
                  {customer && (
                    <div className="flex items-center gap-2"><span className="text-muted-foreground w-24">Type</span> <Badge variant="secondary">{customer.customerType === 'B2C' || customer.customerType === 'B2B' ? 'Wholesale' : customer.customerType === 'ENTERPRISE_1' || customer.customerType === 'ENTERPRISE_2' ? 'Enterprise' : customer.customerType}</Badge></div>
                  )}
                  <div className="border-t pt-3 mt-3">
                    <div className="flex items-center gap-2"><span className="text-muted-foreground w-24">Total Orders</span> <div className="font-semibold text-blue-600">{totalOrders}</div></div>
                  </div>
                  {customer?.salesAssignments && customer.salesAssignments.length > 0 && (
                    <div className="border-t pt-3 mt-3">
                      <div className="flex items-start gap-2">
                        <span className="text-muted-foreground w-24 flex items-center gap-1"><Users className="h-4 w-4" />Sales Rep</span>
                        <div className="space-y-2">
                          {customer.salesAssignments.map((assignment) => {
                            const repData = (assignment as any).salesRep?.user;
                            return (
                              <div key={assignment.id} className="text-sm">
                                <div className="font-medium">{salesRepNames[assignment.salesRepId] || 'Loading...'}</div>
                                {repData?.email && (
                                  <div className="text-xs text-muted-foreground">{repData.email}</div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Orders</CardTitle>
                <div className="flex gap-2">
                  <Button asChild variant="outline" className="border-gray-300">
                    <Link href="/account/favorites">My Favorites</Link>
                  </Button>
                  <Button asChild className="whitespace-nowrap">
                    <Link href="/account/orders">View Orders</Link>
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-sm text-muted-foreground">View your recent orders and their status.</div>
              {lastOrder && (
                <div className="border rounded-md overflow-hidden">
                  <div className="px-3 py-2 text-xs font-medium text-muted-foreground bg-gray-50">Recent Order</div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-muted-foreground">
                          <th className="py-2 px-3">Order #</th>
                          <th className="py-2 px-3">Status</th>
                          <th className="py-2 px-3">Items</th>
                          <th className="py-2 px-3">Total</th>
                          <th className="py-2 px-3">Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-t">
                          <td className="py-2 px-3 font-medium">{lastOrder.orderNumber}</td>
                          <td className="py-2 px-3">
                            <span className="px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-800">{lastOrder.status}</span>
                          </td>
                          <td className="py-2 px-3">{lastOrder._count?.items ?? lastOrder.items?.length ?? 0}</td>
                          <td className="py-2 px-3">{formatCurrency(lastOrder.totalAmount)}</td>
                          <td className="py-2 px-3">{formatDate(lastOrder.createdAt)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Bulk Quote Requests</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-sm text-muted-foreground">Track your bulk quote requests and their status.</div>
              <div className="text-center py-4">
                <Link href="/account/bulk-quotes">
                  <Button variant="outline" className="w-full">
                    View Bulk Quote Requests
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>


        </div>

        <div className="mt-8">
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>Addresses</CardTitle>
              <Button size="sm" onClick={() => {
                setEditingAddressId(null);
                setAddressForm({
                  type: 'SHIPPING',
                  firstName: customer?.firstName || profile.firstName || '',
                  lastName: customer?.lastName || profile.lastName || '',
                  company: '',
                  address1: '',
                  address2: '',
                  city: '',
                  state: '',
                  postalCode: '',
                  country: 'United States',
                  phone: '',
                  isDefault: false
                });
                setAddrCountry('United States');
                setAddrState('');
                setAddrCity('');
                setShowAddressDialog(true);
              }}>Add Address</Button>
            </CardHeader>
            <CardContent>
              {customer && (
                <p className="text-xs text-muted-foreground mb-4">Contact name: {customer.firstName} {customer.lastName}</p>
              )}
              {customer?.addresses?.length ? (
                <div className="grid text-sm sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {(() => {
                    // Filter out duplicate addresses - keep only the first occurrence of each unique address
                    const seen = new Set<string>();
                    return customer.addresses.filter((a) => {
                      const key = `${a.firstName}|${a.lastName}|${a.address1}|${a.address2}|${a.city}|${a.state}|${a.postalCode}|${a.country}|${a.phone}|${a.type}`;
                      if (seen.has(key)) return false;
                      seen.add(key);
                      return true;
                    });
                  })().map((a) => (
                    <div key={a.id} className="p-4 border rounded-md">
                      {
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <div className="font-medium flex items-center gap-2">
                              {a.type} {a.isDefault ? <Badge variant="secondary">Default</Badge> : null}
                            </div>
                            <div>{a.firstName} {a.lastName}</div>
                            <div>{a.address1}{a.address2 ? `, ${a.address2}` : ''}</div>
                            <div>{a.city}, {a.state} {a.postalCode}, {a.country}</div>
                            {a.phone && <div>Phone: {a.phone}</div>}
                          </div>
                          <div className="flex gap-2 shrink-0 self-start">
                            <Button
                              size="icon"
                              variant="secondary"
                              aria-label="Edit address"
                              className="rounded-full"
                              onClick={() => startEditAddress(a)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="destructive"
                              aria-label="Delete address"
                              className="rounded-full"
                              onClick={() => setConfirmDeleteId(a.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      }
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">No addresses yet.</div>
              )}
            </CardContent>
          </Card>

          {/* Dialogs */}
          <Dialog open={showEditProfile} onOpenChange={setShowEditProfile}>
            <DialogContent className="force-light sm:max-w-lg bg-background text-foreground">
              <DialogHeader>
                <DialogTitle>Edit Profile</DialogTitle>
                <DialogDescription>Update your contact details.</DialogDescription>
              </DialogHeader>
              <form onSubmit={saveProfile} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>First name</Label>
                    <Input required value={profile.firstName} onChange={(e) => setProfile({ ...profile, firstName: e.target.value })} />
                  </div>
                  <div>
                    <Label>Last name</Label>
                    <Input required value={profile.lastName} onChange={(e) => setProfile({ ...profile, lastName: e.target.value })} />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>Company</Label>
                    <Input
                      value={profile.companyName}
                      onChange={(e) => setProfile({ ...profile, companyName: e.target.value })}
                      placeholder="RefinedMD"
                    />
                  </div>
                  <div>
                    <Label>NPI / License Number (Optional)</Label>
                    <Input
                      value={profile.licenseNumber}
                      onChange={(e) => setProfile({ ...profile, licenseNumber: e.target.value })}
                      placeholder="1234567890"
                    />
                  </div>
                </div>
                <div>
                  <Label>Email</Label>
                  <Input required type="email" value={profile.email} onChange={(e) => setProfile({ ...profile, email: e.target.value })} />
                </div>
                <div>
                  <Label>Mobile</Label>
                  <PhoneInputWithFlag
                    id="profile-mobile"
                    value={profile.mobile}
                    onChange={(val) => setProfile({ ...profile, mobile: val })}
                    placeholder="Enter phone number"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setShowEditProfile(false)}>Cancel</Button>
                  <Button type="submit"><Save className="h-4 w-4 mr-2" /> Save</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
          {/* Dialog duplicate removed; consolidated above dialog handles profile editing */}

          <Dialog open={showAddressDialog} onOpenChange={setShowAddressDialog}>
            <DialogContent className="force-light sm:max-w-lg bg-background text-foreground">
              <DialogHeader>
                <DialogTitle>{editingAddressId ? 'Edit Address' : 'Add Address'}</DialogTitle>
                <DialogDescription>Contact: {customer?.firstName} {customer?.lastName}</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <form onSubmit={submitAddressDialog} className="space-y-3 text-sm">
                  <div>
                    <Label>Address type</Label>
                    <Select value={addressForm.type} onValueChange={(v) => setAddressForm({ ...addressForm, type: v as any })}>
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent className="force-light">
                        <SelectItem value="SHIPPING">Shipping</SelectItem>
                        <SelectItem value="BILLING">Billing</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <Label>First name</Label>
                      <Input value={addressForm.firstName} onChange={(e) => setAddressForm({ ...addressForm, firstName: e.target.value })} />
                    </div>
                    <div>
                      <Label>Last name</Label>
                      <Input value={addressForm.lastName} onChange={(e) => setAddressForm({ ...addressForm, lastName: e.target.value })} />
                    </div>
                  </div>
                  <div>
                    <Label>Company</Label>
                    <Input value={addressForm.company} onChange={(e) => setAddressForm({ ...addressForm, company: e.target.value })} />
                  </div>
                  <div>
                    <Label>Address line 1</Label>
                    <GooglePlacesAutocomplete
                      value={addressForm.address1}
                      onChange={(val) => setAddressForm({ ...addressForm, address1: val })}
                      placeholder="Enter address"
                      onAddressSelect={(parsed) => {
                        setAddressForm(prev => ({
                          ...prev,
                          address1: parsed.address1 || prev.address1,
                          address2: parsed.address2 || prev.address2,
                          city: parsed.city || prev.city,
                          state: parsed.state || prev.state,
                          postalCode: parsed.postalCode || prev.postalCode,
                          country: parsed.country || prev.country,
                        }));
                        if (parsed.country) setAddrCountry(parsed.country);
                        if (parsed.state) setAddrState(parsed.state);
                        if (parsed.city) setAddrCity(parsed.city);
                      }}
                    />
                  </div>
                  <div>
                    <Label>Address line 2</Label>
                    <Input value={addressForm.address2} onChange={(e) => setAddressForm({ ...addressForm, address2: e.target.value })} />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="min-w-0">
                      <Label>Country</Label>
                      <Select
                        value={addrCountry}
                        onValueChange={(value) => {
                          setAddrCountry(value);
                          setAddressForm(prev => ({
                            ...prev,
                            country: value,
                            state: '',
                            city: ''
                          }));
                          setAddrState('');
                          setAddrCity('');
                        }}
                      >
                        <SelectTrigger className="mt-1 w-full h-10 truncate">
                          <SelectValue placeholder="Select country" />
                        </SelectTrigger>
                        <SelectContent className="force-light max-h-60">
                          {addrCountry && !customCountries.includes(addrCountry) && (
                            <SelectItem value={addrCountry}>{addrCountry}</SelectItem>
                          )}
                          {customCountries.map(c => (
                            <SelectItem key={c} value={c}>{c}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="min-w-0">
                      <Label>State</Label>
                      <Select
                        value={addrState}
                        onValueChange={(value) => {
                          if (value === '__add_new__') {
                            handleAddLocation('state');
                            return;
                          }
                          setAddrState(value);
                          setAddressForm(prev => ({ ...prev, state: value, city: '' }));
                          setAddrCity('');
                        }}
                        disabled={!addrCountry}
                      >
                        <SelectTrigger className="mt-1 w-full h-10 truncate">
                          <SelectValue placeholder="Select state" />
                        </SelectTrigger>
                        <SelectContent className="force-light max-h-60">
                          <SelectItem value="__add_new__" className="text-blue-600 font-medium">
                            + Add New State
                          </SelectItem>
                          {addrState && !customStates.includes(addrState) && (
                            <SelectItem value={addrState}>{addrState}</SelectItem>
                          )}
                          {customStates.map(s => (
                            <SelectItem key={s} value={s}>{s}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="min-w-0">
                      <Label>City</Label>
                      <Select
                        value={addrCity}
                        onValueChange={(value) => {
                          if (value === '__add_new__') {
                            handleAddLocation('city');
                            return;
                          }
                          setAddrCity(value);
                          setAddressForm(prev => ({ ...prev, city: value }));
                        }}
                        disabled={!addrState}
                      >
                        <SelectTrigger className="mt-1 w-full h-10 truncate">
                          <SelectValue placeholder="Select city" />
                        </SelectTrigger>
                        <SelectContent className="force-light max-h-60">
                          <SelectItem value="__add_new__" className="text-blue-600 font-medium">
                            + Add New City
                          </SelectItem>
                          {addrCity && !customCities.includes(addrCity) && (
                            <SelectItem value={addrCity}>{addrCity}</SelectItem>
                          )}
                          {customCities.map(c => (
                            <SelectItem key={c} value={c}>{c}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <Label>Postal code</Label>
                      <Input value={addressForm.postalCode} onChange={(e) => setAddressForm({ ...addressForm, postalCode: e.target.value })} />
                    </div>
                    <div>
                      <Label>Phone</Label>
                      <PhoneInputWithFlag id="address-phone" value={addressForm.phone} onChange={(v) => setAddressForm({ ...addressForm, phone: v })} placeholder="Enter phone number" />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={() => setShowAddressDialog(false)}>Cancel</Button>
                    <Button type="submit">{editingAddressId ? 'Save Changes' : 'Add Address'}</Button>
                  </div>
                </form>
              </div>
            </DialogContent>
          </Dialog>
          <Dialog open={!!confirmDeleteId} onOpenChange={(o) => !o && setConfirmDeleteId(null)}>
            <DialogContent className="force-light sm:max-w-md bg-background text-foreground">
              <DialogHeader>
                <DialogTitle>Delete address?</DialogTitle>
                <DialogDescription>This action cannot be undone.</DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" onClick={() => setConfirmDeleteId(null)}>Cancel</Button>
                <Button variant="destructive" onClick={() => confirmDeleteId && deleteAddress(confirmDeleteId)}>Delete</Button>
              </DialogFooter>
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
        </div>
      </div>
    </ProtectedRoute>
  );
}


