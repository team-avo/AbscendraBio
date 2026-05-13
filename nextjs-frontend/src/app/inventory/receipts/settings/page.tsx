"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { ProtectedRoute } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    ArrowLeft,
    Mail,
    Plus,
    Trash2,
    BookOpen,
} from "lucide-react";
import { api } from "@/lib/api";
import type {
    SupplierEmailSource,
    SupplierProductMapping,
} from "@/lib/api-stock-receipts";
import logger from "@/lib/logger";
import { toast } from "sonner";

type TabKey = "suppliers" | "mappings";

export default function StockReceiptsSettingsPage() {
    const [tab, setTab] = useState<TabKey>("suppliers");
    const [suppliers, setSuppliers] = useState<SupplierEmailSource[]>([]);
    const [parserKeys, setParserKeys] = useState<string[]>([]);
    const [locations, setLocations] = useState<{ id: string; name: string }[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCreate, setShowCreate] = useState(false);

    const reload = useCallback(async () => {
        setLoading(true);
        try {
            const [sourcesResp, parsersResp, locsResp] = await Promise.all([
                api.listSupplierSources(),
                api.listSupplierParserKeys(),
                api.getLocations(),
            ]);
            if (sourcesResp.success && sourcesResp.data) setSuppliers(sourcesResp.data);
            if (parsersResp.success && parsersResp.data) setParserKeys(parsersResp.data);
            if (locsResp.success && locsResp.data) {
                setLocations(locsResp.data.map((l: any) => ({ id: l.id, name: l.name })));
            }
        } catch (err) {
            logger.error("Settings load error:", { err });
            toast.error("Failed to load settings");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        reload();
    }, [reload]);

    async function handleToggleActive(supplier: SupplierEmailSource) {
        const resp = await api.updateSupplierSource(supplier.id, { active: !supplier.active });
        if (resp.success) {
            toast.success(`${supplier.name} ${!supplier.active ? "enabled" : "disabled"}`);
            reload();
        } else {
            toast.error(resp.error || "Failed to update supplier");
        }
    }

    async function handleDeleteSupplier(supplier: SupplierEmailSource) {
        if (!confirm(`Delete supplier "${supplier.name}"? This also removes its product mappings.`)) {
            return;
        }
        const resp = await api.deleteSupplierSource(supplier.id);
        if (resp.success) {
            toast.success("Supplier deleted");
            reload();
        } else {
            toast.error(resp.error || "Failed to delete");
        }
    }

    return (
        <ProtectedRoute requiredRoles={["ADMIN", "MANAGER", "STAFF"]}>
            <DashboardLayout>
                <div className="space-y-6">
                    <div className="flex items-center gap-3">
                        <Link href="/inventory/receipts">
                            <Button variant="ghost" size="sm">
                                <ArrowLeft className="h-4 w-4 mr-1" />
                                Back
                            </Button>
                        </Link>
                        <div>
                            <h1 className="text-2xl font-bold">Stock Receipt Settings</h1>
                            <p className="text-sm text-muted-foreground">
                                Suppliers the cron polls Gmail for, and learned product mappings.
                            </p>
                        </div>
                    </div>

                    <div className="flex gap-2 border-b">
                        {([
                            { key: "suppliers", label: "Suppliers", icon: Mail },
                            { key: "mappings", label: "Product mappings", icon: BookOpen },
                        ] as const).map((t) => {
                            const active = tab === t.key;
                            const Icon = t.icon;
                            return (
                                <button
                                    key={t.key}
                                    onClick={() => setTab(t.key)}
                                    className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px inline-flex items-center gap-2 ${
                                        active
                                            ? "border-primary text-foreground"
                                            : "border-transparent text-muted-foreground hover:text-foreground"
                                    }`}
                                >
                                    <Icon className="h-4 w-4" />
                                    {t.label}
                                </button>
                            );
                        })}
                    </div>

                    {tab === "suppliers" ? (
                        <div className="space-y-3">
                            <div className="flex justify-end">
                                <Button size="sm" onClick={() => setShowCreate(true)}>
                                    <Plus className="h-4 w-4 mr-1" />
                                    Add supplier
                                </Button>
                            </div>
                            <div className="rounded-lg border bg-card">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Name</TableHead>
                                            <TableHead>Sender</TableHead>
                                            <TableHead>Parser</TableHead>
                                            <TableHead>Default location</TableHead>
                                            <TableHead className="text-center">Receipts</TableHead>
                                            <TableHead className="text-center">Active</TableHead>
                                            <TableHead className="text-right">Action</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {loading ? (
                                            <TableRow>
                                                <TableCell colSpan={7} className="text-center py-8 text-sm text-muted-foreground">
                                                    Loading…
                                                </TableCell>
                                            </TableRow>
                                        ) : suppliers.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={7} className="text-center py-8 text-sm text-muted-foreground">
                                                    No suppliers configured. Add one to start polling Gmail.
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            suppliers.map((s) => (
                                                <TableRow key={s.id}>
                                                    <TableCell className="font-medium">{s.name}</TableCell>
                                                    <TableCell className="font-mono text-xs">{s.senderEmail}</TableCell>
                                                    <TableCell>
                                                        <Badge variant="outline">{s.parserKey}</Badge>
                                                    </TableCell>
                                                    <TableCell>{s.location?.name || "—"}</TableCell>
                                                    <TableCell className="text-center text-sm">
                                                        {s._count?.receipts ?? 0}
                                                    </TableCell>
                                                    <TableCell className="text-center">
                                                        <Switch
                                                            checked={s.active}
                                                            onCheckedChange={() => handleToggleActive(s)}
                                                        />
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => handleDeleteSupplier(s)}
                                                        >
                                                            <Trash2 className="h-3.5 w-3.5 text-red-600" />
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>
                    ) : (
                        <MappingsPanel suppliers={suppliers} loading={loading} onChange={reload} />
                    )}
                </div>

                <CreateSupplierDialog
                    open={showCreate}
                    onOpenChange={setShowCreate}
                    parserKeys={parserKeys}
                    locations={locations}
                    onCreated={() => {
                        setShowCreate(false);
                        reload();
                    }}
                />
            </DashboardLayout>
        </ProtectedRoute>
    );
}

function CreateSupplierDialog({
    open,
    onOpenChange,
    parserKeys,
    locations,
    onCreated,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    parserKeys: string[];
    locations: { id: string; name: string }[];
    onCreated: () => void;
}) {
    const [name, setName] = useState("");
    const [senderEmail, setSenderEmail] = useState("");
    const [parserKey, setParserKey] = useState("");
    const [defaultLocationId, setDefaultLocationId] = useState("");
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (open) {
            setName("");
            setSenderEmail("");
            setParserKey(parserKeys[0] || "");
            setDefaultLocationId(locations[0]?.id || "");
        }
    }, [open, parserKeys, locations]);

    async function handleSave() {
        if (!name.trim() || !senderEmail.trim() || !parserKey || !defaultLocationId) {
            toast.error("All fields are required.");
            return;
        }
        setSaving(true);
        try {
            const resp = await api.createSupplierSource({
                name: name.trim(),
                senderEmail: senderEmail.trim(),
                parserKey,
                defaultLocationId,
                active: true,
            });
            if (resp.success) {
                toast.success("Supplier added");
                onCreated();
            } else {
                toast.error(resp.error || "Failed to create supplier");
            }
        } catch (err) {
            logger.error("Create supplier error:", { err });
            toast.error("Network error");
        } finally {
            setSaving(false);
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Add a supplier email source</DialogTitle>
                    <DialogDescription>
                        The cron polls Gmail for unread mail from this sender every 15 minutes.
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-3">
                    <div>
                        <Label>Display name</Label>
                        <Input
                            placeholder="ION Peptide"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                        />
                    </div>
                    <div>
                        <Label>Sender email</Label>
                        <Input
                            placeholder="orders@ionpeptide.com"
                            type="email"
                            value={senderEmail}
                            onChange={(e) => setSenderEmail(e.target.value)}
                        />
                    </div>
                    <div>
                        <Label>Parser</Label>
                        <Select value={parserKey} onValueChange={setParserKey}>
                            <SelectTrigger>
                                <SelectValue placeholder="Pick a parser" />
                            </SelectTrigger>
                            <SelectContent>
                                {parserKeys.map((k) => (
                                    <SelectItem key={k} value={k}>
                                        {k}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div>
                        <Label>Default warehouse for inbound stock</Label>
                        <Select value={defaultLocationId} onValueChange={setDefaultLocationId}>
                            <SelectTrigger>
                                <SelectValue placeholder="Pick a location" />
                            </SelectTrigger>
                            <SelectContent>
                                {locations.map((l) => (
                                    <SelectItem key={l.id} value={l.id}>
                                        {l.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Cancel
                    </Button>
                    <Button onClick={handleSave} disabled={saving}>
                        Create
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function MappingsPanel({
    suppliers,
    loading,
    onChange,
}: {
    suppliers: SupplierEmailSource[];
    loading: boolean;
    onChange: () => void;
}) {
    const [supplierId, setSupplierId] = useState<string>("");
    const [mappings, setMappings] = useState<SupplierProductMapping[]>([]);
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        if (!supplierId && suppliers.length > 0) {
            setSupplierId(suppliers[0].id);
        }
    }, [suppliers, supplierId]);

    const fetchMappings = useCallback(async () => {
        if (!supplierId) return;
        setBusy(true);
        try {
            const resp = await api.listSupplierMappings(supplierId);
            if (resp.success && resp.data) setMappings(resp.data);
        } catch (err) {
            logger.error("Mappings load error:", { err });
        } finally {
            setBusy(false);
        }
    }, [supplierId]);

    useEffect(() => {
        fetchMappings();
    }, [fetchMappings]);

    async function handleDelete(m: SupplierProductMapping) {
        if (!confirm(`Forget mapping "${m.supplierProductName}"?`)) return;
        const resp = await api.deleteSupplierMapping(m.id);
        if (resp.success) {
            toast.success("Mapping removed");
            fetchMappings();
            onChange();
        } else {
            toast.error(resp.error || "Failed to delete");
        }
    }

    if (loading) {
        return <p className="text-sm text-muted-foreground">Loading…</p>;
    }
    if (suppliers.length === 0) {
        return (
            <p className="text-sm text-muted-foreground">
                Add a supplier first — mappings are scoped per supplier.
            </p>
        );
    }

    return (
        <div className="space-y-3">
            <div className="max-w-xs">
                <Label>Supplier</Label>
                <Select value={supplierId} onValueChange={setSupplierId}>
                    <SelectTrigger>
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {suppliers.map((s) => (
                            <SelectItem key={s.id} value={s.id}>
                                {s.name}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
            <div className="rounded-lg border bg-card">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Supplier product name</TableHead>
                            <TableHead>Maps to variant</TableHead>
                            <TableHead className="text-right">Qty multiplier</TableHead>
                            <TableHead className="text-right">Action</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {busy ? (
                            <TableRow>
                                <TableCell colSpan={4} className="text-center py-8 text-sm text-muted-foreground">
                                    Loading…
                                </TableCell>
                            </TableRow>
                        ) : mappings.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={4} className="text-center py-8 text-sm text-muted-foreground">
                                    No mappings learned yet. They appear automatically when you map an unmatched line.
                                </TableCell>
                            </TableRow>
                        ) : (
                            mappings.map((m) => (
                                <TableRow key={m.id}>
                                    <TableCell className="font-medium">{m.supplierProductName}</TableCell>
                                    <TableCell>
                                        {m.variant ? (
                                            <>
                                                <div>{m.variant.product.name}</div>
                                                <div className="text-xs text-muted-foreground">
                                                    {m.variant.name} · {m.variant.sku}
                                                </div>
                                            </>
                                        ) : (
                                            <span className="text-muted-foreground">—</span>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-right font-mono">
                                        ×{m.quantityMultiplier}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Button variant="ghost" size="sm" onClick={() => handleDelete(m)}>
                                            <Trash2 className="h-3.5 w-3.5 text-red-600" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}
