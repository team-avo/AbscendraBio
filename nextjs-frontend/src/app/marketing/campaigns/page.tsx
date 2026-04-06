"use client";

import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MoreHorizontal, Eye, Edit, Copy, Pause, Play, Trash2 } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { api, formatCurrency } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { ResponsiveContainer, BarChart, CartesianGrid, XAxis, YAxis, Tooltip, Bar } from "recharts";
import { useMemo } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function CampaignsPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [analytics, setAnalytics] = useState<any | null>(null);
  const [openCalendar, setOpenCalendar] = useState(false);
  const [openCreate, setOpenCreate] = useState(false);
  const [openDetails, setOpenDetails] = useState<{open: boolean; id?: string}>({open:false});
  const [openEdit, setOpenEdit] = useState<{ open: boolean; campaign?: any }>({ open: false });
  const [name, setName] = useState("");
  const [type, setType] = useState<'EMAIL'|'SMS'|'AUTOMATION'>("EMAIL");
  const [promotionId, setPromotionId] = useState<string | undefined>(undefined);
  const [scheduledAt, setScheduledAt] = useState("");
  const [emailTemplateType, setEmailTemplateType] = useState<string>('MARKETING_GENERIC');
  const [audCustomerType, setAudCustomerType] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [promotions, setPromotions] = useState<Array<{ id: string; name: string; code: string }>>([]);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const [res, a] = await Promise.all([
          api.getCampaigns({ page: 1, limit: 50 }),
          api.getMarketingAnalytics(),
        ]);
        if (res.success) setRows(res.data);
        else setError(res.error || 'Failed to load campaigns');
        if (a.success) setAnalytics(a.data);
        const promos = await api.getPromotions({ isActive: true, limit: 100 });
        if (promos.success && Array.isArray(promos.data)) {
          setPromotions(promos.data.map((p: any)=> ({ id: p.id, name: p.name, code: p.code })));
        }
      } catch (e) {
        setError('Failed to load campaigns');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Marketing Campaigns</h1>
            <p className="text-muted-foreground">Manage your email, SMS, and social media campaigns</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <Button className="w-full sm:w-auto" variant="outline" onClick={() => setOpenCalendar(true)}>Campaign Calendar</Button>
            <Button className="w-full sm:w-auto" onClick={() => setOpenCreate(true)}>Create Campaign</Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Marketing Campaigns</CardTitle>
            <CardDescription>Manage your email, SMS, and social media campaigns</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-sm text-muted-foreground">Loading...</div>
            ) : error ? (
              <div className="text-sm text-red-600">{error}</div>
            ) : (
              <div className="overflow-x-auto -mx-2 sm:mx-0">
                <div className="min-w-[700px] sm:min-w-0 px-2 sm:px-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Campaign</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Audience</TableHead>
                        <TableHead>Performance</TableHead>
                        <TableHead>Revenue</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.map((c) => (
                        <TableRow key={c.id}>
                          <TableCell>
                            <div>
                              <div className="font-medium">{c.name}</div>
                              <div className="text-sm text-muted-foreground">Created {c.createdAt}</div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{c.type}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge>{c.status}</Badge>
                          </TableCell>
                          <TableCell>{(c.audience || c.audience === 0 ? c.audience : c.audienceCount)?.toLocaleString?.() || c.audience}</TableCell>
                          <TableCell>
                            <div className="text-sm">
                              <div>Opens: {c.opens ?? 0}</div>
                              <div>Clicks: {c.clicks ?? 0}</div>
                            </div>
                          </TableCell>
                          <TableCell>{formatCurrency(c.revenue || 0)}</TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" className="h-8 w-8 p-0">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={()=> setOpenDetails({open:true, id:c.id})}><Eye className="h-4 w-4 mr-2" />View Details</DropdownMenuItem>
                                <DropdownMenuItem onClick={()=> setOpenEdit({ open: true, campaign: c })}><Edit className="h-4 w-4 mr-2" />Edit Campaign</DropdownMenuItem>
                                <DropdownMenuItem><Copy className="h-4 w-4 mr-2" />Duplicate</DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={async ()=>{
                                  const nextStatus = c.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE';
                                  const res = await api.updateCampaign(c.id, { status: nextStatus });
                                  if (res.success) {
                                    const list = await api.getCampaigns({ page: 1, limit: 50 });
                                    if (list.success) setRows(list.data);
                                  }
                                }}>
                                  {c.status === 'ACTIVE' ? (<><Pause className="h-4 w-4 mr-2" />Pause Campaign</>) : (<><Play className="h-4 w-4 mr-2" />Activate Campaign</>)}
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={async ()=>{ try {
                                  if (c.type === 'EMAIL') {
                                    await (api as any).sendCampaignNow?.(c.id, { templateId: 'MARKETING_GENERIC' });
                                  } else {
                                    await (api as any).sendCampaignNow?.(c.id, {} as any);
                                  }
                                } catch(e){} }}>Send Now</DropdownMenuItem>
                                <DropdownMenuItem className="text-red-600" onClick={async ()=>{
                                  const res = await api.deleteCampaign(c.id);
                                  if (res.success) {
                                    const list = await api.getCampaigns({ page: 1, limit: 50 });
                                    if (list.success) setRows(list.data);
                                  }
                                }}><Trash2 className="h-4 w-4 mr-2" />Delete Campaign</DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      <Dialog open={openCalendar} onOpenChange={setOpenCalendar}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Campaign Calendar</DialogTitle>
            <DialogDescription>Overview of campaigns over the last 6 months.</DialogDescription>
          </DialogHeader>
          <div className="border rounded-md p-3">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={analytics?.campaignData || []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="revenue" fill="#8884d8" name="Revenue" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Campaign Dialog */}
      <Dialog open={openEdit.open} onOpenChange={(v)=> setOpenEdit({ open: v, campaign: openEdit.campaign })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Campaign</DialogTitle>
            <DialogDescription>Update campaign name, status, and template.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="e-name">Name</Label>
              <Input id="e-name" value={openEdit.campaign?.name || ''} onChange={(e)=> setOpenEdit((prev)=> ({ ...prev, campaign: { ...prev.campaign, name: e.target.value } }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="e-status">Status</Label>
              <Select value={openEdit.campaign?.status} onValueChange={(v)=> setOpenEdit((prev)=> ({ ...prev, campaign: { ...prev.campaign, status: v } }))}>
                <SelectTrigger id="e-status">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="DRAFT">DRAFT</SelectItem>
                  <SelectItem value="ACTIVE">ACTIVE</SelectItem>
                  <SelectItem value="PAUSED">PAUSED</SelectItem>
                  <SelectItem value="COMPLETED">COMPLETED</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="e-template">Email Template</Label>
              <Input id="e-template" value={openEdit.campaign?.emailTemplateType || ''} onChange={(e)=> setOpenEdit((prev)=> ({ ...prev, campaign: { ...prev.campaign, emailTemplateType: e.target.value } }))} placeholder="MARKETING_GENERIC" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={()=> setOpenEdit({ open: false })}>Cancel</Button>
            <Button onClick={async ()=>{
              if (!openEdit.campaign?.id) return;
              const res = await api.updateCampaign(openEdit.campaign.id, { name: openEdit.campaign.name, status: openEdit.campaign.status });
              if (res.success) {
                const list = await api.getCampaigns({ page: 1, limit: 50 });
                if (list.success) setRows(list.data);
                setOpenEdit({ open: false });
              }
            }}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={openCreate} onOpenChange={setOpenCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Campaign</DialogTitle>
            <DialogDescription>Create a campaign and optionally link a promotion.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="c-name">Name</Label>
              <Input id="c-name" value={name} onChange={(e)=>setName(e.target.value)} placeholder="Summer Peptide Sale" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="c-type">Type</Label>
              <select id="c-type" className="w-full p-2 border rounded-md" value={type} onChange={(e)=>setType(e.target.value as any)}>
                <option value="EMAIL">EMAIL</option>
                <option value="SMS">SMS</option>
                <option value="AUTOMATION">AUTOMATION</option>
              </select>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {type === 'EMAIL' && (
                <div className="space-y-2">
                  <Label htmlFor="c-template">Email Template</Label>
                  <Input id="c-template" value={emailTemplateType} onChange={(e)=>setEmailTemplateType(e.target.value)} placeholder="MARKETING_GENERIC" />
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="c-aud-type">Audience (Customer Type)</Label>
                <select id="c-aud-type" className="w-full p-2 border rounded-md" value={audCustomerType} onChange={(e)=>setAudCustomerType(e.target.value)}>
                  <option value="">All</option>
                  <option value="B2C">Tier 1</option>
                  <option value="B2B">Tier 2</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="c-scheduled">Scheduled At (optional)</Label>
                <Input id="c-scheduled" type="date" value={scheduledAt} onChange={(e)=>setScheduledAt(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="c-promo">Promotion (optional)</Label>
                <Select value={promotionId} onValueChange={(v) => setPromotionId(v === '__none__' ? undefined : v)}>
                  <SelectTrigger id="c-promo">
                    <SelectValue placeholder="Select a promotion" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">No promotion</SelectItem>
                    {promotions.map((p)=> (
                      <SelectItem key={p.id} value={p.id}>{p.name} ({p.code})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={async ()=>{
              try {
                setSubmitting(true);
                const res = await api.createCampaign({
                  name: name.trim() || 'Untitled Campaign',
                  type,
                  status: 'ACTIVE',
                  promotionId: promotionId,
                  scheduledAt: scheduledAt || undefined,
                  emailTemplateType,
                  audienceFilter: audCustomerType ? { customerType: audCustomerType } : undefined,
                });
                if (res.success) {
                  const list = await api.getCampaigns({ page: 1, limit: 50 });
                  if (list.success) setRows(list.data);
                  setOpenCreate(false);
                  setName(""); setPromotionId(undefined); setScheduledAt(""); setType('EMAIL'); setEmailTemplateType('MARKETING_GENERIC'); setAudCustomerType('');
                }
              } finally {
                setSubmitting(false);
              }
            }} disabled={submitting || !name}>{submitting ? 'Creating...' : 'Create'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Campaign Details Dialog */}
      <Dialog open={openDetails.open} onOpenChange={(v)=> setOpenDetails({open:v, id: openDetails.id})}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Campaign Details</DialogTitle>
            <DialogDescription>Performance and recipients preview</DialogDescription>
          </DialogHeader>
          <DetailsContent id={openDetails.id} />
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

function DetailsContent({ id }: { id?: string }) {
  const [metrics, setMetrics] = useState<any | null>(null);
  const [recipients, setRecipients] = useState<any[]>([]);
  useEffect(()=>{
    (async()=>{
      if (!id) return;
      const [m, r] = await Promise.all([
        (api as any).getCampaignMetrics?.(id),
        (api as any).request?.(`/campaigns/${id}/recipients`)
      ]);
      if (m?.success) setMetrics(m.data);
      if (r?.success) setRecipients(r.data);
    })();
  },[id]);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardHeader><CardTitle className="text-base">Audience</CardTitle></CardHeader><CardContent>{metrics?.audience ?? 0}</CardContent></Card>
        <Card><CardHeader><CardTitle className="text-base">Sent</CardTitle></CardHeader><CardContent>{metrics?.sent ?? 0}</CardContent></Card>
        <Card><CardHeader><CardTitle className="text-base">Opens</CardTitle></CardHeader><CardContent>{metrics?.opens ?? 0}</CardContent></Card>
        <Card><CardHeader><CardTitle className="text-base">Clicks</CardTitle></CardHeader><CardContent>{metrics?.clicks ?? 0}</CardContent></Card>
      </div>
      <div className="border rounded-md p-3">
        <div className="font-medium mb-2">Recipients Preview (first 50)</div>
        <div className="max-h-48 overflow-auto text-sm">
          {recipients.length === 0 ? (
            <div className="text-muted-foreground">No recipients</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Type</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recipients.map((r)=> (
                  <TableRow key={r.id}>
                    <TableCell>{r.firstName} {r.lastName}</TableCell>
                    <TableCell>{r.email}</TableCell>
                    <TableCell><Badge variant="outline">{r.customerType}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </div>
    </div>
  );
}


