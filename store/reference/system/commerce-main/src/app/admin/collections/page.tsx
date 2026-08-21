"use client";

import React, { useState, useMemo, useCallback, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription, DialogClose } from "@/components/ui/dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { ChevronDown, Edit, Trash2, PlusCircle, Search as SearchIcon, XCircle, Package, GripVertical, XIcon, Copy, Eye } from "lucide-react";
import { useDebounce } from "@/hooks/use-debounce";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

import {
  SelectCollection as Collection,
  InsertCollection as CreateCollectionInput, // This is for API
  UpdateCollection, // This is for API
  // insertCollectionSchema, // Will use form-specific schemas below
  // updateCollectionSchema,
} from "@/modules/collections/types/collectionTypes";


// Define Product type at module level
interface Product {
  id: string;
  name: string;
  // Add other relevant product fields if needed for display or search
}

// Form Schemas
const baseCollectionFormSchema = z.object({
  name: z.string().min(1, { message: "يجب إدخال اسم المجموعة" }).max(100),
  slug: z.string().min(1, { message: "يجب إدخال الاسم اللطيف للمجموعة" }).max(100)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, { message: "يجب أن يحتوي الاسم اللطيف على أحرف صغيرة وأرقام وشرطات فقط" }),
  description: z.string().optional().nullable(),
  isActive: z.boolean().default(true).optional(),
});

const createFormSchema = baseCollectionFormSchema;
export type CreateFormValues = z.infer<typeof createFormSchema>;

const updateFormSchema = baseCollectionFormSchema.extend({
  id: z.string().uuid({ message: "معرف المجموعة غير صحيح" }),
});
export type UpdateFormValues = z.infer<typeof updateFormSchema>;

type CollectionFormValues = CreateFormValues | UpdateFormValues;


// API functions (assuming these are mostly correct from previous context)
// fetchCollections might need adjustment if backend doesn't support fetching all easily
const fetchCollectionsAPI = async (
  page: number = 1,
  limit: number = 1000, // Fetch a large number for "all"
  search?: string
): Promise<{ collections: CollectionWithProductsForUI[]; total: number }> => {
  const queryParams = new URLSearchParams({
    page: page.toString(),
    limit: limit.toString(),
  });
  if (search) {
    queryParams.append("search", search);
  }
  const response = await fetch(`/api/collections?${queryParams.toString()}`);
  if (!response.ok) {
    const errorData = await response
      .json()
      .catch(() => ({ message: "فشل جلب المجموعات" }));
    throw new Error(errorData.message || "فشل جلب المجموعات");
  }
  return response.json(); // Expects { collections: [], total: 0 }
};

async function createCollectionAPI(
  data: CreateCollectionInput
): Promise<Collection> {
  const res = await fetch("/api/collections", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const errorData = await res
      .json()
      .catch(() => ({ message: "فشل إنشاء المجموعة" }));
    throw new Error(errorData.message || "فشل إنشاء المجموعة");
  }
  return res.json();
}

async function updateCollectionAPI(
  id: string,
  data: Omit<UpdateCollection, 'id'> // API receives payload without id
): Promise<Collection> {
  // const { id: dataId, ...payload } = data; // data is already Omit<UpdateCollection, 'id'>
  const res = await fetch(`/api/collections/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data), // Send payload without id
  });
  if (!res.ok) {
    const errorData = await res
      .json()
      .catch(() => ({ message: "فشل تحديث المجموعة" }));
    throw new Error(errorData.message || "فشل تحديث المجموعة");
  }
  return res.json();
}

async function deleteCollectionAPI(id: string): Promise<void> {
  const res = await fetch(`/api/collections/${id}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    if (res.status === 204) return; // Handle 204 No Content as success
    const errorData = await res
      .json()
      .catch(() => ({ message: "فشل حذف المجموعة" }));
    throw new Error(errorData.message || "فشل حذف المجموعة");
  }
}

async function assignProductsToCollectionAPI(
  collectionId: string,
  productIds: string[]
): Promise<void> {
  const res = await fetch(`/api/collections/${collectionId}/products`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ productIds }),
  });
  if (!res.ok) {
    const errorData = await res
      .json()
      .catch(() => ({ message: "فشل إضافة المنتجات للمجموعة" }));
    throw new Error(errorData.message || "فشل إضافة المنتجات للمجموعة");
  }
}

async function removeProductsFromCollectionAPI(
  collectionId: string,
  productIds: string[]
): Promise<void> {
  const res = await fetch(`/api/collections/${collectionId}/products`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ productIds }),
  });
  if (!res.ok) {
    const errorData = await res
      .json()
      .catch(() => ({ message: "فشل إزالة المنتجات من المجموعة" }));
    throw new Error(errorData.message || "فشل إزالة المنتجات من المجموعة");
  }
}

// --- Replace fetchAllProductsAPI with categories page logic ---
// Assume an API to fetch all products (simplified version)
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

// CollectionNode Component
interface CollectionWithProductsForUI extends Collection {
  products: { productId: string }[]; // Now always present
}

const CollectionNode: React.FC<{
  node: CollectionWithProductsForUI;
  allProducts: Product[] | undefined;
  isLoadingAllProducts: boolean;
  onEdit: (collection: CollectionWithProductsForUI) => void;
  onDelete: (collection: CollectionWithProductsForUI) => void;
  assignProductsMutation: ReturnType<typeof useMutation<void, Error, { collectionId: string; productIds: string[] }>>;
  removeProductsMutation: ReturnType<typeof useMutation<void, Error, { collectionId: string; productIds: string[] }>>;
}> = ({ node, allProducts, isLoadingAllProducts, onEdit, onDelete, assignProductsMutation, removeProductsMutation }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [productSearch, setProductSearch] = useState("");
  const [isProductSearchFocused, setIsProductSearchFocused] = useState(false);

  // Assigned product IDs (from node.products)
  const assignedProductIds = useMemo(() => new Set((node.products || []).map((p: { productId: string }) => p.productId)), [node.products]);

  // Available products to add (not already assigned, filter by name)
  const availableProductsToAdd = useMemo(() => {
    if (!allProducts) return [];
    return allProducts
      .filter(p => !assignedProductIds.has(p.id))
      .filter(p => p.name.toLowerCase().includes(productSearch.toLowerCase()));
  }, [allProducts, assignedProductIds, productSearch]);

  // Get product details by id
  const getProductDetails = useCallback((productId: string): Product | undefined => {
    return allProducts?.find(p => p.id === productId);
  }, [allProducts]);

  const hasProducts = node.products && node.products.length > 0;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="mb-2 border rounded-md bg-card">
      <CollapsibleTrigger asChild>
        <div className="flex items-center justify-between p-3 hover:bg-muted/50 cursor-pointer" onClick={() => setIsOpen(!isOpen)}>
          <div className="flex items-center gap-2">
            <GripVertical className="h-5 w-5 text-muted-foreground" />
            <span className="font-medium">{node.name}</span>
            {node.slug && <Badge variant="outline">{node.slug}</Badge>}
            <Badge variant={node.isActive ? "default" : "secondary"}>
              {node.isActive ? "نشط" : "غير نشط"}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => {
                e.stopPropagation();
                const url = `${window.location.origin}/products?collectionId=${node.id}`;
                window.open(url, "_blank", "noopener,noreferrer");
              }}
              title="عرض المنتجات في صفحة عامة"
              aria-label="عرض المنتجات في صفحة عامة"
            >
              <Eye className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => {
                e.stopPropagation();
                const url = `${window.location.origin}/products?collectionId=${node.id}`;
                navigator.clipboard.writeText(url)
                  .then(() => toast.success("تم نسخ رابط عرض منتجات هذه المجموعة!"))
                  .catch(() => toast.error("تعذر نسخ الرابط"));
              }}
              title="نسخ رابط المنتجات للمجموعة"
              aria-label="نسخ رابط المنتجات للمجموعة"
            >
              <Copy className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); onEdit(node); }} aria-label="تعديل المجموعة">
              <Edit className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); onDelete(node); }} aria-label="حذف المجموعة">
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
            <Button variant="ghost" size="icon" aria-label="فتح/إغلاق التفاصيل" onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }}>
              <ChevronDown className={`h-5 w-5 transition-transform ${isOpen ? "rotate-180" : ""}`} />
            </Button>
          </div>
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent className="p-0">
        <div className="border-t p-4">
          <h4 className="text-sm font-semibold mb-2 text-muted-foreground">المنتجات في هذه المجموعة ({assignedProductIds.size})</h4>
          {isLoadingAllProducts && <p className="text-sm text-muted-foreground">جار تحميل المنتجات...</p>}
          {!isLoadingAllProducts && !hasProducts && <p className="text-sm text-muted-foreground">لا توجد منتجات مضافة لهذه المجموعة بعد.</p>}
          {hasProducts && allProducts && (
            <div className="mb-4">
              <ul className="list-none mt-1 mb-1 pl-1">
                {node.products?.map(({ productId, name }: { productId: string; name?: string }) => {
                  const product = getProductDetails(productId);
                  return (
                    <li key={productId} className="flex items-center justify-between py-1 px-2 hover:bg-muted rounded">
                      <span className="text-xs">{product ? product.name : (name ?? productId)}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive"
                        title="إزالة المنتج من المجموعة"
                        onClick={() => removeProductsMutation.mutate({ collectionId: node.id, productIds: [productId] })}
                        disabled={removeProductsMutation.isPending}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
          {/* Inline Product Add Section, like categories page */}
          <div className="relative mt-2">
            <Input
              type="text"
              placeholder="إضافة منتج..."
              value={productSearch}
              onChange={e => setProductSearch(e.target.value)}
              onFocus={() => setIsProductSearchFocused(true)}
              onBlur={() => setTimeout(() => setIsProductSearchFocused(false), 150)}
              className="text-xs h-8"
            />
            {isProductSearchFocused && availableProductsToAdd.length > 0 && (
              <div className="absolute z-10 w-full bg-background border border-border rounded-md shadow-lg mt-1 max-h-48 overflow-y-auto">
                {availableProductsToAdd.map(product => (
                  <div
                    key={product.id}
                    className="px-3 py-2 cursor-pointer hover:bg-muted text-xs flex items-center justify-between"
                    onMouseDown={() => {
                      assignProductsMutation.mutate({
                        collectionId: node.id,
                        productIds: [product.id],
                      });
                      setProductSearch("");
                    }}
                  >
                    <span>{product.name}</span>
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
  );
};

export default function CollectionsPage() {
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [selectedCollection, setSelectedCollection] = useState<CollectionWithProductsForUI | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [collectionToDelete, setCollectionToDelete] = useState<CollectionWithProductsForUI | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearchTerm = useDebounce(searchTerm, 500);

  // Queries
  const {
    data: collectionsData,
    isLoading: isLoadingCollections,
    error: errorCollections
  } = useQuery({
    queryKey: ["collections", debouncedSearchTerm],
    queryFn: () => fetchCollectionsAPI(1, 1000, debouncedSearchTerm),
  });

  const allCollections = useMemo(() => collectionsData?.collections || [], [collectionsData]);

  const {
    data: allProducts,
    isLoading: isLoadingAllProducts
  } = useQuery<Product[], Error>({
    queryKey: ["allProductsForAssignment"],
    queryFn: fetchAllProducts,
  });

  const { control, register, handleSubmit, formState: { errors }, setValue, reset } = useForm<CollectionFormValues>({
    resolver: zodResolver(modalMode === 'create' ? createFormSchema : updateFormSchema),
    defaultValues: { name: "", slug: "", description: "", isActive: true } as CreateFormValues,
    shouldUnregister: false,
  });

  // Reset form values whenever the modal mode or selected collection changes
  useEffect(() => {
    if (modalMode === "create") {
      reset({ name: "", slug: "", description: "", isActive: true } as CreateFormValues);
    } else if (modalMode === "edit" && selectedCollection) {
      reset({
        id: selectedCollection.id,
        name: selectedCollection.name,
        slug: selectedCollection.slug || "",
        description: selectedCollection.description || "",
        isActive: selectedCollection.isActive ?? true,
      } as UpdateFormValues);
    }
  }, [modalMode, selectedCollection, reset]);

  // Mutations
  const createMutation = useMutation<Collection, Error, CreateCollectionInput>({
    mutationFn: createCollectionAPI,
    onSuccess: (data) => {
      toast.success(`تم إنشاء المجموعة \"${data.name}\" بنجاح!`);
      queryClient.invalidateQueries({ queryKey: ["collections"] });
      setIsModalOpen(false);
    },
    onError: (error) => toast.error(error.message || "حدث خطأ أثناء إنشاء المجموعة"),
  });

  const updateMutation = useMutation<Collection, Error, { id: string; data: UpdateFormValues }>({
    mutationFn: ({ id, data }) => {
      const { id: dataId, ...payload } = data;
      return updateCollectionAPI(id, payload as Omit<UpdateCollection, 'id'>);
    },
    onSuccess: (data) => {
      toast.success(`تم تحديث المجموعة \"${data.name}\" بنجاح!`);
      queryClient.invalidateQueries({ queryKey: ["collections"] });
      setIsModalOpen(false);
    },
    onError: (error) => toast.error(error.message || "حدث خطأ أثناء تحديث المجموعة"),
  });

  const deleteMutation = useMutation<void, Error, string>({
    mutationFn: deleteCollectionAPI,
    onSuccess: () => {
      toast.success("تم حذف المجموعة بنجاح!");
      queryClient.invalidateQueries({ queryKey: ["collections"] });
      setShowDeleteConfirm(false);
      setCollectionToDelete(null);
    },
    onError: (error) => {
      toast.error(error.message || "حدث خطأ أثناء حذف المجموعة");
      setShowDeleteConfirm(false);
    },
  });

  const assignProductsMutation = useMutation<void, Error, { collectionId: string; productIds: string[] }>({
    mutationFn: ({ collectionId, productIds }) => assignProductsToCollectionAPI(collectionId, productIds),
    onSuccess: (_, variables) => {
      toast.success("تم تحديث منتجات المجموعة بنجاح");
      queryClient.invalidateQueries({ queryKey: ["collections"] });
    },
    onError: (error) => toast.error(error.message || "فشل في تحديث منتجات المجموعة"),
  });

  const removeProductsMutation = useMutation<void, Error, { collectionId: string; productIds: string[] }>({
    mutationFn: ({ collectionId, productIds }) => removeProductsFromCollectionAPI(collectionId, productIds),
    onSuccess: (_, variables) => {
      toast.success("تم تحديث منتجات المجموعة بنجاح");
      queryClient.invalidateQueries({ queryKey: ["collections"] });
    },
    onError: (error) => toast.error(error.message || "فشل في تحديث منتجات المجموعة"),
  });

  const handleOpenCreateModal = () => {
    setModalMode("create");
    setSelectedCollection(null);
    const createDefaults: CreateFormValues = { name: "", slug: "", description: "", isActive: true };
    reset(createDefaults);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (collection: CollectionWithProductsForUI) => {
    setModalMode("edit");
    setSelectedCollection(collection);
    reset({
      id: collection.id,
      name: collection.name,
      slug: collection.slug || "",
      description: collection.description || "",
      isActive: collection.isActive === undefined ? true : collection.isActive,
    } as UpdateFormValues);
    setIsModalOpen(true);
  };

  const handleOpenDeleteConfirm = (collection: CollectionWithProductsForUI) => {
    setCollectionToDelete(collection);
    setShowDeleteConfirm(true);
  };

  // onSubmit will receive data typed as CollectionFormValues
  const onSubmit = (data: CollectionFormValues) => {
    const slugify = (text: string) => {
      const base = (text || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/\p{Diacritic}/gu, "")
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9-]/g, "")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "");
      if (base.length > 0) return base;
      const rand = Math.random().toString(36).slice(2, 8);
      return `collection-${rand}`;
    };

    let submissionData: any = { ...data };
    if (!submissionData.slug || submissionData.slug.trim() === "") {
      submissionData.slug = slugify(submissionData.name);
    }
    if (modalMode === "create") {
      createMutation.mutate(submissionData as CreateCollectionInput);
    } else if (modalMode === "edit" && selectedCollection && 'id' in submissionData) {
      updateMutation.mutate({ id: selectedCollection.id, data: submissionData as UpdateFormValues });
    }
  };

  const filteredCollections = useMemo(() => {
    if (!allCollections) return [];
    if (!debouncedSearchTerm) return allCollections;
    const _lowerSearchTerm = debouncedSearchTerm.toLowerCase();
    return allCollections.filter((collection: Collection) =>
      collection.name.toLowerCase().includes(_lowerSearchTerm) ||
      (collection.slug && collection.slug.toLowerCase().includes(_lowerSearchTerm)) ||
      (collection.description && collection.description.toLowerCase().includes(_lowerSearchTerm))
    );
  }, [allCollections, debouncedSearchTerm]);

  if (isLoadingCollections) return <div dir="rtl" className="container mx-auto p-4 text-center">جار التحميل...</div>;
  if (errorCollections) return <div dir="rtl" className="container mx-auto p-4 text-center text-red-500">خطأ في جلب المجموعات: {errorCollections.message}</div>;

  return (
    <div dir="rtl" className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold">إدارة المجموعات</h1>
        <Button onClick={handleOpenCreateModal} className="bg-primary hover:bg-primary/90 text-primary-foreground">
          <PlusCircle className="ml-2 h-4 w-4" />
          إنشاء مجموعة جديدة
        </Button>
      </div>
      <div className="mb-4">
        <Input
          type="text"
          placeholder="ابحث عن مجموعة..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-sm"
        />
      </div>
      {filteredCollections.length > 0 ? (
        <div className="space-y-3">
          {filteredCollections.map((collection) => (
            <CollectionNode
              key={collection.id}
              node={{ ...collection, products: collection.products ?? [] }}
              allProducts={allProducts}
              isLoadingAllProducts={isLoadingAllProducts}
              onEdit={handleOpenEditModal}
              onDelete={handleOpenDeleteConfirm}
              assignProductsMutation={assignProductsMutation}
              removeProductsMutation={removeProductsMutation}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-10 text-muted-foreground">
          <Package className="mx-auto h-12 w-12 mb-4" />
          <p className="text-lg">لا توجد مجموعات لعرضها.</p>
          {debouncedSearchTerm && <p>حاول تعديل مصطلح البحث الخاص بك.</p>}
        </div>
      )}
      {/* إنشاء/تعديل مجموعة */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen} modal>
        <DialogContent
          className="sm:max-w-lg"
          onOpenAutoFocus={(e) => {
            // Ensure focus enters the first input but allow user control
            e.preventDefault();
            const first = document.querySelector<HTMLInputElement>('input[name="name"]');
            first?.focus();
          }}
        >
          <DialogHeader>
            <DialogTitle>{modalMode === "create" ? "إنشاء مجموعة جديدة" : "تعديل المجموعة"}</DialogTitle>
            <DialogDescription className="sr-only">يرجى إدخال بيانات المجموعة</DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={handleSubmit(onSubmit)}
            dir="rtl"
          >
            <div className="space-y-2">
              <label className="text-sm">اسم المجموعة</label>
              <Input
                placeholder="أدخل اسم المجموعة"
                {...register("name")}
                autoFocus
              />
              {errors.name && (
                <p className="text-destructive text-xs">{errors.name.message as string}</p>
              )}
            </div>
            <div className="space-y-2">
              <label className="text-sm">الاسم اللطيف (Slug)</label>
              <Input
                placeholder="يُشتق تلقائياً من الاسم إذا تركته فارغاً"
                {...register("slug")}
              />
              {errors.slug && (
                <p className="text-destructive text-xs">{errors.slug.message as string}</p>
              )}
            </div>
            <div className="space-y-2">
              <label className="text-sm">الوصف</label>
              <Input
                placeholder="وصف اختياري"
                {...register("description")}
              />
              {errors.description && (
                <p className="text-destructive text-xs">{errors.description.message as string}</p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Controller
                name="isActive"
                control={control}
                render={({ field }) => (
                  <Checkbox checked={!!field.value} onCheckedChange={(v) => field.onChange(!!v)} />
                )}
              />
              <span className="text-sm">نشط</span>
            </div>
            <DialogFooter className="pt-2">
              <DialogClose asChild>
                <Button type="button" variant="secondary">إلغاء</Button>
              </DialogClose>
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                {modalMode === "create" ? "إنشاء" : "حفظ"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
