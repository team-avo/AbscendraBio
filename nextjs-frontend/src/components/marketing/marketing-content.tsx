"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Progress } from "@/components/ui/progress";
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    LineChart,
    Line,
    PieChart,
    Pie,
    Cell
} from "recharts";
import {
    MessageSquare,
    Mail,
    Gift,
    Users,
    TrendingUp,
    Calendar,
    Target,
    Send,
    Eye,
    MousePointerClick,
    DollarSign,
    MoreHorizontal,
    Plus,
    Edit,
    Trash2,
    Play,
    Pause,
    Copy
} from "lucide-react";
import { api, formatCurrency } from "@/lib/api";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter
} from "@/components/ui/dialog";
import { useRouter } from "next/navigation";
import logger from '@/lib/logger';

// Types for marketing data
interface MarketingDashboard {
    activeCampaigns: number;
    activeCampaignsChange: number;
    totalReach: number;
    totalReachChange: number;
    clickThroughRate: number;
    clickThroughRateChange: number;
    marketingRevenue: number;
    marketingRevenueChange: number;
}

interface Campaign {
    id: string;
    name: string;
    type: string;
    status: string;
    audience: number;
    sent: number;
    opens: number;
    clicks: number;
    revenue: number;
    createdAt: string;
}

interface MarketingAnalytics {
    campaignData: Array<{
        month: string;
        emailOpen: number;
        smsOpen: number;
        revenue: number;
    }>;
    channelData: Array<{
        name: string;
        value: number;
        color: string;
    }>;
}

interface LoyaltyMember {
    id: string;
    name: string;
    email: string;
    tier: string;
    points: number;
    totalSpent: number;
    joinDate: string;
}

interface ProgramStats {
    totalMembers: number;
    activeThisMonth: number;
    pointsRedeemed: number;
    averageSpend: number;
}

const StatusBadge = ({ status }: { status: string }) => {
    const variants: { [key: string]: "default" | "secondary" | "destructive" | "outline" } = {
        Active: "default",
        Completed: "secondary",
        Draft: "outline",
        Paused: "destructive",
    };

    return <Badge variant={variants[status]}>{status}</Badge>;
};

const TierBadge = ({ tier }: { tier: string }) => {
    const variants: { [key: string]: "default" | "secondary" | "destructive" | "outline" } = {
        Platinum: "default",
        Gold: "secondary",
        Silver: "outline",
        Bronze: "destructive",
    };

    return <Badge variant={variants[tier]}>{tier}</Badge>;
};

export function MarketingContent() {
    const router = useRouter();
    const [selectedCampaign, setSelectedCampaign] = useState<number | null>(null);
    const [dashboardData, setDashboardData] = useState<MarketingDashboard | null>(null);
    const [campaigns, setCampaigns] = useState<Campaign[]>([]);
    const [analyticsData, setAnalyticsData] = useState<MarketingAnalytics | null>(null);
    const [loyaltyMembers, setLoyaltyMembers] = useState<LoyaltyMember[]>([]);
    const [programStats, setProgramStats] = useState<ProgramStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    // Dialog state
    const [openCalendar, setOpenCalendar] = useState(false);
    const [openCreateCampaign, setOpenCreateCampaign] = useState(false);
    const [openEmailCampaign, setOpenEmailCampaign] = useState(false);
    const [openSmsInfo, setOpenSmsInfo] = useState(false);

    // Create Campaign form state
    const [promoName, setPromoName] = useState("");
    const [promoCode, setPromoCode] = useState("");
    const [promoType, setPromoType] = useState<'PERCENTAGE'|'FIXED_AMOUNT'|'FREE_SHIPPING'|'BOGO'|'VOLUME_DISCOUNT'>("PERCENTAGE");
    const [promoValue, setPromoValue] = useState<string>("10");
    const [promoStartsAt, setPromoStartsAt] = useState<string>("");
    const [promoExpiresAt, setPromoExpiresAt] = useState<string>("");
    const [linkPromotionId, setLinkPromotionId] = useState<string>("");
    const [submittingCampaign, setSubmittingCampaign] = useState(false);

    // Email campaign form state
    const [emailSubject, setEmailSubject] = useState("");
    const [emailHtml, setEmailHtml] = useState("");
    const [testEmail, setTestEmail] = useState("");
    const [sendingEmail, setSendingEmail] = useState(false);

    const [exporting, setExporting] = useState(false);

    useEffect(() => {
        const fetchMarketingData = async () => {
            try {
                setLoading(true);
                const [dashboardRes, campaignsRes, analyticsRes, customersRes] = await Promise.all([
                    api.getMarketingDashboard(),
                    api.getCampaigns({ page: 1, limit: 50 }),
                    api.getMarketingAnalytics(),
                    api.getMarketingCustomers()
                ]);

                if (dashboardRes.success && dashboardRes.data) {
                    setDashboardData(dashboardRes.data);
                } else {
                    setDashboardData(null);
                }
                if (campaignsRes.success) {
                    setCampaigns(campaignsRes.data as any);
                }
                if (analyticsRes.success && analyticsRes.data) {
                    setAnalyticsData(analyticsRes.data);
                } else {
                    setAnalyticsData(null);
                }
                if (customersRes.success && customersRes.data) {
                    setLoyaltyMembers(customersRes.data.loyaltyMembers || []);
                    setProgramStats(customersRes.data.programStats || null);
                } else {
                    setLoyaltyMembers([]);
                    setProgramStats(null);
                }
            } catch (err) {
                setError('Failed to fetch marketing data');
                logger.error('Marketing data fetch error:', { error: err });
            } finally {
                setLoading(false);
            }
        };

        fetchMarketingData();
    }, []);

    if (loading) {
        return (
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">Marketing</h1>
                        <p className="text-muted-foreground">
                            Loading marketing data...
                        </p>
                    </div>
                </div>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    {[...Array(4)].map((_, i) => (
                        <Card key={i}>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <div className="h-4 w-24 bg-gray-200 rounded animate-pulse"></div>
                                <div className="h-4 w-4 bg-gray-200 rounded animate-pulse"></div>
                            </CardHeader>
                            <CardContent>
                                <div className="h-8 w-32 bg-gray-200 rounded animate-pulse mb-2"></div>
                                <div className="h-3 w-40 bg-gray-200 rounded animate-pulse"></div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </div>
        );
    }

    if (error || !dashboardData) {
        return (
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">Marketing</h1>
                        <p className="text-muted-foreground">
                            Error loading marketing data
                        </p>
                    </div>
                </div>
                <Card>
                    <CardContent className="pt-6">
                        <p className="text-red-600">{error || 'Failed to load marketing data'}</p>
                        <Button 
                            onClick={() => window.location.reload()} 
                            className="mt-4"
                        >
                            Retry
                        </Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="space-y-0">
            {/* ════════ DARK HERO STRIP ════════ */}
            <div className="relative bg-mist border border-line border-t-2 border-t-[#5A9ADA] rounded-2xl mx-1 sm:mx-0 overflow-hidden">
                <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'linear-gradient(rgba(77,125,242,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(77,125,242,0.6) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
                <div className="absolute top-0 right-0 w-[400px] h-[200px] bg-[#5A9ADA]/8 rounded-full blur-[100px] pointer-events-none" />

                <div className="relative z-10 px-6 py-6 sm:px-8 sm:py-7">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div>
                            <h1 className="text-xl font-black text-[#043061] tracking-tight">Marketing</h1>
                            <p className="text-xs text-gray-500 mt-0.5">Manage your marketing campaigns, promotions, and customer engagement</p>
                        </div>
                        <div className="flex items-center gap-2.5 flex-wrap">
                            <div className="flex items-center gap-2.5 bg-white border border-line rounded-xl px-4 py-2">
                                <MessageSquare className="h-4 w-4 text-[#5A9ADA]" />
                                <div>
                                    <p className="text-[9px] text-gray-500 font-medium uppercase tracking-widest leading-none">Campaigns</p>
                                    <p className="text-base font-black text-[#043061] tabular-nums leading-tight">{dashboardData.activeCampaigns}</p>
                                </div>
                            </div>
                            <button onClick={() => setOpenCalendar(true)} className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border border-line text-xs font-bold text-gray-300 hover:bg-white/10 transition-colors">
                                <Calendar className="h-3.5 w-3.5" />
                                Calendar
                            </button>
                            <button onClick={() => setOpenCreateCampaign(true)} className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#043061] text-white hover:bg-[#0b4f96] text-xs font-black uppercase tracking-widest transition-colors">
                                <Plus className="h-3.5 w-3.5" />
                                Create Campaign
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <div className="mt-4">
            {/* Tabs */}
            <Tabs defaultValue="campaigns" className="space-y-6">
                <TabsList>
                    <TabsTrigger value="campaigns">Campaigns</TabsTrigger>
                    <TabsTrigger value="analytics">Analytics</TabsTrigger>
                    <TabsTrigger value="loyalty">Loyalty Program</TabsTrigger>
                    <TabsTrigger value="automation">Automation</TabsTrigger>
                </TabsList>

                {/* Campaigns Tab */}
                <TabsContent value="campaigns" className="space-y-6">
                    <div className="grid gap-6 grid-cols-1 md:grid-cols-3">
                        {/* Campaign List */}
                        <Card className="col-span-1 md:col-span-2">
                            <CardHeader>
                                <CardTitle>Marketing Campaigns</CardTitle>
                                <CardDescription>
                                    Manage your email, SMS, and social media campaigns
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
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
                                                {campaigns.map((campaign) => (
                                                    <TableRow key={campaign.id}>
                                                        <TableCell>
                                                            <div>
                                                                <div className="font-medium">{campaign.name}</div>
                                                                <div className="text-sm text-muted-foreground">
                                                                    Created {campaign.createdAt}
                                                                </div>
                                                            </div>
                                                        </TableCell>
                                                        <TableCell>
                                                            <Badge variant="outline">{campaign.type}</Badge>
                                                        </TableCell>
                                                        <TableCell>
                                                            <StatusBadge status={campaign.status} />
                                                        </TableCell>
                                                        <TableCell>{campaign.audience.toLocaleString()}</TableCell>
                                                        <TableCell>
                                                            <div className="text-sm">
                                                                <div>Opens: {campaign.opens}</div>
                                                                <div>Clicks: {campaign.clicks}</div>
                                                            </div>
                                                        </TableCell>
                                                        <TableCell>{formatCurrency(campaign.revenue)}</TableCell>
                                                        <TableCell>
                                                            <DropdownMenu>
                                                                <DropdownMenuTrigger asChild>
                                                                    <Button variant="ghost" className="h-8 w-8 p-0">
                                                                        <MoreHorizontal className="h-4 w-4" />
                                                                    </Button>
                                                                </DropdownMenuTrigger>
                                                                <DropdownMenuContent align="end">
                                                                    <DropdownMenuItem>
                                                                        <Eye className="h-4 w-4 mr-2" />
                                                                        View Details
                                                                    </DropdownMenuItem>
                                                                    <DropdownMenuItem>
                                                                        <Edit className="h-4 w-4 mr-2" />
                                                                        Edit Campaign
                                                                    </DropdownMenuItem>
                                                                    <DropdownMenuItem>
                                                                        <Copy className="h-4 w-4 mr-2" />
                                                                        Duplicate
                                                                    </DropdownMenuItem>
                                                                    <DropdownMenuSeparator />
                                                                    <DropdownMenuItem>
                                                                        {campaign.status === "Active" ? (
                                                                            <>
                                                                                <Pause className="h-4 w-4 mr-2" />
                                                                                Pause Campaign
                                                                            </>
                                                                        ) : (
                                                                            <>
                                                                                <Play className="h-4 w-4 mr-2" />
                                                                                Activate Campaign
                                                                            </>
                                                                        )}
                                                                    </DropdownMenuItem>
                                                                    <DropdownMenuItem className="text-red-600">
                                                                        <Trash2 className="h-4 w-4 mr-2" />
                                                                        Delete Campaign
                                                                    </DropdownMenuItem>
                                                                </DropdownMenuContent>
                                                            </DropdownMenu>
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Quick Actions */}
                        <Card>
                            <CardHeader>
                                <CardTitle>Quick Actions</CardTitle>
                                <CardDescription>
                                    Common marketing tasks
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <Button className="w-full justify-start" onClick={() => setOpenEmailCampaign(true)}>
                                    <Mail className="h-4 w-4 mr-2" />
                                    Create Email Campaign
                                </Button>
                                <Button variant="outline" className="w-full justify-start" onClick={() => setOpenSmsInfo(true)}>
                                    <MessageSquare className="h-4 w-4 mr-2" />
                                    Send SMS Campaign
                                </Button>
                                <Button
                                    variant="outline"
                                    className="w-full justify-start"
                                    onClick={async () => {
                                        try {
                                            setExporting(true);
                                            // Export a simple audience CSV from active customers
                                            const res: any = await (api as any).getCustomers?.({ page: 1, limit: 1000 });
                                            const rows: string[] = ["Name,Email,Type,Created At"]; 
                                            const list = res?.data?.data || res?.data || [];
                                            list.forEach((c: any) => {
                                                const name = `${c.firstName || ""} ${c.lastName || ""}`.trim();
                                                rows.push(`${name},${c.email || ""},${c.customerType || ""},${c.createdAt || ""}`);
                                            });
                                            const csv = rows.join("\n");
                                            const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
                                            const url = URL.createObjectURL(blob);
                                            const a = document.createElement('a');
                                            a.href = url;
                                            a.download = 'audience.csv';
                                            a.click();
                                            URL.revokeObjectURL(url);
                                        } finally {
                                            setExporting(false);
                                        }
                                    }}
                                    disabled={exporting}
                                >
                                    <Gift className="h-4 w-4 mr-2" />
                                    Audience Segmentation
                                </Button>
                                <Button
                                    variant="outline"
                                    className="w-full justify-start"
                                    onClick={() => router.push('/coupons')}
                                >
                                    <Target className="h-4 w-4 mr-2" />
                                    Create Promotion
                                </Button>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                {/* Analytics Tab */}
                <TabsContent value="analytics" className="space-y-6">
                    <div className="grid gap-6 grid-cols-1 md:grid-cols-2">
                        {/* Campaign Performance */}
                        <Card>
                            <CardHeader>
                                <CardTitle>Campaign Performance</CardTitle>
                                <CardDescription>
                                    Email and SMS campaign metrics over time
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <ResponsiveContainer width="100%" height={300}>
                                    <LineChart data={analyticsData?.campaignData || []}>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis dataKey="month" />
                                        <YAxis />
                                        <Tooltip />
                                        <Line
                                            type="monotone"
                                            dataKey="emailOpen"
                                            stroke="#0088FE"
                                            strokeWidth={2}
                                            name="Email Open Rate"
                                        />
                                        <Line
                                            type="monotone"
                                            dataKey="smsOpen"
                                            stroke="#00C49F"
                                            strokeWidth={2}
                                            name="SMS Open Rate"
                                        />
                                    </LineChart>
                                </ResponsiveContainer>
                            </CardContent>
                        </Card>

                        {/* Channel Distribution */}
                        <Card>
                            <CardHeader>
                                <CardTitle>Channel Distribution</CardTitle>
                                <CardDescription>
                                    Marketing reach by channel
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <ResponsiveContainer width="100%" height={300}>
                                    <PieChart>
                                        <Pie
                                            data={analyticsData?.channelData || []}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={60}
                                            outerRadius={100}
                                            dataKey="value"
                                        >
                                            {(analyticsData?.channelData || []).map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={entry.color} />
                                            ))}
                                        </Pie>
                                        <Tooltip />
                                    </PieChart>
                                </ResponsiveContainer>
                                <div className="flex flex-col gap-2 mt-4">
                                    {(analyticsData?.channelData || []).map((item) => (
                                        <div key={item.name} className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <div
                                                    className="w-3 h-3 rounded-full"
                                                    style={{ backgroundColor: item.color }}
                                                />
                                                <span className="text-sm">{item.name}</span>
                                            </div>
                                            <span className="text-sm font-medium">{item.value}%</span>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                {/* Loyalty Program Tab */}
                <TabsContent value="loyalty" className="space-y-6">
                    <div className="grid gap-6 grid-cols-1 md:grid-cols-3">
                        {/* Program Stats */}
                        <Card>
                            <CardHeader>
                                <CardTitle>Program Overview</CardTitle>
                                <CardDescription>
                                    Loyalty program statistics
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <span className="text-sm font-medium">Total Members</span>
                                    <span className="text-2xl font-bold">{programStats?.totalMembers || 0}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-sm font-medium">Active This Month</span>
                                    <span className="text-lg font-semibold">{programStats?.activeThisMonth || 0}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-sm font-medium">Points Redeemed</span>
                                    <span className="text-lg font-semibold">{programStats?.pointsRedeemed?.toLocaleString() || 0}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-sm font-medium">Average Spend</span>
                                    <span className="text-lg font-semibold">{formatCurrency(programStats?.averageSpend || 0)}</span>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Top Members */}
                        <Card className="md:col-span-2">
                            <CardHeader>
                                <CardTitle>Top Loyalty Members</CardTitle>
                                <CardDescription>
                                    Highest value loyalty program members
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Member</TableHead>
                                            <TableHead>Tier</TableHead>
                                            <TableHead>Points</TableHead>
                                            <TableHead>Total Spent</TableHead>
                                            <TableHead>Join Date</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {loyaltyMembers.map((member) => (
                                            <TableRow key={member.id}>
                                                <TableCell>
                                                    <div>
                                                        <div className="font-medium">{member.name}</div>
                                                        <div className="text-sm text-muted-foreground">{member.email}</div>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <TierBadge tier={member.tier} />
                                                </TableCell>
                                                <TableCell>{member.points.toLocaleString()}</TableCell>
                                                <TableCell>{formatCurrency(member.totalSpent)}</TableCell>
                                                <TableCell>{member.joinDate}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                {/* Automation Tab */}
                <TabsContent value="automation" className="space-y-6">
                    <div className="grid gap-6 grid-cols-1 md:grid-cols-2">
                        {/* Automation Rules */}
                        <Card>
                            <CardHeader>
                                <CardTitle>Active Automations</CardTitle>
                                <CardDescription>
                                    Automated marketing workflows
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="flex items-center justify-between p-4 border rounded-lg">
                                    <div className="flex items-center gap-3">
                                        <div className="h-2 w-2 bg-green-500 rounded-full"></div>
                                        <div>
                                            <p className="font-medium">Welcome Series</p>
                                            <p className="text-sm text-muted-foreground">New customer onboarding</p>
                                        </div>
                                    </div>
                                    <Badge>Active</Badge>
                                </div>

                                <div className="flex items-center justify-between p-4 border rounded-lg">
                                    <div className="flex items-center gap-3">
                                        <div className="h-2 w-2 bg-green-500 rounded-full"></div>
                                        <div>
                                            <p className="font-medium">Abandoned Cart</p>
                                            <p className="text-sm text-muted-foreground">Cart recovery emails</p>
                                        </div>
                                    </div>
                                    <Badge>Active</Badge>
                                </div>

                                <div className="flex items-center justify-between p-4 border rounded-lg">
                                    <div className="flex items-center gap-3">
                                        <div className="h-2 w-2 bg-yellow-500 rounded-full"></div>
                                        <div>
                                            <p className="font-medium">Win-back Campaign</p>
                                            <p className="text-sm text-muted-foreground">Re-engage inactive customers</p>
                                        </div>
                                    </div>
                                    <Badge variant="outline">Paused</Badge>
                                </div>

                                <div className="flex items-center justify-between p-4 border rounded-lg">
                                    <div className="flex items-center gap-3">
                                        <div className="h-2 w-2 bg-green-500 rounded-full"></div>
                                        <div>
                                            <p className="font-medium">Birthday Rewards</p>
                                            <p className="text-sm text-muted-foreground">Birthday discount offers</p>
                                        </div>
                                    </div>
                                    <Badge>Active</Badge>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Create Automation */}
                        <Card>
                            <CardHeader>
                                <CardTitle>Create New Automation</CardTitle>
                                <CardDescription>
                                    Set up automated marketing workflows
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="automation-name">Automation Name</Label>
                                    <Input id="automation-name" placeholder="Enter automation name" />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="trigger">Trigger</Label>
                                    <select className="w-full p-2 border rounded-md">
                                        <option>Select trigger event</option>
                                        <option>Customer signup</option>
                                        <option>First purchase</option>
                                        <option>Abandoned cart</option>
                                        <option>Birthday</option>
                                        <option>Subscription renewal</option>
                                    </select>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="delay">Delay</Label>
                                    <div className="flex gap-2">
                                        <Input type="number" placeholder="1" className="w-20" />
                                        <select className="flex-1 p-2 border rounded-md">
                                            <option>Hours</option>
                                            <option>Days</option>
                                            <option>Weeks</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="message">Message Content</Label>
                                    <Textarea
                                        id="message"
                                        placeholder="Enter your message content..."
                                        rows={4}
                                    />
                                </div>

                                <div className="flex items-center space-x-2">
                                    <Switch id="active" />
                                    <Label htmlFor="active">Activate immediately</Label>
                                </div>

                                <Button className="w-full">
                                    Create Automation
                                </Button>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>
            </Tabs>
            </div>

            {/* Campaign Calendar Dialog */}
            <Dialog open={openCalendar} onOpenChange={setOpenCalendar}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Campaign Calendar</DialogTitle>
                        <DialogDescription>Overview of campaigns over the last 6 months.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="text-sm text-muted-foreground">This is a read-only preview. Use Create Campaign to add new ones.</div>
                        <div className="border rounded-md p-3">
                            <ResponsiveContainer width="100%" height={220}>
                                <BarChart data={analyticsData?.campaignData || []}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="month" />
                                    <YAxis />
                                    <Tooltip />
                                    <Bar dataKey="revenue" fill="#8884d8" name="Revenue" />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Create Campaign Dialog */}
            <Dialog open={openCreateCampaign} onOpenChange={setOpenCreateCampaign}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Create Campaign (Promotion)</DialogTitle>
                        <DialogDescription>Creates a promotion used by campaigns.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3">
                        <div className="space-y-2">
                            <Label htmlFor="promo-name">Name</Label>
                            <Input id="promo-name" value={promoName} onChange={(e) => setPromoName(e.target.value)} placeholder="Summer Sale" />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="promo-code">Code</Label>
                            <Input id="promo-code" value={promoCode} onChange={(e) => setPromoCode(e.target.value)} placeholder="SUMMER20" />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="promo-type">Type</Label>
                            <select id="promo-type" className="w-full p-2 border rounded-md" value={promoType} onChange={(e) => setPromoType(e.target.value as any)}>
                                <option value="PERCENTAGE">PERCENTAGE</option>
                                <option value="FIXED_AMOUNT">FIXED_AMOUNT</option>
                                <option value="FREE_SHIPPING">FREE_SHIPPING</option>
                                <option value="BOGO">BOGO</option>
                                <option value="VOLUME_DISCOUNT">VOLUME_DISCOUNT</option>
                            </select>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="promo-value">Value</Label>
                            <Input id="promo-value" value={promoValue} onChange={(e) => setPromoValue(e.target.value)} placeholder="10" />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div className="space-y-2">
                                <Label htmlFor="promo-start">Starts At (optional)</Label>
                                <Input id="promo-start" type="date" value={promoStartsAt} onChange={(e) => setPromoStartsAt(e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="promo-end">Expires At (optional)</Label>
                                <Input id="promo-end" type="date" value={promoExpiresAt} onChange={(e) => setPromoExpiresAt(e.target.value)} />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="campaign-link-promotion">Link Existing Promotion (optional)</Label>
                            <Input id="campaign-link-promotion" placeholder="Promotion ID (optional)" value={linkPromotionId} onChange={(e) => setLinkPromotionId(e.target.value)} />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button
                            onClick={async () => {
                                try {
                                    setSubmittingCampaign(true);
                                    let promotionIdToLink = linkPromotionId?.trim() || "";
                                    if (!promotionIdToLink && promoCode.trim()) {
                                        const payload: any = {
                                            code: promoCode.trim().toUpperCase(),
                                            name: promoName.trim(),
                                            type: promoType,
                                            value: parseFloat(promoValue || '0') || 0,
                                            isActive: true,
                                        };
                                        if (promoStartsAt) payload.startsAt = promoStartsAt;
                                        if (promoExpiresAt) payload.expiresAt = promoExpiresAt;
                                        const res = await (api as any).createPromotion(payload);
                                        if (res?.success && (res as any).data?.id) {
                                            promotionIdToLink = (res as any).data.id;
                                        }
                                    }

                                    const campaignRes = await api.createCampaign({
                                        name: promoName.trim() || 'Untitled Campaign',
                                        type: 'EMAIL',
                                        status: 'ACTIVE',
                                        promotionId: promotionIdToLink || undefined,
                                        scheduledAt: promoStartsAt || undefined,
                                    });

                                    if (campaignRes.success) {
                                        const list = await api.getCampaigns({ page: 1, limit: 50 });
                                        if (list.success) setCampaigns(list.data as any);
                                        setOpenCreateCampaign(false);
                                        setPromoName(""); setPromoCode(""); setPromoValue("10"); setLinkPromotionId("");
                                    }
                                } finally {
                                    setSubmittingCampaign(false);
                                }
                            }}
                            disabled={submittingCampaign || !promoName || !promoCode}
                        >
                            {submittingCampaign ? 'Creating...' : 'Create'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Create Email Campaign Dialog */}
            <Dialog open={openEmailCampaign} onOpenChange={setOpenEmailCampaign}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Create Email Campaign</DialogTitle>
                        <DialogDescription>Save a template and optionally send a test email.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3">
                        <div className="space-y-2">
                            <Label htmlFor="email-subject">Subject</Label>
                            <Input id="email-subject" value={emailSubject} onChange={(e) => setEmailSubject(e.target.value)} placeholder="Introducing our Summer Sale" />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="email-html">HTML Content</Label>
                            <Textarea id="email-html" rows={6} value={emailHtml} onChange={(e) => setEmailHtml(e.target.value)} placeholder="<h1>Big Sale</h1><p>Save 20%...</p>" />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="test-email">Send Test To</Label>
                            <Input id="test-email" type="email" value={testEmail} onChange={(e) => setTestEmail(e.target.value)} placeholder="you@example.com" />
                        </div>
                    </div>
                    <DialogFooter className="gap-2">
                        <Button
                            variant="outline"
                            onClick={async () => {
                                // Save or update a generic WELCOME_EMAIL template
                                await (api as any).createEmailTemplate?.({
                                    name: 'Marketing Campaign',
                                    type: 'WELCOME_EMAIL',
                                    subject: emailSubject || 'Campaign',
                                    contentType: 'HTML_CONTENT',
                                    htmlContent: emailHtml || '<p>Hello</p>',
                                    isActive: true
                                });
                            }}
                        >
                            Save Template
                        </Button>
                        <Button
                            onClick={async () => {
                                try {
                                    setSendingEmail(true);
                                    if (testEmail) {
                                        await (api as any).sendTestEmail(testEmail);
                                    }
                                    setOpenEmailCampaign(false);
                                    setEmailSubject(""); setEmailHtml(""); setTestEmail("");
                                } finally {
                                    setSendingEmail(false);
                                }
                            }}
                            disabled={sendingEmail || !testEmail}
                        >
                            {sendingEmail ? 'Sending...' : 'Send Test'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* SMS Info Dialog */}
            <Dialog open={openSmsInfo} onOpenChange={setOpenSmsInfo}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Send SMS Campaign</DialogTitle>
                        <DialogDescription>SMS provider is not configured.</DialogDescription>
                    </DialogHeader>
                    <div className="text-sm text-muted-foreground">
                        To enable SMS, integrate a provider (e.g., Twilio) and add credentials in Settings. You can still export the audience and use your SMS provider dashboard.
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
