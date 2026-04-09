"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { CartSidebar } from "@/components/cart/CartSidebar";
import { Menu, ShoppingCart, User, List, LogOut, LayoutDashboard, Copy, Check as CheckIcon, Tag } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { useCart } from "@/contexts/cart-context";
import { AuthModal } from "@/components/auth/AuthModal";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useEffect, useState, useMemo } from "react";
import { api } from "@/lib/api";

export default function LandingHeader() {
  const pathname = usePathname();
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
  const [couponCopied, setCouponCopied] = useState<boolean>(false);


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
        // Try location-filtered main menu first
        let resp = await api.getPublicNavigationMenus({ location: 'main' });
        if (!mounted) return;
        let chosen: any | null = null;
        if (resp.success && resp.data && resp.data.menus?.length) {
          chosen = resp.data.menus[0];
        }
        // Fallback: fetch all menus and pick the one resembling main
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
      } catch {
        /* ignore */
      }
    };
    loadMenu();
    return () => { mounted = false; };
  }, []);

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
    <header className="bg-white sticky top-0 z-50 backdrop-blur-sm bg-white/90 shadow-sm force-light" suppressHydrationWarning>
      <style>{`
        @keyframes depthPulse {
          0%, 100% {
            transform: scale(1);
            opacity: 1;
          }
          50% {
            transform: scale(1.08);
            opacity: 0.85;
          }
        }
        .animate-depth-pulse {
          animation: depthPulse 2s ease-in-out infinite;
        }

      `}</style>




      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-20">
          <Link href="/landing" className="flex items-center space-x-3">
            <Image
              src="/logo.png"
              alt="Ascendra Bio"
              width={210}
              height={70}
              className="h-14 sm:h-16 w-auto"
            />
          </Link>

          <nav className="hidden md:flex space-x-8">
            <Link href="/landing" className={`font-medium transition-colors relative group ${isHome ? "text-[#1B2D4F]" : "text-gray-600 hover:text-[#3A6FA0]"}`}>
              Home
              <span className={`absolute -bottom-1 left-0 h-0.5 bg-[#1B2D4F] transition-all ${isHome ? "w-full" : "w-0 group-hover:w-full"}`} />
            </Link>
            <Link href="/landing/products" className={`font-medium transition-colors relative group ${isProducts ? "text-[#3A6FA0]" : "text-gray-600 hover:text-[#3A6FA0]"}`}>
              Products
              <span className={`absolute -bottom-1 left-0 h-0.5 bg-[#3A6FA0] transition-all ${isProducts ? "w-full" : "w-0 group-hover:w-full"}`} />
            </Link>
            <Link href="/landing/third-party-testing" className={`font-medium transition-colors relative group ${isThirdPartyTesting ? "text-[#1B2D4F]" : "text-gray-600 hover:text-[#3A6FA0]"}`}>
              3rd Party Testing
              <span className={`absolute -bottom-1 left-0 h-0.5 bg-[#1B2D4F] transition-all ${isThirdPartyTesting ? "w-full" : "w-0 group-hover:w-full"}`} />
            </Link>
            {extraLinks.map((lnk) => {
              const active = isLinkActive(lnk.href);
              return (
                <Link key={`${lnk.title}-${lnk.href}`} href={lnk.href} target={lnk.target} rel={lnk.target === "_blank" ? "noopener noreferrer" : undefined} className={`font-medium transition-colors relative group ${active ? "text-[#1B2D4F]" : "text-gray-600 hover:text-[#3A6FA0]"}`}>
                  {lnk.title}
                  <span className={`absolute -bottom-1 left-0 h-0.5 bg-[#1B2D4F] transition-all ${active ? "w-full" : "w-0 group-hover:w-full"}`} />
                </Link>
              );
            })}
          </nav>
          {/* Desktop actions */}
          <div className="hidden md:flex items-center gap-3">
            <CartSidebar
              trigger={
                <Button variant="outline" size="icon" aria-label="Cart" className="relative border-gray-300 text-black hover:bg-gray-50 hover:border-[#3A6FA0]">
                  <ShoppingCart className="h-5 w-5" />
                  {items.length > 0 && (
                    <span className="absolute -top-1 -right-1 bg-[#1B2D4F] text-white text-[10px] leading-none px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                      {items.reduce((sum, it) => sum + it.quantity, 0)}
                    </span>
                  )}
                </Button>
              }
            />
            {isAuthenticated ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button aria-label="Account menu" className="rounded-full border border-gray-300 p-0.5 hover:border-[#3A6FA0]">
                    <Avatar className="h-9 w-9">
                      <AvatarImage src="" alt="Account" />
                      <AvatarFallback>
                        {`${(user?.firstName?.[0] || user?.email?.[0] || 'A').toUpperCase()}${(user?.lastName?.[0] || '').toUpperCase()}`}
                      </AvatarFallback>
                    </Avatar>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="force-light min-w-48">
                  {hasRole(["ADMIN", "MANAGER", "STAFF"]) ? (
                    <>
                      <DropdownMenuLabel>Signed in</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuSeparator />
                      <DropdownMenuItem asChild>
                        <Link href="/" className="flex items-center gap-2">
                          <LayoutDashboard className="h-4 w-4" />
                          <span>Dashboard</span>
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => logout()} className="flex items-center gap-2">
                        <LogOut className="h-4 w-4" />
                        <span>Logout</span>
                      </DropdownMenuItem>
                    </>
                  ) : user?.role === 'SALES_REP' ? (
                    <>
                      <DropdownMenuLabel>Signed in</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem asChild>
                        <Link href="/" className="flex items-center gap-2">
                          <LayoutDashboard className="h-4 w-4" />
                          <span>Dashboard</span>
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => logout()} className="flex items-center gap-2">
                        <LogOut className="h-4 w-4" />
                        <span>Logout</span>
                      </DropdownMenuItem>
                    </>
                  ) : (
                    <>
                      <DropdownMenuLabel>My Account</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem asChild>
                        <Link href="/account" className="flex items-center gap-2">
                          <User className="h-4 w-4" />
                          <span>My Account</span>
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link href="/account/orders" className="flex items-center gap-2">
                          <List className="h-4 w-4" />
                          <span>My Orders</span>
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => logout()} className="flex items-center gap-2">
                        <LogOut className="h-4 w-4" />
                        <span>Logout</span>
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <>
                <Button onClick={() => openLoginModal('customer')} variant="outline" className="border-gray-300 text-black hover:bg-gray-50 hover:border-[#3A6FA0]">Login</Button>
                <Button onClick={() => openLoginModal('admin')} variant="outline" className="border-gray-300 text-black hover:bg-gray-50 hover:border-[#3A6FA0]">Admin Login</Button>
                <Button onClick={() => openLoginModal('customer')} className="bg-black text-white hover:bg-black border-0 px-6 py-2 font-semibold">Sign Up</Button>
                <Button onClick={() => setOpenContact(true)} className="bg-foreground text-background hover:opacity-90 border-0 px-6 py-2 font-semibold">Contact Lab</Button>
              </>
            )}
          </div>

          {/* Mobile menu (full-screen sheet) */}
          <div className="md:hidden flex items-center gap-2">
            <CartSidebar
              trigger={
                <Button variant="outline" size="icon" aria-label="Cart" className="relative">
                  <ShoppingCart className="h-5 w-5" />
                  {items.length > 0 && (
                    <span className="absolute -top-1 -right-1 bg-[#1B2D4F] text-white text-[10px] leading-none px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                      {items.reduce((sum, it) => sum + it.quantity, 0)}
                    </span>
                  )}
                </Button>
              }
            />
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" size="icon" aria-label="Open menu">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="force-light p-0 w-screen max-w-none h-dvh overflow-y-auto">
                <SheetHeader className="sr-only">
                  <SheetTitle>Menu</SheetTitle>
                </SheetHeader>
                <div className="flex flex-col h-full">
                  <div className="p-6 border-b flex items-center gap-3">
                    <Image src="/logo.png" alt="Ascendra Bio" width={140} height={42} className="h-10 w-auto" />
                  </div>
                  <nav className="flex-1 p-6 space-y-2">
                    <Link href="/landing" className={`block px-4 py-4 text-lg rounded-md ${isHome ? "bg-gray-100 font-semibold" : "hover:bg-gray-50"}`}>Home</Link>
                    <Link href="/landing/products" className={`block px-4 py-4 text-lg rounded-md ${isProducts ? "bg-gray-100 font-semibold" : "hover:bg-gray-50"}`}>Products</Link>
                    <Link href="/landing/third-party-testing" className={`block px-4 py-4 text-lg rounded-md ${isThirdPartyTesting ? "bg-gray-100 font-semibold" : "hover:bg-gray-50"}`}>3rd Party Testing</Link>
                    {extraLinks.map((lnk) => {
                      const active = isLinkActive(lnk.href);
                      return (
                        <Link key={`${lnk.title}-${lnk.href}`} href={lnk.href} target={lnk.target} rel={lnk.target === "_blank" ? "noopener noreferrer" : undefined} className={`block px-4 py-4 text-lg rounded-md ${active ? "bg-gray-100 font-semibold" : "hover:bg-gray-50"}`}>{lnk.title}</Link>
                      );
                    })}
                  </nav>
                  <div className="p-6 border-t grid grid-cols-1 gap-3">
                    {isAuthenticated ? (
                      <>
                        {hasRole(["ADMIN", "MANAGER", "STAFF"]) ? (
                          <Link href="/">
                            <Button variant="outline" className="w-full border-gray-300 text-black hover:bg-gray-50 hover:border-[#3A6FA0]">Dashboard</Button>
                          </Link>
                        ) : (
                          <>
                            <Link href="/account">
                              <Button variant="outline" className="w-full border-gray-300 text-black hover:bg-gray-50 hover:border-[#3A6FA0]">My Account</Button>
                            </Link>
                            <Link href="/account/orders">
                              <Button variant="outline" className="w-full border-gray-300 text-black hover:bg-gray-50 hover:border-[#3A6FA0]">My Orders</Button>
                            </Link>
                          </>
                        )}
                        <Button onClick={() => logout()} className="w-full bg-foreground text-background hover:opacity-90">Logout</Button>
                      </>
                    ) : (
                      <>
                        <Button onClick={() => openLoginModal('customer')} variant="outline" className="w-full border-gray-300 text-black hover:bg-gray-50 hover:border-[#3A6FA0]">Login</Button>
                        <Button onClick={() => openLoginModal('admin')} variant="outline" className="w-full border-gray-300 text-black hover:bg-gray-50 hover:border-[#3A6FA0]">Admin Login</Button>
                        <Button onClick={() => openLoginModal('customer')} className="w-full bg-[#3A6FA0] text-white hover:bg-[#1B2D4F]">Sign Up</Button>
                        <button onClick={() => setOpenContact(true)}>
                          <Button className="w-full bg-foreground text-background hover:opacity-90">Contact Lab</Button>
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>

      <Dialog open={openContact} onOpenChange={setOpenContact}>
        <DialogContent className="force-light">
          <DialogHeader>
            <DialogTitle>Contact Lab</DialogTitle>
            <DialogDescription>Send us your Enquiry and we’ll respond shortly.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              placeholder="Your email"
              type="email"
              inputMode="email"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
            />
            <Textarea
              placeholder="Your message"
              rows={5}
              value={contactMessage}
              onChange={(e) => setContactMessage(e.target.value)}
            />
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setOpenContact(false)}>Cancel</Button>
              <Button onClick={handleContactSend} disabled={isSending} className="bg-foreground text-background border-0">
                {isSending ? 'Sending...' : 'Send'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

    </header>
  );
}


