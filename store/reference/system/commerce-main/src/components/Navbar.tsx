"use client";

import React from "react";
import { LayoutGrid, ShoppingCart, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { SidebarProvider } from "@/components/ui/sidebar";
import CategoriesSidePanel from "./CategoriesSidePanel";
import SidePanel from "@/components/SidePanel";
import { useCart } from "@/hooks/use-cart";
import Link from "next/link";
import Image from "next/image";
import SearchButton from "@/components/SearchButton";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useAppSession } from "@/components/providers/SessionProvider";

interface NavbarProps {
  children?: React.ReactNode;
}

type NavItem = {
  key: string;
  label: string;
  href?: string;
  icon: React.ComponentType<{ className?: string }>;
  type?: "categories" | "admin";
  badge?: number;
};

const Navbar: React.FC<NavbarProps> = ({
  children,
}) => {
  const { session } = useAppSession();
  const [isMounted, setIsMounted] = React.useState(false);

  React.useEffect(() => {
    setIsMounted(true);
  }, []);

  const user = isMounted ? session?.user : null;
  const isAdmin = user?.role === "admin";
  const cart = useCart();
  const pathname = usePathname();
  const isHomePage = pathname === "/";
  // احسب إجمالي الكميات بدلاً من عدد الأسطر فقط ليتفاعل الرقم مع الزيادة/النقصان
  const cartItemCount = React.useMemo(() => {
    if (!cart || !Array.isArray(cart.items)) return 0;
    return cart.items.reduce((sum, item) => sum + (item.quantity || 0), 0);
  }, [cart?.items]);

  const navItems = React.useMemo<NavItem[]>(() => ([
    isAdmin
      ? { key: "admin", label: "لوحة التحكم", type: "admin", icon: LayoutGrid }
      : { key: "categories", label: "الأقسام", type: "categories", icon: LayoutGrid },
    { key: "account", label: user ? "حسابي" : "تسجيل", href: user ? "/me" : "/register", icon: User },
    { key: "cart", label: "السلة", href: "/cart", icon: ShoppingCart, badge: cartItemCount },
  ]), [isAdmin, user, cartItemCount]);

  const isActiveLink = (href?: string) => {
    if (!href) return false;
    if (href === "/") return pathname === "/";
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  const navButtonClass = (active: boolean) => cn(
    "relative flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold border border-transparent transition-colors",
    active
      ? "bg-[#ecfdf3] text-[#16a34a] border-[#bbf7d0] shadow-sm"
      : "text-slate-700 hover:bg-slate-50"
  );

  const iconClass = (active: boolean) => cn("h-5 w-5", active ? "text-[#16a34a]" : "text-slate-600");

  const bubbleClass = "h-14 w-14 rounded-full border border-slate-200 bg-white shadow-[0_12px_30px_rgba(0,0,0,0.08)] hover:bg-slate-50 flex items-center justify-center";

  return (
    <SidebarProvider defaultOpen={false}>
      <div className="relative flex min-h-screen w-full flex-col" dir="rtl">
        <div className="px-4 pt-4">
          <div className="pointer-events-none fixed inset-x-0 bottom-4 z-30 flex justify-center px-4 md:top-4 md:bottom-auto md:px-0">
            <div className="pointer-events-auto flex w-full max-w-5xl items-center gap-3 justify-between">
              <Link
                href="/"
                aria-label="الانتقال للرئيسية"
                className={cn(bubbleClass, "overflow-hidden")}
              >
                <Image
                  src="/logo.svg"
                  alt="Logo"
                  width={34}
                  height={34}
                  className="object-contain"
                />
              </Link>

              <div className="flex items-center gap-1 rounded-full border border-slate-200 bg-white px-1 py-1 shadow-[0_12px_30px_rgba(0,0,0,0.08)]">
                {navItems.map((item) => {
                  const Icon = item.icon;

                  if (item.type === "categories") {
                    return (
                      <React.Suspense key={item.key} fallback={null}>
                        <CategoriesSidePanel
                          label={item.label}
                          triggerClassName={navButtonClass(false)}
                          hideLabelOnMobile
                        />
                      </React.Suspense>
                    );
                  }

                  if (item.type === "admin") {
                    return (
                      <SidePanel
                        key={item.key}
                        label={item.label}
                        triggerClassName={navButtonClass(false)}
                        hideLabelOnMobile
                      />
                    );
                  }

                  const active = isActiveLink(item.href);

                  return (
                    <Link
                      key={item.key}
                      href={item.href ?? "#"}
                      className={navButtonClass(active)}
                      aria-label={item.label}
                      aria-current={active ? "page" : undefined}
                    >
                      <Icon className={iconClass(active)} />
                      <span className="text-sm font-semibold hidden md:inline">{item.label}</span>
                      {item.badge ? (
                        <Badge
                          aria-live="polite"
                          className="absolute -top-1 -left-1 h-5 min-w-[1.25rem] px-1 flex items-center justify-center rounded-full bg-red-500 text-white"
                        >
                          {item.badge}
                        </Badge>
                      ) : null}
                    </Link>
                  );
                })}
              </div>

              <SearchButton
                iconOnly
                buttonClassName={cn(bubbleClass)}
              />
            </div>
          </div>
        </div>

        <main
          className={cn(
            "flex-1 w-full px-4 pb-36 pt-0 md:pb-12 md:pt-0",
            !isHomePage && "pt-8 md:pt-28",
          )}
        >
          {children}
        </main>
      </div>
    </SidebarProvider>
  );
};

export default Navbar;
