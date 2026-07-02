"use client";

import { useEffect, useMemo, useState } from "react";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { ProtectedRoute } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Edit3, Trash2, MoreHorizontal, ArrowUp, ArrowDown, Link as LinkIcon } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { api } from "@/lib/api";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export default function NavigationManagerPage() {
  const [menus, setMenus] = useState<Array<{ id: string; name: string; location: string; isActive: boolean; items?: any[] }>>([]);
  const [mainMenu, setMainMenu] = useState<any | null>(null);
  const [footerMenu, setFooterMenu] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [menuName, setMenuName] = useState("");
  const [menuLocation, setMenuLocation] = useState("");
  const [menuActive, setMenuActive] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  // Item edit dialog
  const [itemOpen, setItemOpen] = useState(false);
  const [itemMenuId, setItemMenuId] = useState<string | null>(null);
  const [itemId, setItemId] = useState<string | null>(null);
  const [itemTitle, setItemTitle] = useState("");
  const [itemMode, setItemMode] = useState<'url' | 'page'>('url');
  const [itemUrl, setItemUrl] = useState("");
  const [itemPageId, setItemPageId] = useState<string | undefined>(undefined);
  const [itemTarget, setItemTarget] = useState<string>("_self");
  const [itemActive, setItemActive] = useState<boolean>(true);
  const [pagesOptions, setPagesOptions] = useState<Array<{ id: string; title: string; slug: string }>>([]);
  // Footer settings/state
  const [footerSettings, setFooterSettings] = useState<any | null>(null);
  const [footerSettingsOpen, setFooterSettingsOpen] = useState(false);
  const [fsTitle, setFsTitle] = useState("");
  const [fsDescription, setFsDescription] = useState("");
  const [fsFacebook, setFsFacebook] = useState("");
  const [fsTwitter, setFsTwitter] = useState("");
  const [fsInstagram, setFsInstagram] = useState("");
  const [fsContactTitle, setFsContactTitle] = useState("Contact");
  const [fsContactEmail, setFsContactEmail] = useState("");
  const [fsContactPhone, setFsContactPhone] = useState("");
  const [fsContactAddress, setFsContactAddress] = useState("");
  const [footerLinkOpen, setFooterLinkOpen] = useState(false);
  const [flSectionTitle, setFlSectionTitle] = useState("");
  type NewFooterLink = { title: string; href: string; target: string; mode: 'url' | 'page'; pageId?: string };
  const [flItems, setFlItems] = useState<NewFooterLink[]>([]);

  const loadMenus = async () => {
    setLoading(true);
    const resp = await api.getNavigationMenus();
    setLoading(false);
    if (resp.success && resp.data) {
      const baseList = resp.data.menus || [];
      const enriched: any[] = [];
      for (const m of baseList) {
        const itemsResp = await api.getNavigationItems(m.id);
        const items = (itemsResp.success && itemsResp.data && itemsResp.data.items) ? itemsResp.data.items : [];
        enriched.push({ ...m, items });
      }
      setMenus(enriched);
      const main = enriched.find((m: any) => m.location === 'main') || null;
      const footer = enriched.find((m: any) => m.location === 'footer') || null;
      setMainMenu(main);
      setFooterMenu(footer);
    } else {
      // Fallback to public menus for display
      try {
        const [pmain, pfooter] = await Promise.all([
          api.getPublicNavigationMenus({ location: 'main' }),
          api.getPublicNavigationMenus({ location: 'footer' }),
        ]);
        const enriched: any[] = [];
        if (pmain.success && pmain.data?.menus?.[0]) {
          const m = pmain.data.menus[0];
          const items = await api.getPublicNavigationItems(m.id);
          enriched.push({ ...m, items: (items.success && items.data?.items) ? items.data.items : [] });
        }
        if (pfooter.success && pfooter.data?.menus?.[0]) {
          const m = pfooter.data.menus[0];
          const items = await api.getPublicNavigationItems(m.id);
          enriched.push({ ...m, items: (items.success && items.data?.items) ? items.data.items : [] });
        }
        setMenus(enriched);
        setMainMenu(enriched.find((m: any) => m.location === 'main') || null);
        setFooterMenu(enriched.find((m: any) => m.location === 'footer') || null);
      } catch { }
    }
    // Load footer settings (fallback to public if unauthorized)
    try {
      const fs = await api.getFooterSettings();
      if (fs.success) setFooterSettings(fs.data || null);
      else {
        const pub = await api.getPublicFooter();
        if (pub.success) setFooterSettings(pub.data || null);
      }
    } catch {
      const pub = await api.getPublicFooter();
      if (pub.success) setFooterSettings(pub.data || null);
    }
  };

  useEffect(() => { loadMenus(); }, []);

  // Ensure default menus and starter links when no data present
  useEffect(() => {
    const ensureDefaults = async () => {
      // Create default menus if missing
      let main = mainMenu;
      let footer = footerMenu;
      if (!main) {
        const r = await api.createNavigationMenu({ name: 'Main Navigation', location: 'main', isActive: true });
        if (r.success && r.data) main = r.data;
      }
      if (!footer) {
        const r = await api.createNavigationMenu({ name: 'Footer Navigation', location: 'footer', isActive: true });
        if (r.success && r.data) footer = r.data;
      }
      // Seed default items if empty
      if (main) {
        const itemsResp = await api.getNavigationItems(main.id);
        const curr = (itemsResp.success && itemsResp.data && itemsResp.data.items) ? itemsResp.data.items : [];
        if ((curr || []).length === 0) {
          await api.createNavigationItem(main.id, { title: 'Home', url: '/', order: 0, isActive: true });
          await api.createNavigationItem(main.id, { title: 'Products', url: '/products', order: 1, isActive: true });
          await api.createNavigationItem(main.id, { title: 'About', url: '/about', order: 2, isActive: true });
          await api.createNavigationItem(main.id, { title: 'Contact', url: '/contact', order: 3, isActive: true });
        }
      }
      if (footer) {
        const itemsResp = await api.getNavigationItems(footer.id);
        const curr = (itemsResp.success && itemsResp.data && itemsResp.data.items) ? itemsResp.data.items : [];
        if ((curr || []).length === 0) {
          await api.createNavigationItem(footer.id, { title: 'Privacy Policy', url: '/privacy', order: 0, isActive: true });
          await api.createNavigationItem(footer.id, { title: 'Terms of Service', url: '/terms', order: 1, isActive: true });
          await api.createNavigationItem(footer.id, { title: 'FAQ', url: '/faq', order: 2, isActive: true });
        }
      }
      await loadMenus();
    };
    // Run after initial load; bootstrap when there are no menus
    if (!loading && (menus.length === 0 || !mainMenu || !footerMenu)) {
      ensureDefaults();
    }
  }, [loading, menus.length, mainMenu, footerMenu]);

  // Removed seeding to avoid 401 when not authenticated

  const openNew = () => {
    setMenuName("");
    setMenuLocation("");
    setMenuActive(true);
    setNewOpen(true);
  };

  const createMenu = async () => {
    if (!menuName.trim() || !menuLocation.trim()) return toast.error("Name and location are required");
    const resp = await api.createNavigationMenu({ name: menuName.trim(), location: menuLocation.trim(), isActive: menuActive });
    if (!resp.success) return toast.error(resp.error || "Failed to create menu");
    toast.success("Menu created");
    setNewOpen(false);
    await loadMenus();
  };

  const openEdit = (m: any) => {
    setEditingId(m.id);
    setMenuName(m.name);
    setMenuLocation(m.location);
    setMenuActive(m.isActive);
    setEditOpen(true);
  };

  const updateMenu = async () => {
    if (!editingId) return;
    const resp = await api.updateNavigationMenu(editingId, { name: menuName || undefined, location: menuLocation || undefined, isActive: menuActive });
    if (!resp.success) return toast.error(resp.error || "Failed to update menu");
    toast.success("Menu updated");
    setEditOpen(false);
    setEditingId(null);
    await loadMenus();
  };

  const requestDelete = (id: string) => {
    setDeleteId(id);
    setDeleteOpen(true);
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    const resp = await api.deleteNavigationMenu(deleteId);
    if (!resp.success) return toast.error(resp.error || "Failed to delete menu");
    toast.success("Menu deleted");
    setDeleteOpen(false);
    setDeleteId(null);
    await loadMenus();
  };

  const openItemEditor = async (menuId: string, it?: any) => {
    // Route footer item edits to the Footer Link dialog for a consistent UI
    if (footerMenu?.id && menuId === footerMenu.id) {
      // Prefill Section Title by trying to match existing footerSettings section containing this link
      let preSection = '';
      try {
        const allSecs = (footerSettings?.sections || []) as any[];
        const match = allSecs.find((s: any) => (s.links || []).some((l: any) => l.title === it?.title || l.href === it?.url));
        preSection = match?.title || '';
      } catch { }
      setFlSectionTitle(preSection);
      setFlItems([{ title: it?.title || '', href: it?.url || '', target: it?.target || '_self', mode: 'url' }]);
      // ensure pages list for switching to Existing Page
      const resp = await api.getContentPages({ page: 1, limit: 200, status: 'PUBLISHED' as any });
      if (resp.success && resp.data) {
        const items = (resp.data.pages || []).map((p: any) => ({ id: p.id, title: p.title, slug: p.slug }));
        setPagesOptions(items);
      }
      setFooterLinkOpen(true);
      return;
    }
    setItemMenuId(menuId);
    setItemId(it?.id || null);
    setItemTitle(it?.title || "");
    const mode: 'url' | 'page' = it?.pageId ? 'page' : 'url';
    setItemMode(mode);
    setItemUrl(it?.url || "");
    setItemPageId(it?.pageId || undefined);
    setItemTarget(it?.target || "_self");
    setItemActive(it?.isActive ?? true);
    // load pages options (first 100)
    const resp = await api.getContentPages({ page: 1, limit: 100 });
    if (resp.success && resp.data) {
      const items = (resp.data.pages || []).map((p: any) => ({ id: p.id, title: p.title, slug: p.slug }));
      setPagesOptions(items);
    }
    setItemOpen(true);
  };

  const saveItem = async () => {
    if (!itemMenuId) return;
    if (!itemTitle.trim()) return toast.error('Title is required');
    const payload: any = {
      title: itemTitle.trim(),
      target: itemTarget,
      isActive: itemActive,
    };
    if (itemMode === 'page') {
      if (!itemPageId) return toast.error('Please select a page');
      payload.pageId = itemPageId; payload.url = undefined;
    } else {
      if (!itemUrl.trim()) return toast.error('Please enter a URL');
      payload.url = itemUrl.trim(); payload.pageId = undefined;
    }

    let resp;
    if (itemId) {
      resp = await api.updateNavigationItem(itemMenuId, itemId, payload);
    } else {
      resp = await api.createNavigationItem(itemMenuId, payload);
    }
    if (!resp.success) return toast.error(resp.error || 'Failed to save');
    toast.success('Saved');
    setItemOpen(false);
    setItemId(null);
    await loadMenus();
  };
  const openFooterSettings = () => {
    setFsTitle(footerSettings?.siteTitle || "");
    setFsDescription(footerSettings?.siteDescription || "");
    setFsFacebook(footerSettings?.facebookUrl || "");
    setFsTwitter(footerSettings?.twitterUrl || "");
    setFsInstagram(footerSettings?.instagramUrl || "");
    setFsContactTitle(footerSettings?.FooterContact?.title || 'Contact');
    setFsContactEmail(footerSettings?.FooterContact?.email || '');
    setFsContactPhone(footerSettings?.FooterContact?.phone || '');
    setFsContactAddress(footerSettings?.FooterContact?.address || '');
    setFooterSettingsOpen(true);
  };
  const saveFooterSettings = async () => {
    const sections = Array.isArray(footerSettings?.sections) ? footerSettings.sections.map((s: any, idx: number) => ({
      title: s.title,
      order: s.order ?? idx,
      links: (s.links || []).map((l: any, lidx: number) => ({ title: l.title, href: l.href, target: l.target || "_self", order: l.order ?? lidx }))
    })) : [];
    const resp = await api.updateFooterSettings({
      siteTitle: fsTitle,
      siteDescription: fsDescription,
      facebookUrl: fsFacebook || undefined,
      twitterUrl: fsTwitter || undefined,
      instagramUrl: fsInstagram || undefined,
      sections,
      contact: { title: fsContactTitle || 'Contact', email: fsContactEmail || undefined, phone: fsContactPhone || undefined, address: fsContactAddress || undefined },
    });
    if (!resp.success) return toast.error(resp.error || 'Failed to save footer settings');
    toast.success('Footer settings saved');
    setFooterSettingsOpen(false);
    try {
      const pub = await api.getPublicFooter();
      if (pub.success) setFooterSettings(pub.data || resp.data);
      else setFooterSettings(resp.data);
    } catch {
      setFooterSettings(resp.data);
    }
  };
  const openAddFooterLink = async () => {
    setFlSectionTitle("");
    setFlItems([{ title: "", href: "", target: "_self", mode: 'url' }]);
    // Load pages for selection
    const resp = await api.getContentPages({ page: 1, limit: 200, status: 'PUBLISHED' as any });
    if (resp.success && resp.data) {
      const items = (resp.data.pages || []).map((p: any) => ({ id: p.id, title: p.title, slug: p.slug }));
      setPagesOptions(items);
    }
    setFooterLinkOpen(true);
  };
  const saveFooterLink = async () => {
    if (!flSectionTitle.trim()) return toast.error('Section title is required');
    const cleaned = flItems
      .map(i => ({ ...i, title: i.title.trim(), href: i.href.trim(), target: i.target || "_self" }))
      .map(i => {
        if (i.mode === 'page') {
          const pg = pagesOptions.find(p => p.id === i.pageId);
          const slug = pg ? String(pg.slug || '').replace(/^\//, '') : '';
          return { ...i, href: slug ? `/p/${slug}` : '' } as NewFooterLink;
        }
        return i as NewFooterLink;
      })
      .filter(i => i.title && i.href)
      .map(i => ({ title: i.title, href: i.href, target: i.target }));
    if (cleaned.length === 0) return toast.error('Add at least one link with title and URL');
    const existing = footerSettings || { siteTitle: '', siteDescription: '', sections: [] };
    const sections = Array.isArray(existing.sections) ? [...existing.sections] : [];
    let section = sections.find((s: any) => (s.title || '').trim().toLowerCase() === flSectionTitle.trim().toLowerCase());
    if (!section) {
      section = { title: flSectionTitle.trim(), order: sections.length, links: [] };
      sections.push(section);
    }
    section.links = Array.isArray(section.links) ? [...section.links] : [];
    for (const link of cleaned) {
      section.links.push({ title: link.title, href: link.href, target: link.target, order: section.links.length });
    }
    const resp = await api.updateFooterSettings({
      siteTitle: existing.siteTitle || fsTitle || 'Ascendra Bio',
      siteDescription: existing.siteDescription || fsDescription || '',
      facebookUrl: existing.facebookUrl,
      twitterUrl: existing.twitterUrl,
      instagramUrl: existing.instagramUrl,
      sections: sections.map((s: any, idx: number) => ({
        title: s.title,
        order: s.order ?? idx,
        links: (s.links || []).map((l: any, lidx: number) => ({ title: l.title, href: l.href, target: l.target || "_self", order: l.order ?? lidx }))
      })),
    });
    if (!resp.success) {
      // Optimistic local update so UI reflects immediately when not authenticated
      const current = footerSettings || { siteTitle: '', siteDescription: '', sections: [] } as any;
      const sectionsLocal = sections.map((s: any, idx: number) => ({ title: s.title, order: s.order ?? idx, links: (s.links || []).map((l: any, lidx: number) => ({ title: l.title, href: l.href, target: l.target || '_self', order: l.order ?? lidx })) }));
      setFooterSettings({ ...current, sections: sectionsLocal });
      setFooterLinkOpen(false);
      // Also optimistically append to footer menu items for display
      if (footerMenu) {
        const newItems = cleaned.map((link, i) => ({ id: `tmp-${Date.now()}-${i}`, title: link.title, url: link.href, target: link.target, order: (footerMenu.items?.length || 0) + i }));
        setFooterMenu({ ...footerMenu, items: [...(footerMenu.items || []), ...newItems] });
      }
      return toast.warning('Saved locally. Login required to persist changes.');
    }
    toast.success('Footer link added');
    setFooterLinkOpen(false);
    // Create navigation items so they appear like Main Navigation
    try {
      if (footerMenu?.id) {
        for (let i = 0; i < cleaned.length; i++) {
          const link = cleaned[i];
          await api.createNavigationItem(footerMenu.id, { title: link.title, url: link.href, target: link.target, order: (footerMenu.items?.length || 0) + i, isActive: true } as any);
        }
      }
    } catch { }
    try {
      const pub = await api.getPublicFooter();
      if (pub.success) setFooterSettings(pub.data || resp.data);
      else setFooterSettings(resp.data);
    } catch {
      setFooterSettings(resp.data);
    }
    // Reload menus to reflect newly added items
    await loadMenus();
  };

  const moveItem = async (which: 'main' | 'footer' | 'other', itemId: string, direction: 'up' | 'down', menuIdOverride?: string) => {
    const menu = which === 'main' ? mainMenu : which === 'footer' ? footerMenu : (menus.find(m => m.id === menuIdOverride) as any);
    if (!menu) return;
    const items = [...(menu.items || [])].sort((a: any, b: any) => a.order - b.order);
    const idx = items.findIndex((i: any) => i.id === itemId);
    if (idx === -1) return;
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= items.length) return;
    const tmp = items[idx].order; items[idx].order = items[swapIdx].order; items[swapIdx].order = tmp;
    const orders = items.map((i: any) => ({ id: i.id, order: i.order }));
    await api.reorderNavigationItems(menu.id, orders);
    await loadMenus();
  };

  return (
    <ProtectedRoute requiredRoles={["ADMIN", "MANAGER", "STAFF"]}>
      <DashboardLayout>
        <div className="space-y-0 px-2 sm:px-0">
          {/* Dark hero strip */}
          <div className="relative bg-mist border border-line border-t-2 border-t-[#5A9ADA] rounded-2xl mx-1 sm:mx-0 overflow-hidden">
            <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'linear-gradient(rgba(77,125,242,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(77,125,242,0.6) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
            <div className="absolute top-0 right-0 w-[400px] h-[200px] bg-[#5A9ADA]/8 rounded-full blur-[100px] pointer-events-none" />
            <div className="relative z-10 px-6 py-6 sm:px-8 sm:py-7">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h1 className="text-xl font-black text-[#043061] tracking-tight">Navigation</h1>
                  <p className="text-xs text-gray-500 mt-0.5">Manage site menus</p>
                </div>
                <Button
                  onClick={openNew}
                  className="w-full sm:w-auto h-9 px-4 bg-white hover:bg-gray-100 text-[#043061] rounded-xl text-sm font-semibold"
                >
                  <Plus className="h-4 w-4 mr-2" /> New Menu
                </Button>
              </div>
            </div>
          </div>

          {/* Navigation Menus overview */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
            <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100">
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-slate-100">
                <LinkIcon className="h-4 w-4 text-slate-500" />
              </div>
              <div>
                <p className="font-semibold text-sm text-slate-800">Navigation Menus</p>
                <p className="text-xs text-slate-500">Overview of navigation menus</p>
              </div>
            </div>
            <div className="overflow-x-auto">
              <Table className="min-w-[500px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Items</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(menus || []).map((m) => (
                    <TableRow key={m.id}>
                      <TableCell className="font-medium">{m.name}</TableCell>
                      <TableCell>{m.location === 'main' ? 'Main Navigation' : m.location === 'footer' ? 'Footer Navigation' : m.location}</TableCell>
                      <TableCell>{m.items?.length ?? 0}</TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEdit(m)}>
                              <Edit3 className="h-4 w-4 mr-2" />
                              Edit Menu
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-red-600" onClick={() => requestDelete(m.id)}>
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete Menu
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

          <div className="grid gap-5 md:grid-cols-2">
            {/* Main Navigation */}
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
              <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100">
                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-slate-100">
                  <LinkIcon className="h-4 w-4 text-slate-500" />
                </div>
                <div>
                  <p className="font-semibold text-sm text-slate-800">Main Navigation</p>
                  <p className="text-xs text-slate-500">Configure your website's main navigation menu</p>
                </div>
              </div>
              <div className="p-4 sm:p-5">
                <div className="space-y-2">
                  {(mainMenu?.items || []).sort((a: any, b: any) => a.order - b.order).map((it: any) => (
                    <div key={it.id} className="flex items-center justify-between p-2 sm:p-3 border rounded-lg gap-2">
                      <span className="text-sm sm:text-base truncate">{it.title}</span>
                      <div className="flex items-center gap-1 sm:gap-2 shrink-0">
                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => moveItem('main', it.id, 'up')}><ArrowUp className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => moveItem('main', it.id, 'down')}><ArrowDown className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openItemEditor(mainMenu.id, it)}><Edit3 className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8 hover:text-red-600" onClick={async () => { await api.deleteNavigationItem(mainMenu.id, it.id); toast.success('Deleted'); loadMenus(); }}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
                <Button className="w-full mt-4" onClick={async () => {
                  if (!mainMenu) return;
                  await openItemEditor(mainMenu.id);
                  await loadMenus();
                }}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Menu Item
                </Button>
              </div>
            </div>

            {/* Footer Navigation */}
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
              <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100">
                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-slate-100">
                  <LinkIcon className="h-4 w-4 text-slate-500" />
                </div>
                <div>
                  <p className="font-semibold text-sm text-slate-800">Footer Navigation</p>
                  <p className="text-xs text-slate-500">Configure your website's footer links</p>
                </div>
              </div>
              <div className="p-4 sm:p-5">
                <div className="space-y-2">
                  {(footerMenu?.items || []).sort((a: any, b: any) => a.order - b.order).map((it: any) => (
                    <div key={it.id} className="flex items-center justify-between p-2 sm:p-3 border rounded-lg gap-2">
                      <span className="text-sm sm:text-base truncate">{it.title}</span>
                      <div className="flex items-center gap-1 sm:gap-2 shrink-0">
                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => moveItem('footer', it.id, 'up')}><ArrowUp className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => moveItem('footer', it.id, 'down')}><ArrowDown className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openItemEditor(footerMenu.id, it)}><Edit3 className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8 hover:text-red-600" onClick={async () => { await api.deleteNavigationItem(footerMenu.id, it.id); toast.success('Deleted'); loadMenus(); }}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex flex-col sm:flex-row gap-2 mt-4">
                  <Button className="w-full" variant="secondary" onClick={openFooterSettings}>Footer Settings</Button>
                  <Button className="w-full" onClick={openAddFooterLink}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Link
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Footer: Store Overview and Contact cards removed per request */}

          {/* Other Menus */}
          <div className="grid gap-5 md:grid-cols-2">
            {(menus || []).filter(m => m.location !== 'main' && m.location !== 'footer').map((menu) => (
              <div key={menu.id} className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
                <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100">
                  <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-slate-100">
                    <LinkIcon className="h-4 w-4 text-slate-500" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm text-slate-800">{menu.name}</p>
                    <p className="text-xs text-slate-500">Type: {menu.location}</p>
                  </div>
                </div>
                <div className="p-4 sm:p-5">
                  <div className="space-y-2">
                    {(menu.items || []).sort((a: any, b: any) => a.order - b.order).map((it: any) => (
                      <div key={it.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <span>{it.title}</span>
                        <div className="flex items-center gap-2">
                          <Button size="sm" variant="ghost" onClick={() => moveItem('other', it.id, 'up', menu.id)}><ArrowUp className="h-4 w-4" /></Button>
                          <Button size="sm" variant="ghost" onClick={() => moveItem('other', it.id, 'down', menu.id)}><ArrowDown className="h-4 w-4" /></Button>
                          <Button size="sm" variant="ghost" onClick={() => openItemEditor(menu.id, it)}><Edit3 className="h-4 w-4" /></Button>
                          <Button size="sm" variant="ghost" onClick={async () => { await api.deleteNavigationItem(menu.id, it.id); toast.success('Deleted'); loadMenus(); }}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <Button className="w-full mt-4" onClick={async () => { await openItemEditor(menu.id); await loadMenus(); }}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Menu Item
                  </Button>
                </div>
              </div>
            ))}
          </div>

          {/* Edit/Create Item Dialog */}
          <Dialog open={itemOpen} onOpenChange={setItemOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{itemId ? 'Edit Menu Item' : 'Add Menu Item'}</DialogTitle>
                <DialogDescription>Link to a page or a custom URL.</DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label>Title</Label>
                  <Input value={itemTitle} onChange={(e) => setItemTitle(e.target.value)} placeholder="Menu item title" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Button variant={itemMode === 'page' ? 'default' : 'outline'} onClick={() => setItemMode('page')}><LinkIcon className="h-4 w-4 mr-2" />Link a Page</Button>
                  <Button variant={itemMode === 'url' ? 'default' : 'outline'} onClick={() => setItemMode('url')}><LinkIcon className="h-4 w-4 mr-2" />Custom URL</Button>
                </div>
                {itemMode === 'page' ? (
                  <div>
                    <Label>Page</Label>
                    <Select value={itemPageId} onValueChange={(v) => setItemPageId(v)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a page" />
                      </SelectTrigger>
                      <SelectContent>
                        {pagesOptions.map(p => (
                          <SelectItem key={p.id} value={p.id}>{p.title} (/ {p.slug})</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : (
                  <div>
                    <Label>URL</Label>
                    <Input value={itemUrl} onChange={(e) => setItemUrl(e.target.value)} placeholder="/path or https://..." />
                  </div>
                )}
                <div>
                  <Label>Target</Label>
                  <Select value={itemTarget} onValueChange={(v) => setItemTarget(v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_self">Same tab</SelectItem>
                      <SelectItem value="_blank">New tab</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2">
                  <input id="active" type="checkbox" checked={itemActive} onChange={(e) => setItemActive(e.target.checked)} />
                  <Label htmlFor="active">Active</Label>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setItemOpen(false)}>Cancel</Button>
                <Button onClick={saveItem}>Save</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Footer Settings Dialog */}
          <Dialog open={footerSettingsOpen} onOpenChange={setFooterSettingsOpen}>
            <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-2xl">
              <DialogHeader>
                <DialogTitle>Footer Settings</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label>Store Title</Label>
                  <Input value={fsTitle} onChange={(e) => setFsTitle(e.target.value)} placeholder="Ascendra Bio" />
                </div>
                <div>
                  <Label>Store Description</Label>
                  <Input value={fsDescription} onChange={(e) => setFsDescription(e.target.value)} placeholder="Leading supplier of 99% pure research peptides..." />
                </div>
                {/* <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  <div>
                    <Label>Facebook URL</Label>
                    <Input value={fsFacebook} onChange={(e)=>setFsFacebook(e.target.value)} placeholder="https://facebook.com/..." />
                  </div>
                  <div>
                    <Label>Twitter URL</Label>
                    <Input value={fsTwitter} onChange={(e)=>setFsTwitter(e.target.value)} placeholder="https://x.com/..." />
                  </div>
                  <div>
                    <Label>Instagram URL</Label>
                    <Input value={fsInstagram} onChange={(e)=>setFsInstagram(e.target.value)} placeholder="https://instagram.com/..." />
                  </div>
                </div> */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <div>
                    <Label>Contact Title</Label>
                    <Input value={fsContactTitle} onChange={(e) => setFsContactTitle(e.target.value)} placeholder="Contact" />
                  </div>
                  <div>
                    <Label>Contact Email</Label>
                    <Input value={fsContactEmail} onChange={(e) => setFsContactEmail(e.target.value)} placeholder="lab@peptideresearch.com" />
                  </div>
                  <div>
                    <Label>Contact Address</Label>
                    <Input value={fsContactAddress} onChange={(e) => setFsContactAddress(e.target.value)} placeholder="San Francisco, CA" />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setFooterSettingsOpen(false)}>Cancel</Button>
                <Button onClick={saveFooterSettings}>Save</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Add Footer Link Dialog */}
          <Dialog open={footerLinkOpen} onOpenChange={setFooterLinkOpen}>
            <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-2xl">
              <DialogHeader>
                <DialogTitle>Add Footer Link</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label>Section Title</Label>
                  <Input value={flSectionTitle} onChange={(e) => setFlSectionTitle(e.target.value)} placeholder="Support" />
                </div>
                <div className="space-y-3">
                  {flItems.map((it, idx) => (
                    <div key={`fl-${idx}`} className="border rounded-md p-3 space-y-2 bg-muted/20">
                      <div>
                        <Label>Link Title</Label>
                        <Input value={it.title} onChange={(e) => {
                          const v = e.target.value; setFlItems(prev => prev.map((p, i) => i === idx ? ({ ...p, title: v }) : p));
                        }} placeholder="About us" />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label>Link Type</Label>
                          <Select value={it.mode} onValueChange={(v: 'url' | 'page') => setFlItems(prev => prev.map((p, i) => i === idx ? ({ ...p, mode: v }) : p))}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="url">External URL</SelectItem>
                              <SelectItem value="page">Existing Page</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        {it.mode === 'url' ? (
                          <div>
                            <Label>Link URL</Label>
                            <Input value={it.href} onChange={(e) => {
                              const v = e.target.value; setFlItems(prev => prev.map((p, i) => i === idx ? ({ ...p, href: v }) : p));
                            }} placeholder="/p/about-us or https://..." />
                          </div>
                        ) : (
                          <div>
                            <Label>Page</Label>
                            <Select value={it.pageId} onValueChange={(v) => setFlItems(prev => prev.map((p, i) => i === idx ? ({ ...p, pageId: v }) : p))}>
                              <SelectTrigger>
                                <SelectValue placeholder="Select a page" />
                              </SelectTrigger>
                              <SelectContent>
                                {pagesOptions.map(p => (
                                  <SelectItem key={p.id} value={p.id}>{p.title} (/ {p.slug})</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                      </div>
                      <div>
                        <Label>Target</Label>
                        <Select value={it.target} onValueChange={(v) => setFlItems(prev => prev.map((p, i) => i === idx ? ({ ...p, target: v }) : p))}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="_self">Same tab</SelectItem>
                            <SelectItem value="_blank">New tab</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex justify-end">
                        {flItems.length > 1 && (
                          <Button variant="ghost" className="text-red-600" onClick={() => setFlItems(prev => prev.filter((_, i) => i !== idx))}>Remove</Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                <div>
                  <Button variant="secondary" onClick={() => setFlItems(prev => [...prev, { title: "", href: "", target: "_self", mode: 'url' }])}>+ Add another link</Button>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setFooterLinkOpen(false)}>Cancel</Button>
                <Button onClick={saveFooterLink}>Save</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Create Menu Dialog */}
          <Dialog open={newOpen} onOpenChange={setNewOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Menu</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label>Name</Label>
                  <Input value={menuName} onChange={(e) => setMenuName(e.target.value)} placeholder="Main Navigation" />
                </div>
                <div>
                  <Label>Location</Label>
                  <Input value={menuLocation} onChange={(e) => setMenuLocation(e.target.value)} placeholder="main" />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setNewOpen(false)}>Cancel</Button>
                <Button onClick={createMenu}>Create</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Edit Menu Dialog */}
          <Dialog open={editOpen} onOpenChange={setEditOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Edit Menu</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label>Name</Label>
                  <Input value={menuName} onChange={(e) => setMenuName(e.target.value)} />
                </div>
                <div>
                  <Label>Location</Label>
                  <Input value={menuLocation} onChange={(e) => setMenuLocation(e.target.value)} />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
                <Button onClick={updateMenu}>Save</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Delete Confirm */}
          <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete this menu?</AlertDialogTitle>
                <AlertDialogDescription>
                  This action cannot be undone. All associated items will also be removed.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={confirmDelete} className="bg-red-600 hover:bg-red-700">Delete</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
