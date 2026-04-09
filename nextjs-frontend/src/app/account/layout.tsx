"use client";

import Link from "next/link";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { usePathname } from "next/navigation";
import { Barlow } from "next/font/google";
import { cn } from "@/lib/utils";
import {
  User,
  ShoppingCart,
  Heart,
  FileText,
  LogOut,
  ArrowLeft,
  MessageSquare
} from "lucide-react";

const barlow = Barlow({ subsets: ["latin"], weight: ["400", "500", "600", "700", "800", "900"] });

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="landing-theme min-h-screen bg-background text-foreground">
      <div className="min-h-screen flex flex-col lg:flex-row">
        {/* Sidebar - Fixed width on desktop, collapsible on mobile */}
        <div className="w-full lg:w-80 bg-white border-r border-gray-200 flex-shrink-0">
          <div className={`h-full p-4 lg:p-8 space-y-8 ${barlow.className}`}>
            <AccountSidebar />
          </div>
        </div>

        {/* Main content - Flexible width */}
        <div className="flex-1 bg-[#F8F9FA] min-h-screen">
          <div className="h-full p-6 lg:p-10 max-w-7xl mx-auto">
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
    <div className="space-y-8">
      {/* User Profile Section */}
      <div className="flex items-center space-x-4 p-2">
        <div className="w-14 h-14 bg-[#1B2D4F] rounded-2xl flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-[#1B2D4F]/20">
          {user?.firstName?.charAt(0) || user?.email?.charAt(0) || "U"}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-bold text-xl text-[#0B1215] truncate">{user?.firstName} {user?.lastName}</h3>
          <p className="text-sm text-muted-foreground truncate">{user?.email}</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="space-y-2">
        {navItems.map((item) => {
          const isActive = item.exact ? pathname === item.href : pathname.startsWith(item.href);
          return (
            <Link key={item.href} href={item.href} aria-current={isActive ? "page" : undefined}>
              <Button
                variant={isActive ? "secondary" : "ghost"}
                className={cn(
                  "w-full justify-start h-12 text-left rounded-2xl px-4 transition-all duration-300",
                  isActive 
                    ? "bg-[#3A6FA0] text-white shadow-lg shadow-[#3A6FA0]/20 scale-[1.02] hover:bg-[#3A6FA0]/90" 
                    : "text-muted-foreground hover:bg-gray-100 hover:text-[#1B2D4F]"
                )}
                size="lg"
              >
                <item.icon className={cn(
                  "w-5 h-5 mr-3 flex-shrink-0",
                  isActive ? "text-white" : "text-[#3A6FA0]/70"
                )} />
                <span className="font-semibold tracking-wide">{item.title}</span>
              </Button>
            </Link>
          );
        })}
      </nav>

      {/* Bottom Actions */}
      <div className="pt-6 border-t border-gray-100 space-y-3">
        <Link href="/landing">
          <Button variant="ghost" className="w-full justify-start h-12 text-left rounded-2xl hover:bg-gray-100 text-muted-foreground hover:text-[#1B2D4F]" size="lg">
            <ArrowLeft className="w-5 h-5 mr-3 flex-shrink-0 text-[#3A6FA0]/70" />
            <span className="font-semibold">Back to Store</span>
          </Button>
        </Link>
        <Button
          variant="ghost"
          className="w-full justify-start h-12 text-left text-red-500 hover:text-red-600 hover:bg-red-50 rounded-2xl"
          size="lg"
          onClick={() => logout()}
        >
          <LogOut className="w-5 h-5 mr-3 flex-shrink-0" />
          <span className="font-semibold">Sign Out</span>
        </Button>
      </div>
    </div>
  );
}


