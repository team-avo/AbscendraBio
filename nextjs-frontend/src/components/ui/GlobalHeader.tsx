"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
// Sheet no longer used — replaced with centered modal mobile menu (portaled via createPortal)
import { createPortal } from "react-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { CartSidebar } from "@/components/cart/CartSidebar";
import { 
  Menu, ShoppingCart, User, List, LogOut, LayoutDashboard, Copy, Check as CheckIcon, Tag, 
  Search, Bell, Plus, Globe, CreditCard, Users, Heart, FileText, X, SlidersHorizontal, ArrowLeft, Home
} from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { useCart } from "@/contexts/cart-context";
import { AuthModal } from "@/components/auth/AuthModal";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useEffect, useState, useMemo, useCallback } from "react";
import { api, formatDate } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CreateCustomerDialog } from "@/components/customers/create-customer-dialog";
import { CreateOrderDialog } from "@/components/orders/create-order-dialog";
import { useDashboard } from "@/contexts/dashboard-context";
import { motion, AnimatePresence } from "motion/react";

interface GlobalHeaderProps {
  onMenuClick?: () => void;
}

/** Hook: returns true once user has scrolled past `threshold` pixels */
function useScrolled(threshold = 20) {
  const [scrolled, setScrolled] = useState(false);
  const handleScroll = useCallback(() => {
    setScrolled(window.scrollY > threshold);
  }, [threshold]);
  useEffect(() => {
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);
  return scrolled;
}

export default function GlobalHeader({ onMenuClick: externalOnMenuClick }: GlobalHeaderProps) {
  const pathname = usePathname();
  const isDashboardRoute = pathname.startsWith('/admin') || 
                          pathname.startsWith('/dashboard') || 
                          pathname.startsWith('/account') ||
                          pathname.startsWith('/inventory') ||
                          pathname.startsWith('/orders') ||
                          (pathname.startsWith('/products') && !pathname.startsWith('/landing/products')) ||
                          pathname.startsWith('/customers') ||
                          pathname.startsWith('/analytics') ||
                          pathname.startsWith('/marketing') ||
                          pathname.startsWith('/content') ||
                          pathname.startsWith('/payments') ||
                          pathname.startsWith('/shipping') ||
                          pathname.startsWith('/settings');

  if (isDashboardRoute) return null;

  const router = useRouter();
  const { toggleSidebar } = useDashboard();
  const scrolled = useScrolled(30);
  
  const handleMenuClick = externalOnMenuClick || toggleSidebar;
  
  // Context detection
  const isAccountPage = pathname?.startsWith("/account");
  const isLandingPage = pathname === "/";
  const isLandingRoute = pathname?.startsWith("/landing") || pathname === "/";
  const isAdminPage = !isLandingRoute && !isAccountPage && (
    pathname === "/admin-dashboard" || 
    pathname?.startsWith("/admin") || 
    pathname?.startsWith("/orders") || 
    pathname?.startsWith("/customers") || 
    pathname?.startsWith("/products") ||
    pathname?.startsWith("/coupons") ||
    pathname?.startsWith("/analytics")
  );

  const isHome = pathname === "/" || pathname === "/landing" || pathname === "/landing/";
  const isProducts = pathname?.startsWith("/landing/products");
  const isThirdPartyTesting = pathname?.startsWith("/landing/third-party-testing");
  const { isAuthenticated, hasRole, logout, user, openLoginModal } = useAuth();
  const { items } = useCart();

  const [extraLinks, setExtraLinks] = useState<Array<{ title: string; href: string; target?: string }>>([]);
  const [openContact, setOpenContact] = useState<boolean>(false);
  const [contactEmail, setContactEmail] = useState<string>("");
  const [contactMessage, setContactMessage] = useState<string>("");
  const [isSending, setIsSending] = useState<boolean>(false);
  
  // Admin Features State
  const [showCreateCustomerDialog, setShowCreateCustomerDialog] = useState(false);
  const [showCreateOrderDialog, setShowCreateOrderDialog] = useState(false);
  const [notifications, setNotifications] = useState<Array<any>>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  // Mobile menu state — controlled so we can auto-close on route change
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  useEffect(() => {
    setMobileMenuOpen(false);
    setOpenContact(false);
  }, [pathname]);

  // Lock body scroll while the centered mobile menu is open
  useEffect(() => {
    if (mobileMenuOpen) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = prev; };
    }
  }, [mobileMenuOpen]);

  // Close mobile menu on Escape key
  useEffect(() => {
    if (!mobileMenuOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMobileMenuOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mobileMenuOpen]);

  // Store page state (synced with URL)
  const searchParams = useSearchParams();
  const storeSearch = searchParams.get('q') || '';
  const storeSort = searchParams.get('sort') || 'featured';

  const updateStoreParams = (updates: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(updates).forEach(([key, val]) => {
      if (!val || val === 'All' || val === 'featured') params.delete(key);
      else params.set(key, val);
    });
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };


  const isLinkActive = (href: string): boolean => {
    try {
      const noQuery = href.split("?")[0].split("#")[0];
      return pathname === noQuery || (pathname?.startsWith(noQuery) ?? false);
    } catch {
      return false;
    }
  };

  useEffect(() => {
    let mounted = true;
    const loadMenu = async () => {
      try {
        let resp = await api.getPublicNavigationMenus({ location: 'main' });
        if (!mounted) return;
        let chosen: any | null = null;
        if (resp.success && resp.data && resp.data.menus?.length) {
          chosen = resp.data.menus[0];
        }
        if (!chosen) {
          const allResp = await api.getPublicNavigationMenus();
          if (!mounted) return;
          if (allResp.success && allResp.data) {
            const all = allResp.data.menus || [];
            chosen = all.find((m: any) => String(m.location || '').toLowerCase() === 'main')
              || all.find((m: any) => String(m.name || '').toLowerCase().includes('main'))
              || all[0]
              || null;
          }
        }
        if (chosen) {
          const r = await api.getPublicNavigationItems(chosen.id);
          if (!mounted) return;
          if (r.success && r.data) {
            const items = (r.data.items || []).filter((it: any) => it.isActive);
            const resolved: Array<{ title: string; href: string; target?: string }> = [];
            for (const it of items) {
              if (!it) continue;
              const href = it.href || it.url || "";
              if (!href) continue;
              const lower = String(it.title || "").toLowerCase();
              if (lower === "home" || lower === "products") continue;
              resolved.push({ title: it.title || href, href, target: it.target || "_self" });
            }
            if (mounted) setExtraLinks(resolved);
          }
        }
      } catch { /* ignore */ }
    };

    const loadNotifications = async () => {
      if (!isAuthenticated || !hasRole(["ADMIN", "MANAGER", "STAFF", "SALES_REP"])) return;
      try {
        const res = await api.getNotifications({ limit: 10 });
        if (mounted && res.success && res.data) {
          setNotifications(res.data.notifications || []);
          setUnreadCount(res.data.notifications?.length || 0);
        }
      } catch (err) { console.error("Notifications error", err); }
    };

    loadMenu();
    loadNotifications();
    const interval = setInterval(loadNotifications, 60_000);
    
    return () => { 
      mounted = false; 
      clearInterval(interval);
    };
  }, [isAuthenticated, hasRole]);

  const handleContactSend = async () => {
    const email = (contactEmail || "").trim();
    const message = (contactMessage || "").trim();
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      try { (await import("sonner")).toast?.error?.("Enter a valid email"); } catch { }
      return;
    }
    if (!message) {
      try { (await import("sonner")).toast?.error?.("Message is required"); } catch { }
      return;
    }
    try {
      setIsSending(true);
      const r = await api.contactLab({ email, message });
      if (r.success) {
        try { (await import("sonner")).toast?.success?.("Message sent. We will get back to you."); } catch { }
        setContactEmail("");
        setContactMessage("");
        setOpenContact(false);
      } else {
        try { (await import("sonner")).toast?.error?.(r.error || "Failed to send"); } catch { }
      }
    } catch (e: any) {
      try { (await import("sonner")).toast?.error?.(e?.message || "Failed to send"); } catch { }
    } finally {
      setIsSending(false);
    }
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 w-full transition-all duration-500" suppressHydrationWarning>
      <div className={`mx-auto max-w-7xl px-4 sm:px-6 transition-all duration-500 ${scrolled ? 'pt-2' : 'pt-4 sm:pt-6'}`}>
        <nav
          className={`flex items-center justify-between rounded-full px-5 sm:px-6 transition-all duration-500
            backdrop-blur-xl border
            ${scrolled
              ? 'h-14 bg-white/80 border-[#043061]/[0.05] shadow-[0_8px_32px_rgba(0,0,0,0.05)]'
              : isLandingPage
                ? 'h-16 bg-white/80 border-[#043061]/[0.06] shadow-[0_8px_32px_rgba(0,0,0,0.05)]'
                : 'h-16 bg-white/[0.05] border-[#043061]/[0.03]'
            }`}
        >
          {/* Logo & Admin Sidebar Trigger */}
          <div className="flex items-center space-x-4">
            {isAdminPage && (
              <Button
                variant="ghost"
                size="icon"
                className="lg:hidden -ml-2 rounded-full"
                onClick={handleMenuClick}
              >
                <Menu className="h-5 w-5" />
              </Button>
            )}
            <Link href="/" className="flex-shrink-0 flex items-center group transition-transform hover:scale-105 active:scale-95">
              <Image
                src="/logo.png"
                alt="Ascendra Bio"
                width={140}
                height={32}
                className={`w-auto group-hover:opacity-80 transition-all duration-300 ${scrolled ? 'h-5 sm:h-6' : 'h-6 sm:h-7'} ${false ? 'brightness-0 invert' : ''}`}
                priority
              />
            </Link>
          </div>

          {/* ───── ADAPTIVE DISCOVERY BAR (Store Only) ───── */}
          {isProducts ? (
            <div className="flex-1 max-w-2xl mx-4 hidden md:flex items-center gap-3">
              <div className="flex items-center gap-1.5 mr-2">
                {[{ label: 'All', value: 'All' }, { label: 'Peptides', value: 'Assayed Research Peptides' }].map(({ label, value }) => (
                  <button
                    key={value}
                    onClick={() => updateStoreParams({ cat: value === 'All' ? null : value })}
                    className={`whitespace-nowrap px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest transition-all duration-300 ${
                      (searchParams.get('cat') || 'All') === value
                        ? 'bg-primary text-white shadow-lg shadow-primary/20 scale-105'
                        : 'bg-black/[0.03] text-primary/40 hover:text-primary hover:bg-black/5'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className="relative flex-1 group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-primary/30 group-focus-within:text-primary transition-colors w-3.5 h-3.5" />
                <Input
                  placeholder="Search products..."
                  aria-label="Search products"
                  value={storeSearch}
                  onChange={(e) => updateStoreParams({ q: e.target.value })}
                  className="pl-10 h-10 bg-black/[0.03] border-transparent rounded-full focus:bg-white focus:ring-4 focus:ring-primary/5 transition-all text-xs font-bold"
                />
              </div>
              <Select value={storeSort} onValueChange={(v) => updateStoreParams({ sort: v })}>
                <SelectTrigger className="w-28 h-10 border-transparent bg-black/[0.03] rounded-full font-black text-[9px] uppercase tracking-widest text-primary/60">
                  <SelectValue placeholder="Sort" />
                </SelectTrigger>
                <SelectContent className="rounded-2xl shadow-2xl border-white/20 backdrop-blur-xl">
                  <SelectItem value="featured">Featured</SelectItem>
                  <SelectItem value="name">Name: A–Z</SelectItem>
                  <SelectItem value="price-low">Price: Low-High</SelectItem>
                  <SelectItem value="price-high">Price: High-Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="flex-1" />
          )}

            {/* ───── NAV LINKS (right-aligned, beside actions) ───── */}
            {!isProducts && (
              <div className="hidden md:flex items-center">
                <nav className="flex items-center space-x-1 lg:space-x-2 mr-2">
                  {isLandingRoute ? (
                    <>
                      {isAuthenticated && (
                        <Link href="/landing/products" className={`px-4 py-2 text-[13px] font-semibold rounded-full transition-all ${false ? 'text-white hover:text-white hover:bg-white/15' : 'text-gray-600 hover:text-[#043061] hover:bg-gray-50'}`}>
                          Products
                        </Link>
                      )}
                      <Link href="/landing/third-party-testing" className={`px-4 py-2 text-[13px] font-semibold rounded-full transition-all ${false ? 'text-white hover:text-white hover:bg-white/15' : 'text-gray-600 hover:text-[#043061] hover:bg-gray-50'}`}>
                        3rd Party Testing
                      </Link>
                      <button onClick={() => setOpenContact(true)} className={`cursor-pointer px-4 py-2 text-[13px] font-semibold rounded-full transition-all ${false ? 'text-white hover:text-white hover:bg-white/15' : 'text-gray-600 hover:text-[#043061] hover:bg-gray-50'}`}>
                        Contact
                      </button>
                    </>
                  ) : isAdminPage ? (
                    <>
                      <Link href="/admin-dashboard" className={`px-4 py-2 text-[13px] font-semibold rounded-full transition-all ${pathname === "/admin-dashboard" ? "bg-gray-100 text-[#043061]" : "text-gray-600 hover:bg-gray-50"}`}>
                        Dashboard
                      </Link>
                      <Link href="/orders" className={`px-4 py-2 text-[13px] font-semibold rounded-full transition-all ${pathname?.startsWith("/orders") ? "bg-gray-100 text-[#043061]" : "text-gray-600 hover:bg-gray-50"}`}>
                        Orders
                      </Link>
                    </>
                  ) : (
                    <>
                      <Link href="/account" className={`px-4 py-2 text-[13px] font-semibold rounded-full transition-all ${pathname === "/account" ? "bg-gray-100 text-[#043061]" : "text-gray-600 hover:bg-gray-50"}`}>
                        Profile
                      </Link>
                      <Link href="/account/orders" className={`px-4 py-2 text-[13px] font-semibold rounded-full transition-all ${pathname?.startsWith("/account/orders") ? "bg-gray-100 text-[#043061]" : "text-gray-600 hover:bg-gray-50"}`}>
                        My Orders
                      </Link>
                    </>
                  )}
                </nav>
              </div>
            )}
            <div className={`w-[1px] h-4 mx-3 hidden lg:block ${false ? 'bg-white/20' : 'bg-gray-200'}`} />

            {/* Actions Section */}
            <div className="flex items-center space-x-2">
              {isAdminPage && (
                <div className="flex items-center space-x-1">
                  <Button variant="ghost" size="icon" className="rounded-full h-9 w-9 hover:bg-black/5">
                    <Search className="h-4 w-4" />
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="relative rounded-full h-9 w-9 hover:bg-black/5">
                        <Bell className="h-4 w-4" />
                        {unreadCount > 0 && <span className="absolute top-2 right-2 h-2 w-2 bg-[#043061] rounded-full" />}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-80 rounded-[2rem] p-4 mt-4 shadow-2xl border-white/40 backdrop-blur-xl bg-white/95">
                      <DropdownMenuLabel className="font-bold flex items-center justify-between">
                        Notifications {unreadCount > 0 && <Badge className="bg-[#043061] text-white ml-2">{unreadCount}</Badge>}
                      </DropdownMenuLabel>
                      <DropdownMenuSeparator className="my-2" />
                      <ScrollArea className="h-64">
                         {notifications.length > 0 ? (
                           notifications.map(n => (
                             <div key={n.id} className="p-3 rounded-2xl hover:bg-gray-50 border-b last:border-0 border-gray-50">
                               <p className="text-sm font-bold text-[#043061]">{n.title}</p>
                               <p className="text-xs text-muted-foreground line-clamp-2">{n.description}</p>
                             </div>
                           ))
                         ) : <div className="p-12 text-center text-xs text-muted-foreground">No updates</div>}
                      </ScrollArea>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              )}

              {!isAdminPage && isAuthenticated && (
                <div className="hidden md:block">
                  <CartSidebar
                    trigger={
                      <Button variant="ghost" size="icon" className={`relative rounded-full h-10 w-10 transition-all active:scale-95 ${false ? 'hover:bg-white/10 text-white/80' : 'hover:bg-black/5'}`}>
                        <ShoppingCart className="h-5 w-5" />
                        {items.length > 0 && (
                          <Badge className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-[10px] rounded-full bg-[#5A9ADA] text-white border-2 border-white/20">
                            {items.reduce((sum, it) => sum + it.quantity, 0)}
                          </Badge>
                        )}
                      </Button>
                    }
                  />
                </div>
              )}

              {isAuthenticated ? (
                <div className="flex items-center space-x-2">
                  {/* Standard Profile Dropdown */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className={`flex items-center space-x-2 rounded-full p-1 pr-3 transition-all active:scale-95 ${false ? 'border border-white/10 bg-white/[0.06] hover:bg-white/10' : 'border border-black/5 bg-gray-50/50 hover:bg-gray-100'}`}>
                        <Avatar className="h-8 w-8 border-2 border-white/20">
                          <AvatarFallback className="bg-[#5A9ADA] text-white font-bold text-[9px] uppercase">
                            {`${(user?.firstName?.[0] || user?.email?.[0] || 'A').toUpperCase()}${(user?.lastName?.[0] || '').toUpperCase()}`}
                          </AvatarFallback>
                        </Avatar>
                        <span className={`text-[10px] font-black uppercase tracking-widest ${false ? 'text-white' : 'text-[#043061]'}`}>{user?.firstName}</span>
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="min-w-[200px] rounded-[1.25rem] p-3 shadow-2xl border-white/40 backdrop-blur-xl bg-white/95 mt-4">
                      <DropdownMenuItem asChild className="rounded-xl py-3 cursor-pointer">
                        <Link href={hasRole(["ADMIN", "MANAGER", "STAFF"]) ? "/admin-dashboard" : "/account"} className="flex items-center gap-3">
                          <LayoutDashboard className="h-4 w-4 text-[#043061]" />
                          <span className="font-bold text-xs uppercase tracking-widest">Dashboard</span>
                        </Link>
                      </DropdownMenuItem>
                      {!hasRole(["ADMIN", "MANAGER", "STAFF", "SALES_MANAGER", "SALES_REP"]) && (
                        <>
                          <DropdownMenuItem asChild className="rounded-xl py-3 cursor-pointer">
                            <Link href="/account" className="flex items-center gap-3">
                              <User className="h-4 w-4 text-[#043061]" />
                              <span className="font-bold text-xs uppercase tracking-widest">Profile</span>
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild className="rounded-xl py-3 cursor-pointer">
                            <Link href="/account/orders" className="flex items-center gap-3">
                              <List className="h-4 w-4 text-[#043061]" />
                              <span className="font-bold text-xs uppercase tracking-widest">My Orders</span>
                            </Link>
                          </DropdownMenuItem>
                        </>
                      )}
                      <DropdownMenuSeparator className="my-1" />
                      <DropdownMenuItem onClick={() => logout()} className="flex items-center gap-3 text-red-600 rounded-xl py-3 cursor-pointer">
                        <LogOut className="h-4 w-4" />
                        <span className="font-bold text-xs uppercase tracking-widest">Logout</span>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ) : (
                <div className="flex items-center space-x-2">
                  {isProducts ? (
                    <Link href="/">
                       <Button variant="ghost" className="hidden lg:flex items-center gap-2 rounded-full h-10 px-4 text-[10px] font-black uppercase tracking-widest text-primary hover:bg-black/5 transition-all">
                         <Home className="h-3.5 w-3.5" />
                         Home
                       </Button>
                    </Link>
                  ) : (
                    <>
                      <button onClick={() => openLoginModal('customer')} className={`px-4 py-2 text-[13px] font-semibold rounded-full transition-all ${false ? 'text-white hover:text-white hover:bg-white/15' : 'text-gray-500 hover:text-[#043061] hover:bg-gray-50'}`}>
                        Login
                      </button>
                      <button onClick={() => setOpenContact(true)} className={`px-6 py-2.5 text-[13px] font-bold rounded-full transition-all active:scale-95 ${false ? 'bg-white text-[#043061] hover:bg-gray-100 shadow-[0_10px_30px_rgba(255,255,255,0.1)]' : 'bg-[#043061] text-white hover:bg-[#0b4f96] shadow-[0_10px_30px_rgba(0,0,0,0.15)]'}`}>
                        Contact Us
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>

          {/* Mobile Trigger */}
          <div className="md:hidden flex items-center gap-1.5">
             {!isAdminPage && isAuthenticated && (
                <CartSidebar
                  trigger={
                    <Button variant="ghost" size="icon" className={`relative rounded-full h-11 w-11 ${false ? 'text-white hover:bg-white/15' : 'hover:bg-black/5'}`} aria-label="Open cart">
                      <ShoppingCart className="h-5 w-5" />
                      {items.length > 0 && (
                        <Badge className="absolute -top-0.5 -right-0.5 h-[18px] min-w-[18px] px-1 flex items-center justify-center text-[9px] rounded-full bg-[#5A9ADA] text-white border-2 border-white/20">
                          {items.reduce((sum, it) => sum + it.quantity, 0)}
                        </Badge>
                      )}
                    </Button>
                  }
                />
             )}
             <Button
               variant="ghost"
               size="icon"
               onClick={() => setMobileMenuOpen(true)}
               className={`rounded-full h-11 w-11 ${false ? 'text-white hover:bg-white/15' : 'hover:bg-black/5'}`}
               aria-label="Open menu"
             >
               <Menu className="h-6 w-6" />
             </Button>

             {/* Centered modal mobile menu — portaled to document.body to escape any transformed ancestor's containing block */}
             {typeof document !== 'undefined' && createPortal(
               <AnimatePresence>
                 {mobileMenuOpen && (
                 <motion.div
                   className="fixed inset-0 z-[100] md:hidden"
                   initial={{ opacity: 0 }}
                   animate={{ opacity: 1 }}
                   exit={{ opacity: 0 }}
                   transition={{ duration: 0.2 }}
                   role="dialog"
                   aria-modal="true"
                   aria-label="Main Navigation"
                 >
                   {/* Backdrop */}
                   <div
                     className="absolute inset-0 bg-[#043061]/70 backdrop-blur-md"
                     onClick={() => setMobileMenuOpen(false)}
                   />

                   {/* Centered panel — outer div does the centering (Flexbox), inner motion.div animates */}
                   <div className="absolute inset-0 flex items-center justify-center p-4 pointer-events-none">
                     <motion.div
                       className="relative w-full max-w-sm max-h-[85vh] bg-white rounded-[2rem] shadow-2xl flex flex-col overflow-hidden pointer-events-auto"
                       initial={{ opacity: 0, scale: 0.92, y: 20 }}
                       animate={{ opacity: 1, scale: 1, y: 0 }}
                       exit={{ opacity: 0, scale: 0.94, y: 10 }}
                       transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                     >
                     {/* Header with logo + close */}
                     <div className="px-6 pt-6 pb-5 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
                       <Image src="/logo.png" alt="Ascendra Bio" width={140} height={32} className="h-8 w-auto" />
                       <button
                         onClick={() => setMobileMenuOpen(false)}
                         className="h-10 w-10 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-700 transition-colors"
                         aria-label="Close menu"
                       >
                         <X className="h-5 w-5" />
                       </button>
                     </div>

                     {/* User info strip (authenticated only) */}
                     {isAuthenticated && (
                       <div className="px-6 py-4 bg-gray-50/60 border-b border-gray-100 flex items-center gap-3 flex-shrink-0">
                         <Avatar className="h-10 w-10">
                           <AvatarFallback className="bg-[#5A9ADA] text-white font-bold text-xs uppercase">
                             {`${(user?.firstName?.[0] || user?.email?.[0] || 'A').toUpperCase()}${(user?.lastName?.[0] || '').toUpperCase()}`}
                           </AvatarFallback>
                         </Avatar>
                         <div className="flex-1 min-w-0">
                           <p className="text-sm font-bold text-[#043061] truncate">{user?.firstName} {user?.lastName}</p>
                           <p className="text-[11px] text-gray-500 truncate">{user?.email}</p>
                         </div>
                       </div>
                     )}

                     {/* Nav links */}
                     <nav className="flex-1 overflow-y-auto px-4 py-4 space-y-1 min-h-0">
                       <Link
                         href="/"
                         onClick={() => setMobileMenuOpen(false)}
                         className={`block px-4 py-3.5 text-center text-[11px] font-black uppercase tracking-[0.2em] rounded-2xl transition-colors ${pathname === '/' ? 'bg-gray-100 text-[#043061]' : 'text-gray-500 hover:bg-gray-50 hover:text-[#043061]'}`}
                       >
                         Home
                       </Link>

                       {/* Products — only for authenticated users */}
                       {isAuthenticated && (
                         <Link
                           href="/landing/products"
                           onClick={() => setMobileMenuOpen(false)}
                           className={`block px-4 py-3.5 text-center text-[11px] font-black uppercase tracking-[0.2em] rounded-2xl transition-colors ${isProducts ? 'bg-gray-100 text-[#043061]' : 'text-gray-500 hover:bg-gray-50 hover:text-[#043061]'}`}
                         >
                           Products
                         </Link>
                       )}

                       <Link
                         href="/landing/third-party-testing"
                         onClick={() => setMobileMenuOpen(false)}
                         className={`block px-4 py-3.5 text-center text-[11px] font-black uppercase tracking-[0.2em] rounded-2xl transition-colors ${isThirdPartyTesting ? 'bg-gray-100 text-[#043061]' : 'text-gray-500 hover:bg-gray-50 hover:text-[#043061]'}`}
                       >
                         3rd Party Testing
                       </Link>

                       <button
                         onClick={() => { setMobileMenuOpen(false); setOpenContact(true); }}
                         className="block w-full text-center px-4 py-3.5 text-[11px] font-black uppercase tracking-[0.2em] text-gray-500 hover:bg-gray-50 hover:text-[#043061] rounded-2xl transition-colors"
                       >
                         Contact
                       </button>

                       {/* Role-aware sections for authenticated users */}
                       {isAuthenticated && (
                         <>
                           <div className="pt-4 pb-2 text-center text-[9px] font-black uppercase tracking-[0.25em] text-gray-400">
                             {hasRole(["ADMIN", "MANAGER", "STAFF", "SALES_MANAGER", "SALES_REP"]) ? 'Back-Office' : 'My Account'}
                           </div>
                           {hasRole(["ADMIN", "MANAGER", "STAFF", "SALES_MANAGER", "SALES_REP"]) ? (
                             <>
                               <Link
                                 href="/admin-dashboard"
                                 onClick={() => setMobileMenuOpen(false)}
                                 className="flex items-center justify-center gap-3 px-4 py-3.5 text-[11px] font-black uppercase tracking-[0.2em] text-gray-500 hover:bg-gray-50 hover:text-[#043061] rounded-2xl transition-colors"
                               >
                                 <LayoutDashboard className="h-4 w-4" />
                                 Dashboard
                               </Link>
                               <Link
                                 href="/orders"
                                 onClick={() => setMobileMenuOpen(false)}
                                 className="flex items-center justify-center gap-3 px-4 py-3.5 text-[11px] font-black uppercase tracking-[0.2em] text-gray-500 hover:bg-gray-50 hover:text-[#043061] rounded-2xl transition-colors"
                               >
                                 <List className="h-4 w-4" />
                                 Orders
                               </Link>
                             </>
                           ) : (
                             <>
                               <Link
                                 href="/account"
                                 onClick={() => setMobileMenuOpen(false)}
                                 className="flex items-center justify-center gap-3 px-4 py-3.5 text-[11px] font-black uppercase tracking-[0.2em] text-gray-500 hover:bg-gray-50 hover:text-[#043061] rounded-2xl transition-colors"
                               >
                                 <User className="h-4 w-4" />
                                 Profile
                               </Link>
                               <Link
                                 href="/account/orders"
                                 onClick={() => setMobileMenuOpen(false)}
                                 className="flex items-center justify-center gap-3 px-4 py-3.5 text-[11px] font-black uppercase tracking-[0.2em] text-gray-500 hover:bg-gray-50 hover:text-[#043061] rounded-2xl transition-colors"
                               >
                                 <List className="h-4 w-4" />
                                 My Orders
                               </Link>
                               <Link
                                 href="/account/favorites"
                                 onClick={() => setMobileMenuOpen(false)}
                                 className="flex items-center justify-center gap-3 px-4 py-3.5 text-[11px] font-black uppercase tracking-[0.2em] text-gray-500 hover:bg-gray-50 hover:text-[#043061] rounded-2xl transition-colors"
                               >
                                 <Heart className="h-4 w-4" />
                                 Favorites
                               </Link>
                             </>
                           )}
                         </>
                       )}
                     </nav>

                     {/* Footer actions */}
                     <div className="px-6 py-5 border-t border-gray-100 space-y-3 flex-shrink-0">
                       {!isAuthenticated ? (
                         <>
                           <Button
                             onClick={() => { setMobileMenuOpen(false); openLoginModal('customer'); }}
                             variant="outline"
                             className="w-full rounded-full h-12 uppercase text-[11px] font-black tracking-[0.15em] border-gray-200"
                           >
                             Login
                           </Button>
                           <Button
                             onClick={() => { setMobileMenuOpen(false); setOpenContact(true); }}
                             className="w-full bg-[#043061] hover:bg-[#0b4f96] text-white rounded-full h-12 uppercase text-[11px] font-black tracking-[0.15em]"
                           >
                             Contact Us
                           </Button>
                         </>
                       ) : (
                         <Button
                           onClick={() => { setMobileMenuOpen(false); logout(); }}
                           variant="ghost"
                           className="w-full bg-red-50 hover:bg-red-100 text-red-600 hover:text-red-700 rounded-full h-12 uppercase text-[11px] font-black tracking-[0.15em]"
                         >
                           <LogOut className="h-4 w-4 mr-2" />
                           Logout
                         </Button>
                       )}
                     </div>
                     </motion.div>
                   </div>
                 </motion.div>
                 )}
               </AnimatePresence>,
               document.body
             )}
          </div>
        </nav>
      </div>

      {/* Dialogs */}
      <CreateCustomerDialog open={showCreateCustomerDialog} onOpenChange={setShowCreateCustomerDialog} onSuccess={() => window.location.reload()} />
      <CreateOrderDialog open={showCreateOrderDialog} onOpenChange={setShowCreateOrderDialog} onSuccess={() => window.location.reload()} />

      <Dialog open={openContact} onOpenChange={setOpenContact}>
        <DialogContent className="max-w-xl rounded-[2.5rem] p-8 sm:p-12 backdrop-blur-2xl bg-white/95 shadow-2xl border-white/20">
          <DialogHeader>
            <DialogTitle className="text-3xl font-black uppercase tracking-tight text-[#043061]">Contact Lab</DialogTitle>
            <DialogDescription className="text-gray-500 mt-2">Send us your Enquiry and we’ll respond shortly.</DialogDescription>
          </DialogHeader>
          <div className="space-y-6 mt-8">
            <Input placeholder="Your email" type="email" className="h-14 px-6 rounded-2xl bg-gray-50/50" value={contactEmail} onChange={e => setContactEmail(e.target.value)} />
            <Textarea placeholder="How can we help?" rows={5} className="rounded-[2rem] p-6 bg-gray-50/50" value={contactMessage} onChange={e => setContactMessage(e.target.value)} />
            <div className="flex justify-end gap-3 pt-4">
              <Button variant="ghost" onClick={() => setOpenContact(false)} className="rounded-full px-8 text-gray-400 font-bold uppercase text-[10px] tracking-widest">Cancel</Button>
              <Button onClick={handleContactSend} disabled={isSending} className="bg-[#043061] text-white hover:bg-[#0b4f96] rounded-full px-12 h-14 font-black uppercase text-[10px] tracking-widest shadow-xl">
                {isSending ? 'Sending...' : 'Send Message'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </header>
  );
}
