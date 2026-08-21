'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Category } from '@/modules/categories/types/categoryTypes';
import {
  SidebarGroup,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuSkeleton,
} from "@/components/ui/sidebar";
import { Sheet, SheetTrigger, SheetContent, SheetHeader, SheetClose } from "@/components/ui/sheet";
import {
  ChevronUp,
  Menu,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface CategoriesSidePanelProps {
  triggerClassName?: string;
  label?: string;
  hideLabelOnMobile?: boolean;
}

const CategoriesSidePanel: React.FC<CategoriesSidePanelProps> = ({ triggerClassName, label = "الأقسام", hideLabelOnMobile = false }) => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openIds, setOpenIds] = useState<Record<string, boolean>>({});
  const searchParams = useSearchParams();
  const currentCategoryId = searchParams.get('categoryId');

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        // Fetch all categories to ensure tree building works correctly
        const response = await fetch('/api/categories?limit=100');
        if (!response.ok) {
          throw new Error('فشل في جلب الفئات');
        }
        const result = await response.json();
        setCategories(result.data.data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchCategories();
  }, []);

  // Auto-expand parents of selected category
  useEffect(() => {
    if (currentCategoryId && categories.length > 0) {
      const parentIds: string[] = [];
      // Find current by ID or Slug
      let current = categories.find(c => c.id === currentCategoryId || c.slug === currentCategoryId);

      while (current && current.parentId) {
        parentIds.push(current.parentId);
        const parentId = current.parentId;
        current = categories.find(c => c.id === parentId);
      }

      if (parentIds.length > 0) {
        setOpenIds(prev => {
          const next = { ...prev };
          let changed = false;
          parentIds.forEach(id => {
            if (!next[id]) {
              next[id] = true;
              changed = true;
            }
          });
          return changed ? next : prev;
        });
      }
    }
  }, [currentCategoryId, categories]);

  // Type for tree nodes
  type CategoryNode = Category & { children: CategoryNode[] };

  // Helper to check if a node is active
  const isNodeActive = (node: Category) => {
    return node.id === currentCategoryId || node.slug === currentCategoryId;
  };

  // Build nested category tree
  const categoryTree = useMemo(() => {
    const map = new Map<string, CategoryNode>();
    categories.forEach(cat => map.set(cat.id, { ...cat, children: [] } as CategoryNode));
    const tree: CategoryNode[] = [];
    map.forEach(node => {
      if (node.parentId) {
        const parent = map.get(node.parentId);
        if (parent) { parent.children.push(node); }
        else { tree.push(node); }
      } else {
        tree.push(node);
      }
    });
    return tree;
  }, [categories]);

  // Predefined system/featured slugs
  const featuredSlugs = ['hot', 'top-selling', 'recently-added', 'popular'];

  // Split tree into featured and main categories
  const featuredNodes = useMemo(() => {
    return categoryTree.filter(node => featuredSlugs.includes(node.slug));
  }, [categoryTree]);

  const mainTree = useMemo(() => {
    return categoryTree.filter(node => !featuredSlugs.includes(node.slug));
  }, [categoryTree]);

  // Toggle expand/collapse state for nodes
  const toggleNode = (id: string) => {
    setOpenIds(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // Recursive render for nested categories
  const renderTree = (nodes: CategoryNode[]) => (
    <SidebarGroup className="space-y-1 p-0">
      <SidebarMenu>
        {nodes.map(node => (
          <SidebarMenuItem key={node.id}>
            <div className="flex justify-between items-center w-full group">
              <SidebarMenuButton
                asChild
                isActive={isNodeActive(node)}
                className={cn(
                  "transition-all duration-200",
                  isNodeActive(node) && "bg-primary/10 text-primary font-bold border-r-2 border-primary rtl:border-r-0 rtl:border-l-2"
                )}
              >
                <SheetClose asChild>
                  <Link href={`/products?categoryId=${node.id}`} className="flex items-center w-full">
                    <span>{node.name}</span>
                  </Link>
                </SheetClose>
              </SidebarMenuButton>
              {node.children.length > 0 && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => toggleNode(node.id)}
                  className="p-0 h-8 w-8 hover:bg-transparent"
                >
                  <ChevronUp
                    className={cn(
                      "h-4 w-4 transform transition-transform duration-300",
                      openIds[node.id] ? "rotate-0" : "-rotate-180"
                    )}
                  />
                </Button>
              )}
            </div>
            {node.children.length > 0 && openIds[node.id] && (
              <div className="mr-2 border-r rtl:border-l border-muted/50 rtl:border-muted/50 pl-0 mt-1">
                {renderTree(node.children)}
              </div>
            )}
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
    </SidebarGroup>
  );

  const renderContent = () => {
    if (loading) {
      return (
        <SidebarGroup className="space-y-1">
          <SidebarMenu>
            {Array.from({ length: 5 }).map((_, idx) => (
              <SidebarMenuSkeleton key={idx} showIcon className="px-2" />
            ))}
          </SidebarMenu>
        </SidebarGroup>
      );
    }

    if (error) {
      return <div className="p-4 text-destructive">خطأ: {error}</div>;
    }

    return (
      <div className="space-y-6">
        {/* All Products */}
        <SidebarGroup className="p-0">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                isActive={!currentCategoryId}
                className={cn(
                  "transition-all duration-200",
                  !currentCategoryId && "bg-primary/10 text-primary font-bold border-r-2 border-primary rtl:border-r-0 rtl:border-l-2"
                )}
              >
                <SheetClose asChild>
                  <Link href="/products" className="flex items-center w-full">
                    <span>جميع المنتجات</span>
                  </Link>
                </SheetClose>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>

        {/* Featured Categories (Hot, Best Selling, etc.) */}
        {featuredNodes.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2">مميز</h3>
            {renderTree(featuredNodes)}
          </div>
        )}

        {/* Category Tree */}
        <div className="space-y-2">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2">التصنيفات</h3>
          {renderTree(mainTree)}
        </div>
      </div>
    );
  };

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
      <SheetContent side="right" className="flex flex-col h-full p-0 bg-white text-justify-end border-l rtl:border-r rtl:border-l-0">
        <SheetHeader className="p-4 border-b flex-shrink-0 flex flex-row items-center gap-2">
          <h2 className="text-xl font-bold">الفئات</h2>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto p-4 select-none">
          {renderContent()}
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default CategoriesSidePanel;
