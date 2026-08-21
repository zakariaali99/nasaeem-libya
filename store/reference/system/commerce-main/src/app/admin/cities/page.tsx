"use client";

import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Edit, Trash2, Plus } from "lucide-react";

// Define types for cities and regions
interface City {
  id: string;
  name: string;
  code?: string;
  deliveryFee?: string;
  isActive: boolean;
}
interface Region {
  id: string;
  name: string;
  deliveryFee?: string;
  estimatedDeliveryDays?: number;
  isActive: boolean;
}

// Fetch all cities
async function fetchCities(): Promise<City[]> {
  const res = await fetch('/api/delivery/cities?admin=true');
  if (!res.ok) throw new Error('خطأ في جلب المدن');
  const data = await res.json();
  return data.data;
}

// Update city details
async function updateCityFn(variables: { id: string; name?: string; code?: string; isActive?: boolean }): Promise<any> {
  const { id, ...updates } = variables;
  const res = await fetch(`/api/delivery/cities/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates)
  });
  if (!res.ok) throw new Error('فشل في تحديث المدينة');
  return res.json();
}

// Fetch regions for a city
async function fetchRegions(cityId: string): Promise<Region[]> {
  const res = await fetch(`/api/delivery/cities/${cityId}/regions?admin=true`);
  if (!res.ok) throw new Error('خطأ في جلب المناطق');
  const data = await res.json();
  return data.data;
}

// Update region details
async function updateRegionFn(variables: { cityId: string; regionId: string; name?: string; deliveryFee?: string; estimatedDeliveryDays?: number; isActive?: boolean }): Promise<any> {
  const { cityId, regionId, ...updates } = variables;
  const res = await fetch(`/api/delivery/cities/${cityId}/regions/${regionId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates)
  });
  if (!res.ok) throw new Error('فشل في تحديث المنطقة');
  return res.json();
}

export default function CitiesPage() {
  const queryClient = useQueryClient();
  const { data: cities = [], isLoading, error } = useQuery<City[], Error>({ queryKey: ['cities'], queryFn: fetchCities });

  // State for open collapsible
  const [openCityId, setOpenCityId] = useState<string | null>(null);
  // Track loading spinner when fetching regions
  const [loadingCity, setLoadingCity] = useState<string | null>(null);

  // City form state
  const [cityName, setCityName] = useState('');
  const [cityCode, setCityCode] = useState('');
  const [cityDeliveryFee, setCityDeliveryFee] = useState('');
  // City creation mutation
  const createCityMutation = useMutation<any, Error, { name: string; code: string; deliveryFee?: string }>({
    mutationFn: async (variables: { name: string; code: string; deliveryFee?: string }) => {
      const { name, code, deliveryFee } = variables;
      const res = await fetch('/api/delivery/cities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, code, deliveryFee: deliveryFee || undefined })
      });
      if (!res.ok) throw new Error('خطأ في إنشاء المدينة');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cities'] });
      setCityName(''); setCityCode(''); setCityDeliveryFee('');
    }
  });

  // City deletion mutation
  const deleteCityMutation = useMutation<any, Error, string>({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/delivery/cities/${id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) throw new Error('فشل في حذف المدينة');
      return res.json();
    },
    onSuccess: (_data, deletedId) => {
      // Close the collapsible if the deleted city was open
      if (openCityId === deletedId) setOpenCityId(null);
      queryClient.invalidateQueries({ queryKey: ['cities'] });
    }
  });

  if (isLoading) return <div className="p-4 text-center" dir="rtl">جاري تحميل البيانات...</div>;
  if (error) return <div className="p-4 text-center text-red-600" dir="rtl">خطأ: {error.message}</div>;

  return (
    <div className="container mx-auto p-4 max-w-5xl" dir="rtl">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">إدارة المدن والمناطق</h1>
          <p className="text-gray-500 mt-2">قم بإدارة المدن والمناطق الفرعية وتحديد أسعار التوصيل بشكل دقيق.</p>
        </div>
        <Dialog>
          <DialogTrigger asChild>
            <Button><Plus className="ml-2 w-4 h-4" /> إضافة مدينة جديدة</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>إضافة مدينة جديدة</DialogTitle>
            </DialogHeader>
            <form onSubmit={e => { e.preventDefault(); createCityMutation.mutate({ name: cityName, code: cityCode, deliveryFee: cityDeliveryFee || undefined }); }} className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="city-name">اسم المدينة</Label>
                <Input id="city-name" placeholder="أدخل اسم المدينة" value={cityName} onChange={e => setCityName(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="city-code">كود المدينة (اختياري)</Label>
                <Input id="city-code" placeholder="أدخل كود المدينة للربط البرمجي" value={cityCode} onChange={e => setCityCode(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="city-fee">سعر التوصيل الافتراضي (د.ل)</Label>
                <Input id="city-fee" placeholder="أدخل سعر التوصيل الافتراضي" type="number" step="0.5" value={cityDeliveryFee} onChange={e => setCityDeliveryFee(e.target.value)} />
                <p className="text-xs text-gray-500">سيتم استخدامه كسعر افتراضي للمناطق التي لا يوجد لها سعر توصيل خاص.</p>
              </div>
              <DialogFooter>
                <DialogClose asChild><Button variant="outline" type="button">إلغاء</Button></DialogClose>
                <Button type="submit">حفظ إضافة المدينة</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-4">
        {cities.map(city => {
          const showingSpinner = loadingCity === city.id;

          return (
            <Collapsible key={city.id} open={openCityId === city.id} onOpenChange={open => {
              setOpenCityId(open ? city.id : null);
              if (open) setLoadingCity(city.id);
            }}>
              <CollapsibleTrigger asChild>
                <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-gray-100 hover:border-gray-200 hover:shadow-md transition-all cursor-pointer">
                  <div className="flex items-center space-x-4 space-x-reverse">
                    <h2 className="text-lg font-bold min-w-[120px]">{city.name}</h2>
                    {city.deliveryFee && <span className="text-sm font-semibold text-green-700 bg-green-50 px-2 py-0.5 rounded-full">{city.deliveryFee} د.ل</span>}
                    {showingSpinner && <div className="w-4 h-4 border-2 border-t-2 border-primary rounded-full animate-spin" />}

                    <div className="flex items-center gap-2 border border-gray-100 px-3 py-1.5 rounded-full bg-gray-50 mr-4" onClick={(e) => e.stopPropagation()}>
                      <Label className="text-xs text-gray-600 mb-0 cursor-pointer" htmlFor={`switch-${city.id}`}>{city.isActive ? 'مفعلة' : 'معطلة'}</Label>
                      <Switch id={`switch-${city.id}`} checked={city.isActive} onCheckedChange={checked => updateCityFn({ id: city.id, isActive: checked }).then(() => queryClient.invalidateQueries({ queryKey: ['cities'] }))} />
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 space-x-reverse" onClick={(e) => e.stopPropagation()}>
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button size="sm" variant="outline" className="bg-white"><Plus className="ml-1 w-4 h-4" /> إضافة منطقة</Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>إضافة منطقة جديدة إلى {city.name}</DialogTitle>
                        </DialogHeader>
                        <RegionForm cityId={city.id} />
                      </DialogContent>
                    </Dialog>

                    <Dialog>
                      <DialogTrigger asChild>
                        <Button size="sm" variant="ghost" className="text-blue-600 hover:bg-blue-50 hover:text-blue-700">
                          <Edit className="w-4 h-4" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>تعديل بيانات المدينة</DialogTitle>
                        </DialogHeader>
                        <EditCityForm city={city} />
                      </DialogContent>
                    </Dialog>

                    <Button size="sm" variant="ghost" className="text-red-600 hover:bg-red-50 hover:text-red-700" onClick={async () => {
                      const regions = await fetchRegions(city.id);
                      if (regions.length > 0) {
                        return alert('لا يمكن حذف المدينة قبل حذف جميع المناطق المرتبطة بها.');
                      }
                      if (confirm(`هل أنت متأكد من حذف ${city.name} نهائياً؟`)) {
                        deleteCityMutation.mutate(city.id);
                      }
                    }}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="p-4 bg-gray-50/50 rounded-b-xl border-x border-b border-gray-100 shadow-inner mt-[-4px] pt-6">
                  <Table className="bg-white rounded-lg overflow-hidden border">
                    <TableHeader className="bg-slate-50">
                      <TableRow>
                        <TableHead className="text-right w-1/3">اسم المنطقة</TableHead>
                        <TableHead className="text-right">سعر التوصيل</TableHead>
                        <TableHead className="text-right">أيام التوصيل</TableHead>
                        <TableHead className="text-right">حالة التفعيل</TableHead>
                        <TableHead className="text-left">إجراءات</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <RegionsList cityId={city.id} onRegionsLoaded={() => setLoadingCity(null)} />
                    </TableBody>
                  </Table>
                </div>
              </CollapsibleContent>
            </Collapsible>
          );
        })}
      </div>
    </div>
  );
}

// Component to edit city form
function EditCityForm({ city }: { city: City }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(city.name);
  const [code, setCode] = useState(city.code || '');
  const [deliveryFee, setDeliveryFee] = useState(city.deliveryFee || '');

  const updateCityMutation = useMutation<any, Error, { name: string; code?: string; deliveryFee?: string }>({
    mutationFn: async (vars) => updateCityFn({ id: city.id, ...vars }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cities'] });
    }
  });

  return (
    <form onSubmit={e => { e.preventDefault(); updateCityMutation.mutate({ name, code, deliveryFee: deliveryFee || undefined }); }} className="space-y-4 pt-4">
      <div className="space-y-2">
        <Label htmlFor={`edit-city-name-${city.id}`}>اسم المدينة</Label>
        <Input id={`edit-city-name-${city.id}`} value={name} onChange={e => setName(e.target.value)} required />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`edit-city-code-${city.id}`}>كود المدينة</Label>
        <Input id={`edit-city-code-${city.id}`} value={code} onChange={e => setCode(e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`edit-city-fee-${city.id}`}>سعر التوصيل الافتراضي (د.ل)</Label>
        <Input id={`edit-city-fee-${city.id}`} type="number" step="0.5" value={deliveryFee} onChange={e => setDeliveryFee(e.target.value)} />
        <p className="text-xs text-gray-500">ستورثه المناطق التي لا يوجد لها سعر توصيل خاص.</p>
      </div>
      <DialogFooter>
        <DialogClose asChild><Button variant="outline" type="button">إلغاء</Button></DialogClose>
        <DialogClose asChild><Button type="submit">حفظ التعديلات</Button></DialogClose>
      </DialogFooter>
    </form>
  );
}

// Component to list regions for a city
function RegionsList({ cityId, onRegionsLoaded }: { cityId: string; onRegionsLoaded: () => void }) {
  const queryClient = useQueryClient();
  // Fetch regions
  const { data: regions = [], isLoading, error } = useQuery<Region[], Error>({
    queryKey: ['regions', cityId],
    queryFn: () => fetchRegions(cityId),
  });
  // Notify parent when regions loaded
  useEffect(() => {
    if (!isLoading) {
      onRegionsLoaded();
    }
  }, [isLoading, onRegionsLoaded]);
  // Region toggle mutation
  const toggleRegion = useMutation<any, Error, { cityId: string; regionId: string; isActive: boolean }>({
    mutationFn: updateRegionFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['regions', cityId] });
    }
  });
  // Region deletion mutation
  const deleteRegionMutation = useMutation<any, Error, { regionId: string }>({
    mutationFn: async ({ regionId }) => {
      const res = await fetch(`/api/delivery/cities/${cityId}/regions/${regionId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('فشل في حذف المنطقة');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['regions', cityId] });
    }
  });

  if (isLoading) return <TableRow><TableCell colSpan={5} className="text-center py-8">جاري تحميل المناطق...</TableCell></TableRow>;
  if (error) return <TableRow><TableCell colSpan={5} className="text-red-600 text-center py-8">خطأ: {error.message}</TableCell></TableRow>;
  if (regions.length === 0) return <TableRow><TableCell colSpan={5} className="text-gray-500 text-center py-8">لا يوجد مناطق مسجلة في هذه المدينة.</TableCell></TableRow>;

  return (
    <>
      {regions.map(region => (
        <TableRow key={region.id} className="hover:bg-slate-50/50">
          <TableCell className="font-medium text-right">{region.name}</TableCell>
          <TableCell className="text-right">
            {region.deliveryFee ? <span className="font-semibold text-green-700">{region.deliveryFee} د.ل</span> : <span className="text-gray-400">مجاني (0)</span>}
          </TableCell>
          <TableCell className="text-right">
            {region.estimatedDeliveryDays ? `${region.estimatedDeliveryDays} يوم` : <span className="text-gray-400">غير محدد</span>}
          </TableCell>
          <TableCell className="text-right whitespace-nowrap">
            <Switch checked={region.isActive} onCheckedChange={checked => toggleRegion.mutate({ cityId, regionId: region.id, isActive: checked })} />
          </TableCell>
          <TableCell className="text-left">
            <div className="flex items-center justify-end gap-1">
              <Dialog>
                <DialogTrigger asChild>
                  <Button size="icon" variant="ghost" className="text-blue-600 h-8 w-8 hover:bg-blue-50 rounded-full">
                    <Edit className="w-4 h-4" />
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>تعديل بيانات المنطقة</DialogTitle>
                  </DialogHeader>
                  <EditRegionForm cityId={cityId} region={region} />
                </DialogContent>
              </Dialog>

              <Button size="icon" variant="ghost" className="text-red-600 h-8 w-8 hover:bg-red-50 rounded-full" onClick={() => {
                if (confirm(`هل أنت متأكد من حذف المنطقة ${region.name} نهائياً؟`)) {
                  deleteRegionMutation.mutate({ regionId: region.id });
                }
              }}>
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </TableCell>
        </TableRow>
      ))}
    </>
  );
}

// Component for region creation form
function RegionForm({ cityId }: { cityId: string }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [deliveryFee, setDeliveryFee] = useState('');
  const [estimatedDeliveryDays, setEstimated] = useState('');
  // Region creation mutation
  const createRegion = useMutation<any, Error, { name: string; deliveryFee: string; estimatedDeliveryDays: number }>({
    mutationFn: async (vars: { name: string; deliveryFee: string; estimatedDeliveryDays: number }) => {
      const { name, deliveryFee, estimatedDeliveryDays } = vars;
      const res = await fetch(`/api/delivery/cities/${cityId}/regions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cityId, name, deliveryFee, estimatedDeliveryDays })
      });
      if (!res.ok) throw new Error('خطأ في إنشاء المنطقة');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['regions', cityId] });
      setName(''); setDeliveryFee(''); setEstimated('');
    }
  });

  return (
    <form onSubmit={e => { e.preventDefault(); createRegion.mutate({ name, deliveryFee, estimatedDeliveryDays: Number(estimatedDeliveryDays) || 0 }); }} className="space-y-4 pt-4">
      <div className="space-y-2">
        <Label htmlFor={`create-region-name-${cityId}`}>اسم المنطقة</Label>
        <Input id={`create-region-name-${cityId}`} placeholder="أدخل اسم المنطقة" value={name} onChange={e => setName(e.target.value)} required />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`create-region-fee-${cityId}`}>سعر التوصيل للمنطقة</Label>
        <Input id={`create-region-fee-${cityId}`} placeholder="امسح للسماح للمدينة بتحديد السعر" type="number" step="0.5" value={deliveryFee} onChange={e => setDeliveryFee(e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`create-region-days-${cityId}`}>أيام التوصيل (تقديري)</Label>
        <Input id={`create-region-days-${cityId}`} placeholder="مثال: 2" type="number" value={estimatedDeliveryDays} onChange={e => setEstimated(e.target.value)} />
      </div>
      <DialogFooter>
        <DialogClose asChild><Button variant="outline" type="button">إلغاء</Button></DialogClose>
        <DialogClose asChild><Button type="submit">حفظ إضافة المنطقة</Button></DialogClose>
      </DialogFooter>
    </form>
  );
}

// Component to edit existing region form
function EditRegionForm({ cityId, region }: { cityId: string, region: Region }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(region.name);
  const [deliveryFee, setDeliveryFee] = useState(region.deliveryFee || '');
  const [estimatedDeliveryDays, setEstimated] = useState(region.estimatedDeliveryDays?.toString() || '');

  const updateRegionMutation = useMutation<any, Error, { name: string; deliveryFee?: string; estimatedDeliveryDays?: number }>({
    mutationFn: async (vars) => updateRegionFn({ cityId, regionId: region.id, ...vars }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['regions', cityId] });
    }
  });

  return (
    <form onSubmit={e => { e.preventDefault(); updateRegionMutation.mutate({ name, deliveryFee, estimatedDeliveryDays: Number(estimatedDeliveryDays) || undefined }); }} className="space-y-4 pt-4">
      <div className="space-y-2">
        <Label htmlFor={`edit-region-name-${region.id}`}>اسم المنطقة</Label>
        <Input id={`edit-region-name-${region.id}`} value={name} onChange={e => setName(e.target.value)} required />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`edit-region-fee-${region.id}`}>سعر التوصيل للمنطقة</Label>
        <Input id={`edit-region-fee-${region.id}`} type="number" step="0.5" value={deliveryFee} onChange={e => setDeliveryFee(e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`edit-region-days-${region.id}`}>أيام التوصيل (تقديري)</Label>
        <Input id={`edit-region-days-${region.id}`} type="number" value={estimatedDeliveryDays} onChange={e => setEstimated(e.target.value)} />
      </div>
      <DialogFooter>
        <DialogClose asChild><Button variant="outline" type="button">إلغاء</Button></DialogClose>
        <DialogClose asChild><Button type="submit">حفظ التعديلات</Button></DialogClose>
      </DialogFooter>
    </form>
  );
}