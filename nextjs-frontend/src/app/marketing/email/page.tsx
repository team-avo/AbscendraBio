"use client";

import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ResponsiveContainer, BarChart, CartesianGrid, XAxis, YAxis, Tooltip, Bar } from "recharts";
import { api, formatCurrency } from "@/lib/api";

export default function EmailMarketingPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [analytics, setAnalytics] = useState<any | null>(null);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | undefined>(undefined);
  const [campaignMetrics, setCampaignMetrics] = useState<any | null>(null);
  const [range, setRange] = useState<'last_7_days'|'last_30_days'|'last_90_days'|'last_year'>('last_30_days');

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const [analyticsRes, campaignsRes] = await Promise.all([
          api.getMarketingAnalytics(),
          api.getCampaigns({ page: 1, limit: 50, type: 'EMAIL' })
        ]);
        if (analyticsRes.success) setAnalytics(analyticsRes.data);
        if (campaignsRes.success) setCampaigns(campaignsRes.data || []);
      } catch (e) {
        setError('Failed to load email marketing analytics');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(()=>{
    (async()=>{
      if (!selectedCampaignId) { setCampaignMetrics(null); return; }
      const m = await api.getCampaignMetrics(selectedCampaignId);
      if (m.success) setCampaignMetrics(m.data);
    })();
  },[selectedCampaignId]);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Email Marketing</h1>
            <p className="text-muted-foreground">Analyze performance of your email campaigns.</p>
          </div>
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Filters</CardTitle>
              <CardDescription>Scope analytics by campaign and period.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="text-sm font-medium">Campaign</div>
                <Select value={selectedCampaignId} onValueChange={(v)=> setSelectedCampaignId(v === '__all__' ? undefined : v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="All email campaigns" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">All campaigns</SelectItem>
                    {campaigns.map((c)=> (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <div className="text-sm font-medium">Range</div>
                <Select value={range} onValueChange={(v: any)=> setRange(v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select range" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="last_7_days">Last 7 days</SelectItem>
                    <SelectItem value="last_30_days">Last 30 days</SelectItem>
                    <SelectItem value="last_90_days">Last 90 days</SelectItem>
                    <SelectItem value="last_year">Last year</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Performance</CardTitle>
              <CardDescription>Key metrics</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-muted-foreground">Opens</div>
                  <div className="text-xl font-semibold">{campaignMetrics?.opens ?? 0}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Clicks</div>
                  <div className="text-xl font-semibold">{campaignMetrics?.clicks ?? 0}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Audience</div>
                  <div className="text-xl font-semibold">{campaignMetrics?.audience ?? 0}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Revenue</div>
                  <div className="text-xl font-semibold">{formatCurrency(campaignMetrics?.revenue ?? 0)}</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Channel Mix</CardTitle>
              <CardDescription>Email channel only shown here</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-sm text-muted-foreground">Email is the selected focus. SMS and others can be added later.</div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Revenue by Month</CardTitle>
            <CardDescription>Marketing-attributed revenue</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="border rounded-md p-3">
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={analytics?.campaignData || []}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="revenue" fill="#8884d8" name="Revenue" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Email Campaigns</CardTitle>
            <CardDescription>Recent campaigns</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Campaign</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Opens</TableHead>
                  <TableHead>Clicks</TableHead>
                  <TableHead>Revenue</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(campaigns || []).map((c)=> (
                  <TableRow key={c.id} className="cursor-pointer" onClick={()=> setSelectedCampaignId(c.id)}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{c.name}</div>
                        <div className="text-xs text-muted-foreground">{c.createdAt}</div>
                      </div>
                    </TableCell>
                    <TableCell><Badge>{c.status}</Badge></TableCell>
                    <TableCell>{c.opens ?? 0}</TableCell>
                    <TableCell>{c.clicks ?? 0}</TableCell>
                    <TableCell>{formatCurrency(c.revenue || 0)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}


