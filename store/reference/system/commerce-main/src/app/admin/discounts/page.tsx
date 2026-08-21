"use client";

import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Loader2,
  Percent,
  Gift,
  Truck,
  Tag,
  Layers,
  Calendar,
  Users,
  AlertCircle,
  Plus,
  RefreshCw,
  Search,
} from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { format } from "date-fns";
import { ar } from "date-fns/locale";

const typeIcons: Record<string, any> = {
  fixed: Tag,
  percentage: Percent,
  bogo: Gift,
  tiered: Layers,
  delivery: Truck,
};

const typeLabels: Record<string, string> = {
  fixed: "قيمة ثابتة",
  percentage: "نسبة مئوية",
  bogo: "اشتر واحصل (BOGO)",
  tiered: "خصم متدرج",
  delivery: "خصم توصيل",
};

const typeColors: Record<string, string> = {
  fixed: "bg-blue-100 text-blue-800",
  percentage: "bg-purple-100 text-purple-800",
  bogo: "bg-pink-100 text-pink-800",
  tiered: "bg-orange-100 text-orange-800",
  delivery: "bg-emerald-100 text-emerald-800",
};

const targetLabels: Record<string, string> = {
  product: "منتج",
  variant: "متغير",
  order: "طلب كامل",
  delivery: "توصيل",
  region: "منطقة",
  city: "مدينة",
  collection: "مجموعة",
};

export default function DiscountListPage() {
  const [discounts, setDiscounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const fetchDiscounts = () => {
    setLoading(true);
    fetch("/api/discounts")
      .then((res) => res.json())
      .then((data) => setDiscounts(data.data || []))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchDiscounts();
  }, []);

  const filteredDiscounts = discounts.filter((d) =>
    (d.name || "").toLowerCase().includes(search.toLowerCase()) ||
    (d.code || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="container mx-auto p-4 md:p-8" dir="rtl">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight mb-2">الخصومات والعروض</h1>
          <p className="text-muted-foreground text-sm">
            إدارة الخصومات، الكوبونات، العروض الخاصة وحملات التخفيض لعملائك
          </p>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <Button variant="outline" size="icon" onClick={fetchDiscounts} disabled={loading} title="تحديث">
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
          <Button asChild className="w-full md:w-auto gap-2">
            <Link href="/admin/discounts/new">
              <Plus className="h-4 w-4" />
              إضافة خصم جديد
            </Link>
          </Button>
        </div>
      </div>

      <div className="bg-card rounded-lg shadow-sm border p-4 mb-8">
        <div className="relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
            placeholder="ابحث باسم الخصم أو رمز الكوبون..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-4 pr-10 border-muted-foreground/20 focus-visible:ring-primary h-12 text-md"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center flex-col gap-4 items-center py-20">
          <Loader2 className="animate-spin h-10 w-10 text-primary" />
          <p className="text-muted-foreground animate-pulse">جاري تحميل البيانات...</p>
        </div>
      ) : filteredDiscounts.length === 0 ? (
        <div className="text-center bg-card border border-dashed rounded-xl py-20 px-4">
          <div className="bg-primary/10 rounded-full h-16 w-16 flex items-center justify-center mx-auto mb-4">
            <Tag className="h-8 w-8 text-primary" />
          </div>
          <h3 className="text-lg font-semibold mb-2">لا توجد خصومات مطابقة</h3>
          <p className="text-muted-foreground max-w-sm mx-auto mb-6">
            لم نتمكن من العثور على أي خصومات أو عروض حالياً بناءً على بحثك
          </p>
          <Button asChild variant="outline">
            <Link href="/admin/discounts/new">أنشئ أول خصم الآن</Link>
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {filteredDiscounts.map((discount) => {
            const Icon = typeIcons[discount.type] || Tag;

            // Generate details string
            const details = [];
            if (discount.type === "fixed" && discount.value) details.push(`خصم بقيمة ${discount.value} د.ل`);
            if (discount.type === "percentage" && discount.percentage) details.push(`خصم بنسبة ${discount.percentage}%`);
            if (discount.minOrderAmount) details.push(`للطلبات فوق ${discount.minOrderAmount} د.ل`);
            if (discount.usageLimit) details.push(`الحد الأقصى للاستخدام: ${discount.usageLimit}`);

            const isExpired = discount.endDate && new Date(discount.endDate) < new Date();
            const isLimitReached = discount.usageLimit && discount.usageCount >= discount.usageLimit;
            const notActive = !discount.isActive || isExpired || isLimitReached;

            return (
              <Card
                key={discount.id}
                className={`overflow-hidden transition-all duration-300 hover:shadow-md border-t-4 ${notActive ? "border-t-muted opacity-80" : "border-t-primary"
                  }`}
              >
                <CardHeader className="pb-4">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-4">
                      <div className={`rounded-xl p-3 ${typeColors[discount.type] || "bg-secondary text-secondary-foreground"}`}>
                        <Icon className="h-6 w-6" />
                      </div>
                      <div>
                        <CardTitle className="text-xl mb-1 flex items-center gap-2">
                          {discount.name || "لا يوجد اسم"}
                        </CardTitle>
                        <CardDescription className="flex items-center gap-2 text-sm font-medium">
                          <Badge variant="outline" className="font-normal text-xs bg-background">
                            {typeLabels[discount.type] || discount.type}
                          </Badge>
                          <span className="text-muted-foreground/40">•</span>
                          <span>الهدف: {targetLabels[discount.target] || discount.target}</span>
                        </CardDescription>
                      </div>
                    </div>
                    <div>
                      {discount.isActive && !isExpired && !isLimitReached ? (
                        <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white border-0 shadow-sm shadow-emerald-200">
                          نشط الآن
                        </Badge>
                      ) : isExpired ? (
                        <Badge variant="secondary" className="text-rose-600 bg-rose-50 hover:bg-rose-100">
                          منتهي الصلاحية
                        </Badge>
                      ) : isLimitReached ? (
                        <Badge variant="secondary" className="text-orange-600 bg-orange-50 hover:bg-orange-100">
                          مكتمل الاستخدام
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-muted-foreground bg-slate-100">
                          غير مفعل
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardHeader>

                <CardContent>
                  {discount.description && (
                    <p className="text-sm text-foreground/80 mb-4 bg-muted/30 p-3 rounded-lg border border-border/50">
                      {discount.description}
                    </p>
                  )}

                  <div className="grid grid-cols-2 gap-4 text-sm mt-4">
                    {discount.code && (
                      <div className="flex items-center gap-2">
                        <Tag className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">الكوبون:</span>
                        <span className="font-mono font-bold tracking-widest bg-muted px-2 py-0.5 rounded text-xs">
                          {discount.code}
                        </span>
                      </div>
                    )}

                    {discount.customerSegment && (
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">شريحة العملاء:</span>
                        <span className="font-medium text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">
                          {discount.customerSegment}
                        </span>
                      </div>
                    )}

                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">تاريخ الانتهاء:</span>
                      <span className="font-medium">
                        {discount.endDate
                          ? format(new Date(discount.endDate), 'dd MMM yyyy', { locale: ar })
                          : "مستمر دائماً"}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">الاستخدام:</span>
                      <span className="font-medium">
                        {discount.usageCount || 0}
                        {discount.usageLimit ? ` / ${discount.usageLimit}` : " (لا محدود)"}
                      </span>
                    </div>
                  </div>

                  {details.length > 0 && (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {details.map((detail, idx) => (
                        <Badge key={idx} variant="outline" className="text-xs font-normal text-muted-foreground bg-background">
                          {detail}
                        </Badge>
                      ))}
                    </div>
                  )}
                </CardContent>

                <CardFooter className="bg-muted/30 border-t py-3 flex justify-end gap-3">
                  <Button asChild size="sm" variant="ghost" className="hover:bg-primary/10 hover:text-primary">
                    <Link href={`/admin/discounts/${discount.id}`}>تعديل الخصم</Link>
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
