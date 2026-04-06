"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import LandingHeader from "@/components/landing/LandingHeader";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  User,
  ShoppingCart,
  Heart,
  FileText,
  LogOut,
  ArrowLeft,
  MessageSquare
} from "lucide-react";

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="landing-theme min-h-screen bg-background text-foreground">
      {/* Full-width storefront header */}
      <LandingHeader />

      <div className="min-h-screen flex flex-col lg:flex-row">
        {/* Sidebar - Fixed width on desktop, collapsible on mobile */}
        <div className="w-full lg:w-80 bg-white border-r border-gray-200 flex-shrink-0">
          <div className="h-full p-4 lg:p-6">
            <AccountSidebar />
          </div>
        </div>

        {/* Main content - Flexible width */}
        <div className="flex-1 bg-gray-50 min-h-screen">
          <div className="h-full p-4 lg:p-6">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

function AccountSidebar() {
  const { user, logout } = useAuth();
  const pathname = usePathname();

  const navItems = [
    {
      title: "Profile",
      href: "/account",
      icon: User,
      exact: true
    },
    {
      title: "Orders",
      href: "/account/orders",
      icon: ShoppingCart
    },
    {
      title: "Favorites",
      href: "/account/favorites",
      icon: Heart
    },
    {
      title: "Bulk Quotes",
      href: "/account/bulk-quotes",
      icon: FileText
    },
  ];

  return (
    <div className="space-y-6">
      {/* User Profile Section */}
      <div className="flex items-center space-x-3">
        <div className="w-12 h-12 bg-primary rounded-full flex items-center justify-center text-primary-foreground font-semibold text-lg">
          {user?.firstName?.charAt(0) || user?.email?.charAt(0) || "U"}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-lg truncate">{user?.firstName} {user?.lastName}</h3>
          <p className="text-sm text-muted-foreground truncate">{user?.email}</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="space-y-1">
        {navItems.map((item) => {
          const isActive = item.exact ? pathname === item.href : pathname.startsWith(item.href);
          return (
            <Link key={item.href} href={item.href} aria-current={isActive ? "page" : undefined}>
              <Button
                variant={isActive ? "secondary" : "ghost"}
                className={`w-full justify-start h-12 text-left ${isActive ? "bg-primary text-primary-foreground" : "hover:bg-gray-100"}`}
                size="lg"
              >
                <item.icon className="w-5 h-5 mr-3 flex-shrink-0" />
                <span className="truncate">{item.title}</span>
              </Button>
            </Link>
          );
        })}
      </nav>

      {/* Bottom Actions */}
      <div className="pt-6 border-t border-gray-200 space-y-2">
        <Link href="/landing">
          <Button variant="ghost" className="w-full justify-start h-12 text-left hover:bg-gray-100" size="lg">
            <ArrowLeft className="w-5 h-5 mr-3 flex-shrink-0" />
            <span className="truncate">Back to Store</span>
          </Button>
        </Link>
        <Button
          variant="ghost"
          className="w-full justify-start h-12 text-left text-red-600 hover:text-red-700 hover:bg-red-50"
          size="lg"
          onClick={() => logout()}
        >
          <LogOut className="w-5 h-5 mr-3 flex-shrink-0" />
          <span className="truncate">Sign Out</span>
        </Button>
      </div>
    </div>
  );
}


