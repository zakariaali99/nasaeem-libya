"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { toast } from "sonner";
import { PlusCircle, Edit, Trash2, ChevronsUpDown, Search, ChevronRight, ChevronDown, CornerDownRight } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"; // Added Collapsible
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Category,
  CreateCategoryInput,
  UpdateCategoryInput,
  PaginatedCategoriesResult,
  createCategorySchema,
  updateCategorySchema,
  Product as ProductCategoryProduct, // Renamed to avoid conflict if a local Product type is defined
} from "@/modules/categories/types/categoryTypes";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, Controller } from "react-hook-form";
import { useDebounce } from "@/hooks/use-debounce";
import { Badge } from "@/components/ui/badge";
import { GripVertical } from "lucide-react";

// API functions
async function fetchCategories(page: number, limit: number, search?: string): Promise<PaginatedCategoriesResult> {
  const queryParams = new URLSearchParams({
    page: page.toString(),
    limit: limit.toString(),
  });
  if (search) {
    queryParams.append("search", search);
  }
  const res = await fetch(`/api/categories?${queryParams.toString()}`);
  if (!res.ok) {
    const errorData = await res.json();
    throw new Error(errorData.message || "فشل في جلب الفئات");
  }
  const responseJson = await res.json();
  return responseJson.data;
}

async function fetchAllCategoriesForTree(): Promise<Category[]> {
  // This endpoint should ideally return all categories without pagination
  // and include their products as per the updated service.
  const res = await fetch(`/api/categories?limit=9999`);
  if (!res.ok) {
    const errorData = await res.json();
    throw new Error(errorData.message || "فشل في جلب كل الفئات للشجرة");
  }
  const responseJson = await res.json();
  // Assuming the API returns { message: "...", data: { data: [], total: ..., ... } }
  // And if it's just { message: "...", data: [] } for a direct array, adjust accordingly
  if (responseJson.data && Array.isArray(responseJson.data.data)) {
    return responseJson.data.data;
  } else if (Array.isArray(responseJson.data)) { // Fallback if data is directly an array
    return responseJson.data;
  }
  console.warn("Unexpected structure for all categories:", responseJson);
  return [];
}

async function createCategory(data: CreateCategoryInput): Promise<Category> {
  const res = await fetch("/api/categories", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const errorData = await res.json();
    throw new Error(errorData.message || "فشل في إنشاء الفئة");
  }
  const responseJson = await res.json();
  return responseJson.data;
}

async function updateCategory(id: string, data: UpdateCategoryInput): Promise<Category> {
  const res = await fetch(`/api/categories/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const errorData = await res.json();
    throw new Error(errorData.message || "فشل في تحديث الفئة");
  }
  const responseJson = await res.json();
  return responseJson.data;
}

async function deleteCategory(id: string): Promise<void> {
  const res = await fetch(`/api/categories/${id}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    if (res.status === 204) return; // No content is a success for delete
    const errorData = await res.json();
    throw new Error(errorData.message || "فشل في حذف الفئة");
  }
}

// API functions for product assignment
async function assignProductToCategoryAPI(categoryId: string, productId: string): Promise<void> {
  const res = await fetch(`/api/categories/${categoryId}/products`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ productId }),
  });
  if (!res.ok) {
    const errorData = await res.json();
    throw new Error(errorData.message || "فشل في تعيين المنتج للفئة");
  }
}

async function removeProductFromCategoryAPI(categoryId: string, productId: string): Promise<void> {
  const res = await fetch(`/api/categories/${categoryId}/products/${productId}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    if (res.status === 204) return; // No content is a success for delete
    const errorData = await res.json();
    throw new Error(errorData.message || "فشل في إزالة المنتج من الفئة");
  }
}

// Assume an API to fetch all products (simplified version)
// You\'ll need a proper paginated API for products in a real app
interface Product {
  id: string;
  name: string;
  // Add other relevant product fields
}
async function fetchAllProducts(): Promise<Product[]> {
  // Replace with your actual API endpoint for fetching all products
  const res = await fetch("/api/products?limit=9999"); // Example endpoint
  if (!res.ok) {
    const errorData = await res.json();
    throw new Error(errorData.message || "فشل في جلب المنتجات");
  }
  const responseJson = await res.json();
  if (responseJson.data && Array.isArray(responseJson.data.data)) {
    return responseJson.data.data;
  } else if (Array.isArray(responseJson.data)) {
    return responseJson.data;
  }
  return [];
}

// Helper function to build the category tree
interface CategoryTreeNode extends Category {
  children: CategoryTreeNode[];
}

function buildCategoryTree(categories: Category[], parentId: string | null = null): CategoryTreeNode[] {
  if (!categories) return [];
  return categories
    .filter(category => category.parentId === parentId)
    .map(category => ({
      ...category,
      children: buildCategoryTree(categories, category.id)
    }));
}

const DEFAULT_PAGE = 1; // Will be less relevant for tree view
const DEFAULT_LIMIT = 1000; // Fetch more for client-side tree building / filtering

// CategoryNode component moved outside to prevent remounting and state reset on parent render
const CategoryNode: React.FC<{
  node: CategoryTreeNode;
  level: number;
  onEdit: (category: Category) => void;
  onDelete: (category: Category) => void;
  onAddSubcategory: (parentId: string) => void;
  allProducts: Product[] | undefined;
  isLoadingAllProducts: boolean;
  assignProductMutation: any;
  removeProductMutation: any;
}> = ({ node, level, onEdit, onDelete, onAddSubcategory, allProducts, isLoadingAllProducts, assignProductMutation, removeProductMutation }) => {
  const [isOpen, setIsOpen] = useState(false);
  const hasChildren = node.children && node.children.length > 0;
  const hasProducts = node.products && node.products.length > 0;
  const isActuallyCollapsible = hasChildren || hasProducts;

  const indentUnit = 20;

  // State for inline product search
  const [productSearch, setProductSearch] = useState("");
  const [isProductSearchFocused, setIsProductSearchFocused] = useState(false);

  const availableProductsToAdd = useMemo(() => {
    if (!allProducts) return [];
    const assignedProductIds = new Set(node.products?.map(p => p.id) || []);
    return allProducts
      .filter(p => !assignedProductIds.has(p.id))
      .filter(p => p.name.toLowerCase().includes(productSearch.toLowerCase()));
  }, [allProducts, node.products, productSearch]);

  return (
    <div
      className="w-full relative"
      style={{ paddingRight: `${level * 20}px` }}
    >
      <Collapsible open={isOpen} onOpenChange={setIsOpen} className="mb-2 border rounded-md bg-card">
        <CollapsibleTrigger asChild>
          <div className="flex items-center justify-between p-3 hover:bg-muted/50 cursor-pointer" onClick={() => setIsOpen(!isOpen)} style={{ paddingRight: `${level * indentUnit}px` }}>
            <div className="flex items-center gap-2">
              <span className="font-medium text-sm mr-2">{node.name}</span>
              {node.slug && <Badge variant="outline" className="text-xs">{node.slug}</Badge>}
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); onAddSubcategory(node.id); }} aria-label="إضافة فئة فرعية">
                <PlusCircle className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); onEdit(node); }} aria-label="تعديل الفئة">
                <Edit className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); onDelete(node); }} aria-label="حذف الفئة">
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
              <Button variant="ghost" size="icon" aria-label="تبديل التفاصيل" onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }}>
                <ChevronDown className={`h-5 w-5 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
              </Button>
            </div>
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent className="p-0">
          <div className="border-t p-4" style={{ paddingRight: `${level * indentUnit}px` }}>
            {node.children && node.children.map(childNode => (
              <CategoryNode
                key={childNode.id}
                node={childNode}
                level={level + 1}
                onEdit={onEdit}
                onDelete={onDelete}
                onAddSubcategory={onAddSubcategory}
                allProducts={allProducts}
                isLoadingAllProducts={isLoadingAllProducts}
                assignProductMutation={assignProductMutation}
                removeProductMutation={removeProductMutation}
              />
            ))}

            {node.products && node.products.length > 0 && (
              <div className="relative" style={{ paddingRight: `${indentUnit}px` }}>
                <ul className="list-none mt-1 mb-1 pl-1">
                  {node.products.map((product: ProductCategoryProduct) => (
                    <li key={product.id} className="text-xs text-muted-foreground py-0.5 flex justify-between items-center" style={{ minHeight: '1.75rem' }}>
                      <span>{product.name} <span className="text-xs">({product.slug})</span></span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="p-0.5 h-auto text-destructive hover:text-destructive"
                        title="إزالة المنتج"
                        onClick={() => removeProductMutation.mutate({ categoryId: node.id, productId: product.id })}
                        disabled={removeProductMutation.isPending && removeProductMutation.variables?.productId === product.id}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {/* Inline Product Add Section */}
            <div className="relative mt-2" style={{ paddingRight: `${indentUnit}px` }}>
              <Input
                type="text"
                placeholder="إضافة منتج..."
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                onFocus={() => setIsProductSearchFocused(true)}
                onBlur={() => setTimeout(() => setIsProductSearchFocused(false), 150)}
                className="text-xs h-8"
              />
              {isProductSearchFocused && availableProductsToAdd.length > 0 && (
                <div className="absolute z-10 w-full bg-background border border-border rounded-md shadow-lg mt-1 max-h-48 overflow-y-auto">
                  {availableProductsToAdd.map(product => (
                    <div
                      key={product.id}
                      className="p-2 text-xs hover:bg-muted cursor-pointer"
                      onMouseDown={() => {
                        assignProductMutation.mutate({ categoryId: node.id, productId: product.id });
                        setProductSearch("");
                        setIsProductSearchFocused(false);
                      }}
                    >
                      {product.name}
                    </div>
                  ))}
                </div>
              )}
              {isProductSearchFocused && productSearch && availableProductsToAdd.length === 0 && !isLoadingAllProducts && (
                <div className="absolute z-10 w-full bg-background border border-border rounded-md shadow-lg mt-1 p-2 text-xs text-muted-foreground">
                  لا توجد منتجات مطابقة أو جميعها مضافة بالفعل.
                </div>
              )}
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
};

export default function CategoriesPage() {
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [editingParentId, setEditingParentId] = useState<string | null | undefined>(null);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState<Category | null>(null);

  // Removed: showManageProductsModal, categoryForProductManagement

  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearchTerm = useDebounce(searchTerm, 500);

  const { data: allCategoriesFlat, isLoading: isLoadingAllCategories, error: errorAllCategories } = useQuery<Category[], Error>({
    queryKey: ["allCategoriesForTree"],
    queryFn: fetchAllCategoriesForTree,
  });

  const { data: allProducts, isLoading: isLoadingAllProducts } = useQuery<Product[], Error>({
    queryKey: ["allProductsForAssignment"],
    queryFn: fetchAllProducts,
    // Enabled if categories are loaded, as it might be needed by any category node
    enabled: !!allCategoriesFlat && !isLoadingAllCategories,
  });

  const { control, register, handleSubmit, formState: { errors }, setValue, reset } = useForm<CreateCategoryInput | UpdateCategoryInput>({
    resolver: zodResolver(modalMode === 'create' ? createCategorySchema : updateCategorySchema),
    defaultValues: {
      name: "",
      slug: "",
      description: "",
      parentId: null,
    }
  });

  useEffect(() => {
    // When the modal opens or its mode/data changes, reset the form.
    // The key on the <form> element ensures it's a fresh instance,
    // and this effect then sets the correct initial values.
    if (isModalOpen) { // Only act if modal is open
      if (modalMode === 'edit' && selectedCategory) {
        reset({
          name: selectedCategory.name,
          slug: selectedCategory.slug || "",
          description: selectedCategory.description || "",
          parentId: selectedCategory.parentId || null,
        });
      } else if (modalMode === 'create') {
        reset({ name: "", slug: "", description: "", parentId: editingParentId || null });
      }
    }
  }, [isModalOpen, modalMode, selectedCategory, editingParentId, reset]); // Removed setValue from deps


  const createMutation = useMutation<Category, Error, CreateCategoryInput>({
    mutationFn: createCategory,
    onSuccess: () => {
      toast.success("تم إنشاء الفئة بنجاح");
      queryClient.invalidateQueries({ queryKey: ["allCategoriesForTree"] });
      setIsModalOpen(false);
      reset();
      setEditingParentId(undefined);
    },
    onError: (error) => {
      toast.error(error.message || "حدث خطأ أثناء إنشاء الفئة");
    },
  });

  const updateMutation = useMutation<Category, Error, { id: string; data: UpdateCategoryInput }>({
    mutationFn: ({ id, data }) => updateCategory(id, data),
    onSuccess: () => {
      toast.success("تم تحديث الفئة بنجاح");
      queryClient.invalidateQueries({ queryKey: ["allCategoriesForTree"] });
      setIsModalOpen(false);
      reset();
      setSelectedCategory(null);
    },
    onError: (error) => {
      toast.error(error.message || "حدث خطأ أثناء تحديث الفئة");
    },
  });

  const deleteMutation = useMutation<void, Error, string>({
    mutationFn: deleteCategory,
    onSuccess: () => {
      toast.success("تم حذف الفئة بنجاح");
      queryClient.invalidateQueries({ queryKey: ["allCategoriesForTree"] });
      setShowDeleteConfirm(false);
      setCategoryToDelete(null);
    },
    onError: (error) => {
      toast.error(error.message || "حدث خطأ أثناء حذف الفئة");
      setShowDeleteConfirm(false);
      setCategoryToDelete(null);
    },
  });

  const assignProductMutation = useMutation<void, Error, { categoryId: string; productId: string }>({
    mutationFn: ({ categoryId, productId }) => assignProductToCategoryAPI(categoryId, productId),
    onSuccess: (_, variables) => {
      toast.success("تم تعيين المنتج بنجاح");
      queryClient.invalidateQueries({ queryKey: ["allCategoriesForTree"] });
    },
    onError: (error) => {
      toast.error(error.message || "خطأ في تعيين المنتج");
    },
  });

  const removeProductMutation = useMutation<void, Error, { categoryId: string; productId: string }>({
    mutationFn: ({ categoryId, productId }) => removeProductFromCategoryAPI(categoryId, productId),
    onSuccess: (_, variables) => {
      toast.success("تمت إزالة المنتج بنجاح");
      queryClient.invalidateQueries({ queryKey: ["allCategoriesForTree"] });
    },
    onError: (error) => {
      toast.error(error.message || "خطأ في إزالة المنتج");
    },
  });

  const handleOpenCreateModal = (parentId: string | null = null) => {
    setModalMode("create");
    setSelectedCategory(null);
    setEditingParentId(parentId); // Set parentId for subcategory creation
    reset({ name: "", slug: "", description: "", parentId: parentId });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (category: Category) => {
    setModalMode("edit");
    setSelectedCategory(category);
    setEditingParentId(undefined); // Not adding a subcategory
    setIsModalOpen(true);
  };

  const handleOpenDeleteConfirm = (category: Category) => {
    setCategoryToDelete(category);
    setShowDeleteConfirm(true);
  };

  const onSubmit = (data: CreateCategoryInput | UpdateCategoryInput) => {
    const submissionData = { ...data };
    if (submissionData.parentId === "" || submissionData.parentId === "none") {
      submissionData.parentId = null;
    }
    if (submissionData.slug === "") {
      delete submissionData.slug;
    }

    if (modalMode === "create") {
      createMutation.mutate(submissionData as CreateCategoryInput);
    } else if (selectedCategory) {
      updateMutation.mutate({ id: selectedCategory.id, data: submissionData as UpdateCategoryInput });
    }
  };

  const filteredCategories = useMemo(() => {
    if (!allCategoriesFlat) return [];
    if (!debouncedSearchTerm) return allCategoriesFlat;

    const lowerSearchTerm = debouncedSearchTerm.toLowerCase();
    const searchFiltered: Category[] = [];
    const categoriesToSearch = [...allCategoriesFlat];
    const addedIds = new Set<string>();

    // Function to recursively add a category and its parents
    const addCategoryWithParents = (catId: string | null) => {
      if (!catId || addedIds.has(catId)) return;
      const category = allCategoriesFlat.find(c => c.id === catId);
      if (category) {
        if (!addedIds.has(category.id)) {
          searchFiltered.push(category);
          addedIds.add(category.id);
        }
        if (category.parentId) {
          addCategoryWithParents(category.parentId);
        }
      }
    };

    allCategoriesFlat.forEach(category => {
      if (category.name.toLowerCase().includes(lowerSearchTerm) ||
        (category.slug && category.slug.toLowerCase().includes(lowerSearchTerm))) {
        addCategoryWithParents(category.id);
      }
    });
    return searchFiltered;
  }, [allCategoriesFlat, debouncedSearchTerm]);

  const categoryTree = useMemo(() => buildCategoryTree(filteredCategories), [filteredCategories]);

  const parentCategoryOptions = useMemo(() => {
    if (!allCategoriesFlat) return [];
    if (modalMode === 'edit' && selectedCategory) {
      // Prevent selecting itself or its descendants as parent
      const descendantIds = new Set<string>();
      const getDescendants = (catId: string) => {
        descendantIds.add(catId);
        allCategoriesFlat.filter(c => c.parentId === catId).forEach(child => getDescendants(child.id));
      };
      getDescendants(selectedCategory.id);
      return allCategoriesFlat.filter(cat => !descendantIds.has(cat.id));
    }
    return allCategoriesFlat;
  }, [allCategoriesFlat, modalMode, selectedCategory]);


  if (isLoadingAllCategories) return <div dir="rtl" className="container mx-auto p-4">جار التحميل...</div>;
  if (errorAllCategories) return <div dir="rtl" className="container mx-auto p-4\">خطأ: {errorAllCategories.message}</div>;



  return (
    <div dir="rtl" className="container mx-auto p-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">إدارة الفئات</CardTitle>
          <div className="flex justify-between items-center pt-4">
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="بحث باسم الفئة أو المعرف..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button onClick={() => handleOpenCreateModal(null)}>
              <PlusCircle className="ml-2 h-4 w-4" />
              إضافة فئة رئيسية
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {categoryTree.length > 0 ? (
            categoryTree.map(node => (
              <CategoryNode
                key={node.id}
                node={node}
                level={0}
                onEdit={handleOpenEditModal}
                onDelete={handleOpenDeleteConfirm}
                onAddSubcategory={handleOpenCreateModal}
                allProducts={allProducts} // Pass down
                isLoadingAllProducts={isLoadingAllProducts} // Pass down
                assignProductMutation={assignProductMutation} // Pass down
                removeProductMutation={removeProductMutation} // Pass down
              />
            ))
          ) : (
            <p className="text-center py-4">
              {debouncedSearchTerm ? "لم يتم العثور على فئات تطابق بحثك." : "لا توجد فئات لعرضها. قم بإضافة فئة رئيسية."}
            </p>
          )}
        </CardContent>
        {/* Footer can be removed or repurposed if pagination is no longer primary */}
        <CardFooter className="flex justify-center items-center border-t pt-4">
          <p className="text-sm text-muted-foreground">
            إجمالي الفئات المعروضة (بعد الفلترة): {filteredCategories.length} / الإجمالي الكلي: {allCategoriesFlat?.length || 0}
          </p>
        </CardFooter>
      </Card>

      {/* Create/Edit Modal (Dialog component) - largely the same, ensure parentId select uses `parentCategoryOptions` */}
      <Dialog open={isModalOpen} onOpenChange={(isOpen) => {
        setIsModalOpen(isOpen);
        if (!isOpen) setEditingParentId(undefined); // Reset editingParentId when dialog closes
      }}>
        <DialogContent className="sm:max-w-[500px]" dir="rtl">
          <DialogHeader>
            <DialogTitle>{modalMode === "create" ? (editingParentId ? "إنشاء فئة فرعية جديدة" : "إنشاء فئة رئيسية جديدة") : "تعديل الفئة"}</DialogTitle>
            <DialogDescription>
              {modalMode === "create" ? (editingParentId ? "إنشاء فئة فرعية جديدة" : "إنشاء فئة رئيسية جديدة") : "تعديل الفئة"}
            </DialogDescription>
          </DialogHeader>
          <form key={`${modalMode}-${selectedCategory?.id || editingParentId || 'new'}`} onSubmit={handleSubmit(onSubmit)}>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="name" className="text-right col-span-1">الاسم*</Label>
                <Controller
                  name="name"
                  control={control}
                  render={({ field }) => (
                    <Input
                      id="name"
                      {...field}
                      className={`col-span-3 ${errors.name ? "border-red-500" : ""}`}
                    />
                  )}
                />
                {errors.name && <p className="col-span-4 text-red-500 text-xs">{errors.name.message}</p>}
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="slug" className="text-right col-span-1\\">المعرف (Slug)</Label>
                <Controller
                  name="slug"
                  control={control}
                  render={({ field }) => (
                    <Input
                      id="slug"
                      {...field}
                      className={`col-span-3 ${errors.slug ? "border-red-500" : ""}`}
                      placeholder="يتم إنشاؤه تلقائيًا إذا ترك فارغًا"
                    />
                  )}
                />
                {errors.slug && <p className="col-span-4 text-red-500 text-xs">{errors.slug.message}</p>}
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="description" className="text-right col-span-1\">الوصف</Label>
                <Textarea id="description" {...register("description")} className={`col-span-3 ${errors.description ? "border-red-500" : ""}`} />
                {errors.description && <p className="col-span-4 text-red-500 text-xs\">{errors.description.message}</p>}
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="parentId" className="text-right col-span-1\">الفئة الأصل</Label>
                <Controller
                  name="parentId"
                  control={control}
                  defaultValue={editingParentId} // Set default value for parentId
                  render={({ field }) => (
                    <Select
                      onValueChange={(value) => field.onChange(value === "none" ? null : value)}
                      value={field.value || "none"}
                      disabled={isLoadingAllCategories || (modalMode === 'create' && !!editingParentId)} // Disable if adding subcategory (parentId is fixed)
                    >
                      <SelectTrigger className={`col-span-3 ${errors.parentId ? "border-red-500" : ""}`}>
                        <SelectValue placeholder="اختر فئة أصل (اختياري)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">-- لا يوجد (فئة رئيسية) --</SelectItem>
                        {parentCategoryOptions.map(cat => (
                          <SelectItem key={cat.id} value={cat.id} disabled={cat.id === selectedCategory?.id}>{cat.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                {errors.parentId && <p className="col-span-4 text-red-500 text-xs\">{errors.parentId.message}</p>}
              </div>
              <DialogFooter>
                <DialogClose asChild><Button type="button" variant="outline">إلغاء</Button></DialogClose>
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                  {createMutation.isPending || updateMutation.isPending ? "جار الحفظ..." : "حفظ"}
                </Button>
              </DialogFooter>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* REMOVED Manage Products Modal */}

      {/* Delete Confirmation Dialog (remains largely the same) */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent className="sm:max-w-[425px]" dir="rtl">
          <DialogHeader>
            <DialogTitle>تأكيد الحذف</DialogTitle>
            <DialogDescription>
              هل أنت متأكد أنك تريد حذف الفئة "{categoryToDelete?.name}"؟ لا يمكن التراجع عن هذا الإجراء.
              <br />
              <span className="text-yellow-600 font-semibold">ملاحظة: إذا كانت هذه الفئة تحتوي على فئات فرعية، قد تحتاج إلى معالجتها يدويًا أو تحديث منطق الحذف في الواجهة الخلفية. حذف فئة رئيسية لن يحذف فئاتها الفرعية تلقائيًا بهذا الإعداد الحالي.</span>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild><Button type="button" variant="outline">إلغاء</Button></DialogClose>
            <Button type="button" variant="destructive" onClick={() => categoryToDelete && deleteMutation.mutate(categoryToDelete.id)} disabled={deleteMutation.isPending}>
              {deleteMutation.isPending ? "جار الحذف..." : "حذف"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

