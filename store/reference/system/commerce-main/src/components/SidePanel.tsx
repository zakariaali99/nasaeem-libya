'use client'

import React from "react";
import {
  Users,
  Package,
  ClipboardList,
  Palette,
  Home,
  Library,
  Layers, // for categories
  Truck, // for delivery methods
  MapPin, // for cities
  Boxes, // for inventory
  CreditCard,
  Percent, // for discounts
  Repeat,
  Menu,
  Ticket, // for vouchers
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  SidebarGroup,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from "@/components/ui/sidebar";
import { Sheet, SheetTrigger, SheetContent, SheetHeader, SheetClose } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

interface SidePanelProps {
  triggerClassName?: string;
  label?: string;
  hideLabelOnMobile?: boolean;
}

const SidePanel: React.FC<SidePanelProps> = ({ triggerClassName, label = "لوحة التحكم", hideLabelOnMobile = false }) => {

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          className={cn("flex items-center gap-2 px-3 py-2", triggerClassName)}
          aria-label={label}
        >
          <Menu className="h-5 w-5" />
          <span className={cn("text-sm font-semibold", hideLabelOnMobile ? "hidden md:inline" : "")}>{label}</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="border-l rtl:border-r rtl:border-l-0 bg-white text-justify-end">
        <SheetHeader className="p-4 border-b flex items-center justify-between">
          <h2 className="text-xl font-bold">لوحة التحكم</h2>
        </SheetHeader>
        <div className="px-2 py-4">
          <SidebarGroup className="space-y-1">
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <SheetClose asChild>
                    <Link href="/admin" className="flex items-center">
                      <Home className="h-5 w-5 ml-2" />
                      <span>الرئيسية</span>
                    </Link>
                  </SheetClose>
                </SidebarMenuButton>
              </SidebarMenuItem>

              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <SheetClose asChild>
                    <Link href="/admin/users" className="flex items-center">
                      <Users className="h-5 w-5 ml-2" />
                      <span>المستخدمين</span>
                    </Link>
                  </SheetClose>
                </SidebarMenuButton>
              </SidebarMenuItem>

              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <SheetClose asChild>
                    <Link href="/admin/products" className="flex items-center">
                      <Package className="h-5 w-5 ml-2" />
                      <span>المنتجات</span>
                    </Link>
                  </SheetClose>
                </SidebarMenuButton>
              </SidebarMenuItem>

              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <SheetClose asChild>
                    <Link href="/admin/categories" className="flex items-center">
                      <Layers className="h-5 w-5 ml-2" />
                      <span>الفئات</span>
                    </Link>
                  </SheetClose>
                </SidebarMenuButton>
              </SidebarMenuItem>

              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <SheetClose asChild>
                    <Link href="/admin/collections" className="flex items-center">
                      <Library className="h-5 w-5 ml-2" />
                      <span>المجموعات</span>
                    </Link>
                  </SheetClose>
                </SidebarMenuButton>
              </SidebarMenuItem>

              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <SheetClose asChild>
                    <Link href="/admin/orders" className="flex items-center">
                      <ClipboardList className="h-5 w-5 ml-2" />
                      <span>الطلبات</span>
                    </Link>
                  </SheetClose>
                </SidebarMenuButton>
              </SidebarMenuItem>

              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <SheetClose asChild>
                    <Link href="/admin/delivery" className="flex items-center">
                      <Truck className="h-5 w-5 ml-2" />
                      <span>طرق التوصيل</span>
                    </Link>
                  </SheetClose>
                </SidebarMenuButton>
              </SidebarMenuItem>

              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <SheetClose asChild>
                    <Link href="/admin/payment_methods" className="flex items-center">
                      <CreditCard className="h-5 w-5 ml-2" />
                      <span>طرق الدفع</span>
                    </Link>
                  </SheetClose>
                </SidebarMenuButton>
              </SidebarMenuItem>

              {/* Discounts menu item */}
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <SheetClose asChild>
                    <Link href="/admin/discounts" className="flex items-center">
                      <Percent className="h-5 w-5 ml-2" />
                      <span>الخصومات</span>
                    </Link>
                  </SheetClose>
                </SidebarMenuButton>
              </SidebarMenuItem>

              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <SheetClose asChild>
                    <Link href="/admin/cities" className="flex items-center">
                      <MapPin className="h-5 w-5 ml-2" />
                      <span>المدن والمناطق</span>
                    </Link>
                  </SheetClose>
                </SidebarMenuButton>
              </SidebarMenuItem>

              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <SheetClose asChild>
                    <Link href="/admin/vouchers" className="flex items-center">
                      <Ticket className="h-5 w-5 ml-2" />
                      <span>القسائم (Vouchers)</span>
                    </Link>
                  </SheetClose>
                </SidebarMenuButton>
              </SidebarMenuItem>

              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <SheetClose asChild>
                    <Link href="/admin/inventory" className="flex items-center">
                      <Boxes className="h-5 w-5 ml-2" />
                      <span>المخزون</span>
                    </Link>
                  </SheetClose>
                </SidebarMenuButton>
              </SidebarMenuItem>

              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <SheetClose asChild>
                    <Link href="/admin/customization" className="flex items-center">
                      <Palette className="h-5 w-5 ml-2" />
                      <span>تخصيص الصفحة الرئيسية</span>
                    </Link>
                  </SheetClose>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroup>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default SidePanel;
