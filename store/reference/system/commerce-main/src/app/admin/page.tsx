"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { TrendingUp, Search, ShoppingCart, Users, LineChart, BarChart2, Clock, Play } from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from "recharts";

type DailyPoint = {
  day: string;
  page_views: number;
  product_views: number;
  searches: number;
  search_no_results: number;
  completed_checkout: number;
  checkout_recovery: number;
  add_to_cart: number;
  payment_initiated: number;
  payment_success: number;
  payment_failed: number;
  search_select: number;
};

type ProductEntry = { product_id?: string | null; name: string | null; views: number };
type ProductConversionEntry = { product_id?: string | null; name: string | null; views: number; add_to_cart: number; payments: number };
type SearchQueryEntry = { query: string; count: number; select_count: number };
type FunnelEntry = { step: string; value: number };
type DeviceEntry = { device: string; count: number };
type DeviceTypeEntry = { device_type: string; count: number };
type OSEntry = { os: string; count: number };
type BrowserEntry = { browser: string; count: number };
type CountryEntry = { country: string; count: number };
type CityEntry = { city: string; count: number };
type CountryMetricEntry = { country: string; page_views: number; product_views: number; searches: number; payments_completed: number };
type CityMetricEntry = { city: string; country: string; page_views: number; product_views: number; searches: number; payments_completed: number };
type WebVitals = { cls: number; lcp: number; fid: number; inp: number };
type WebVitalsByDevice = { device_type: string; samples: number; cls: number; lcp: number; fid: number; inp: number };
type CohortEntry = { period: string; page_views: number; product_views: number; checkout_attempts: number; payments_completed: number };
type AuthStats = { login_success: number; login_failed: number; signup_success: number; signup_failed: number };
type EngagementAction = { action: string; count: number };
type Engagement = {
  avg_scroll_depth: number;
  product_engagement_events: number;
  filter_sort_events: number;
  actions: EngagementAction[];
};
type AcquisitionSource = { source: string; medium: string; count: number };
type AcquisitionMedium = { medium: string; count: number };
type AcquisitionCampaign = { campaign: string; source: string; medium: string; count: number };
type AcquisitionReferrer = { referrer: string; count: number };
type PaymentFailureByMethod = { payment_method: string; failed: number; succeeded: number; verified: number };
type GeoCostEntry = { city: string; region: string; orders: number; order_total: number; shipping_total: number; discount_total: number; delivery_discount_amount: number };
type Insight = { title: string; points: string[]; severity: "high" | "medium" | "low"; tag: string };

type RfmConfig = {
  id: string;
  name: string;
  description?: string | null;
  recencyWindowDays: number;
  frequencyWindowDays: number;
  monetaryWindowDays: number;
  weights: { recency: number; frequency: number; monetary: number };
};

type RfmScoreRow = {
  user_id: string;
  phone?: string | null;
  email?: string | null;
  segment: string;
  window_label: string;
  total_score: number;
  recency_score: number;
  frequency_score: number;
  monetary_score: number;
  order_count: number;
  total_spent: string | number;
  last_order_at?: string | null;
  recency_days?: number | null;
  computed_at: string;
};

type OverviewResponse = {
  rangeDays: number;
  daily: DailyPoint[];
  products: ProductEntry[];
  productConversion: ProductConversionEntry[];
  search: { topQueries: SearchQueryEntry[]; noResultsRate: number; selectRate: number };
  funnel: FunnelEntry[];
  paymentLifecycle: FunnelEntry[];
  auth: AuthStats;
  devices: DeviceEntry[];
  deviceTypes: DeviceTypeEntry[];
  oses: OSEntry[];
  browsers: BrowserEntry[];
  countries: CountryEntry[];
  cities: CityEntry[];
  countryMetrics: CountryMetricEntry[];
  cityMetrics: CityMetricEntry[];
  webVitals: WebVitals;
  webVitalsByDevice: WebVitalsByDevice[];
  engagement: Engagement;
  cohorts: { weekly: CohortEntry[]; monthly: CohortEntry[] };
  acquisitions: {
    sources: AcquisitionSource[];
    mediums: AcquisitionMedium[];
    campaigns: AcquisitionCampaign[];
    referrers: AcquisitionReferrer[];
  };
  paymentFailuresByMethod: PaymentFailureByMethod[];
  geoCostByCity: GeoCostEntry[];
  summary: {
    pageViews: number;
    productViews: number;
    searches: number;
    searchNoResults: number;
    completedCheckout: number;
    checkoutRecovery: number;
  };
};

const ranges = [
  { key: "7", label: "آخر ٧ أيام" },
  { key: "30", label: "آخر ٣٠ يوم" },
  { key: "90", label: "آخر ٩٠ يوم" },
];

const tabs = [
  { key: "summary", label: "نظرة عامة" },
  { key: "acquisition", label: "قنوات الاكتساب" },
  { key: "product", label: "تحليلات المنتجات" },
  { key: "search", label: "تحليلات البحث" },
  { key: "customer", label: "تحليلات العملاء" },
  { key: "checkout", label: "تحويل الشراء" },
  { key: "geo", label: "تحليلات المواقع" },
];

const COLORS = ["#0ea5e9", "#22c55e", "#f97316", "#6366f1", "#ef4444", "#14b8a6"];

const nf = new Intl.NumberFormat("ar-LY");

function formatNumber(value: number) {
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}م`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}ك`;
  return nf.format(value);
}

function percentChange(series: number[]) {
  if (series.length < 2) return 0;
  const half = Math.floor(series.length / 2);
  const prev = series.slice(0, half).reduce((a, b) => a + b, 0);
  const curr = series.slice(half).reduce((a, b) => a + b, 0);
  if (prev === 0) return curr > 0 ? 100 : 0;
  return ((curr - prev) / prev) * 100;
}

function formatPercent(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

function safeDivide(num: number, den: number) {
  return den > 0 ? num / den : 0;
}

function formatDateTime(value?: string | null) {
  if (!value) return "-";
  const d = new Date(value);
  return d.toLocaleString("ar-LY", { hour12: false });
}

function StatCard({
  label,
  value,
  helper,
  change,
  icon,
}: {
  label: string;
  value: number | string;
  helper?: string;
  change?: number;
  icon?: React.ReactNode;
}) {
  const isUp = (change ?? 0) >= 0;
  return (
    <Card className="shadow-sm border-muted/60 bg-white/70 dark:bg-slate-900/60">
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
        <div className="space-y-1">
          <CardTitle className="text-base font-semibold">{label}</CardTitle>
          {helper ? <p className="text-xs text-muted-foreground">{helper}</p> : null}
        </div>
        <div className="text-emerald-700 dark:text-emerald-400">{icon}</div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="text-3xl font-bold tracking-tight">
          {typeof value === "number" ? formatNumber(value) : value}
        </div>
        {change !== undefined && (
          <div className="flex items-center gap-2 text-sm">
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold",
                isUp ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
              )}
            >
              <TrendingUp className="h-4 w-4" />
              {Math.abs(change).toFixed(1)}%
            </span>
            <span className="text-muted-foreground">مقارنة بنصف الفترة السابقة</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function LoadingCard({ title }: { title: string }) {
  return (
    <Card className="border-muted/60 bg-white/60 dark:bg-slate-900/60 animate-pulse">
      <CardHeader>
        <CardTitle className="text-base font-semibold">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-6 w-24 rounded bg-muted mb-3" />
        <div className="h-40 rounded bg-muted" />
      </CardContent>
    </Card>
  );
}

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<string>(tabs[0].key);
  const [range, setRange] = useState<string>(ranges[1].key);
  const [query, setQuery] = useState<string>("");
  const [sort, setSort] = useState<string>("views");
  const [selectedDeviceVitals, setSelectedDeviceVitals] = useState<string>("all");
  const [rfmForm, setRfmForm] = useState<{ recency: number; frequency: number; monetary: number; weightR: number; weightF: number; weightM: number } | null>(null);

  const { data: rfmConfigData, refetch: refetchRfmConfig } = useQuery<{ config: RfmConfig }>({
    queryKey: ["admin-rfm-config"],
    queryFn: async () => {
      const res = await fetch("/api/admin/analytics/rfm/config");
      if (!res.ok) throw new Error("فشل جلب إعدادات RFM");
      return res.json();
    },
  });

  const { data: rfmScoresData, isLoading: rfmScoresLoading, refetch: refetchRfmScores } = useQuery<{ scores: RfmScoreRow[]; segments: { segment: string; count: number }[] }>({
    queryKey: ["admin-rfm-scores"],
    queryFn: async () => {
      const res = await fetch("/api/admin/analytics/rfm/scores?limit=80");
      if (!res.ok) throw new Error("فشل جلب شرائح RFM");
      return res.json();
    },
  });

  const { data, isLoading, isError } = useQuery<OverviewResponse>({
    queryKey: ["admin-analytics", range],
    queryFn: async () => {
      const res = await fetch(`/api/admin/analytics/overview?rangeDays=${range}`);
      if (!res.ok) throw new Error("فشل جلب البيانات");
      return res.json();
    },
    staleTime: 60_000,
  });

  const daily = data?.daily ?? [];
  const productConversion = data?.productConversion ?? [];
  const searchTop = data?.search.topQueries ?? [];
  const devices = data?.devices ?? [];
  const deviceTypes = data?.deviceTypes ?? [];
  const oses = data?.oses ?? [];
  const browsers = data?.browsers ?? [];
  const countries = data?.countries ?? [];
  const cities = data?.cities ?? [];
  const countryMetrics = data?.countryMetrics ?? [];
  const cityMetrics = data?.cityMetrics ?? [];
  const paymentLifecycle = data?.paymentLifecycle ?? [];
  const auth = data?.auth ?? { login_success: 0, login_failed: 0, signup_success: 0, signup_failed: 0 };
  const engagement = data?.engagement ?? { avg_scroll_depth: 0, product_engagement_events: 0, filter_sort_events: 0, actions: [] };
  const cohortsWeekly = data?.cohorts.weekly ?? [];
  const cohortsMonthly = data?.cohorts.monthly ?? [];
  const acquisitions = data?.acquisitions ?? { sources: [], mediums: [], campaigns: [], referrers: [] };
  const paymentFailuresByMethod = data?.paymentFailuresByMethod ?? [];
  const geoCostByCity = data?.geoCostByCity ?? [];
  const webVitalsByDevice = data?.webVitalsByDevice ?? [];

  useEffect(() => {
    if (rfmConfigData?.config) {
      const cfg = rfmConfigData.config;
      setRfmForm({
        recency: cfg.recencyWindowDays,
        frequency: cfg.frequencyWindowDays,
        monetary: cfg.monetaryWindowDays,
        weightR: cfg.weights.recency ?? 1,
        weightF: cfg.weights.frequency ?? 1,
        weightM: cfg.weights.monetary ?? 1,
      });
    }
  }, [rfmConfigData]);

  const saveConfigMutation = useMutation({
    mutationFn: async () => {
      if (!rfmForm) throw new Error("لا توجد بيانات محفوظة");
      const payload = {
        recencyWindowDays: rfmForm.recency,
        frequencyWindowDays: rfmForm.frequency,
        monetaryWindowDays: rfmForm.monetary,
        weights: {
          recency: rfmForm.weightR,
          frequency: rfmForm.weightF,
          monetary: rfmForm.weightM,
        },
      };
      const res = await fetch("/api/admin/analytics/rfm/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || "فشل حفظ الإعدادات");
      }
      return res.json();
    },
    onSuccess: () => {
      refetchRfmScores();
      refetchRfmConfig();
    },
  });

  const runRfmMutation = useMutation({
    mutationFn: async (windowLabel: "30d" | "90d") => {
      const res = await fetch("/api/admin/analytics/rfm/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ windowLabel }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || "فشل جدولة التشغيل");
      }
      return res.json();
    },
    onSuccess: () => refetchRfmScores(),
  });

  const scheduleMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/admin/analytics/rfm/schedule", { method: "POST" });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || "فشل إعداد الجدولة");
      }
      return res.json();
    },
  });

  const webVitalsForSelected = useMemo(() => {
    if (!webVitalsByDevice.length || selectedDeviceVitals === "all") return data?.webVitals ?? { cls: 0, lcp: 0, fid: 0, inp: 0 };
    const match = webVitalsByDevice.find((d) => d.device_type === selectedDeviceVitals);
    return match
      ? { cls: match.cls ?? 0, lcp: match.lcp ?? 0, fid: match.fid ?? 0, inp: match.inp ?? 0 }
      : data?.webVitals ?? { cls: 0, lcp: 0, fid: 0, inp: 0 };
  }, [data?.webVitals, selectedDeviceVitals, webVitalsByDevice]);

  const filteredProducts = useMemo(() => {
    const base = query
      ? productConversion.filter((p) => (p.name || "").toLowerCase().includes(query.toLowerCase()))
      : productConversion;
    return [...base].sort((a, b) => {
      if (sort === "views") return b.views - a.views;
      return b.views - a.views;
    });
  }, [productConversion, query, sort]);

  const filteredQueries = useMemo(() => {
    const base = query ? searchTop.filter((q) => q.query.toLowerCase().includes(query.toLowerCase())) : searchTop;
    return [...base].sort((a, b) => b.count - a.count);
  }, [searchTop, query]);

  const summarySeries = daily.map((d) => d.page_views + d.product_views + d.searches);
  const summaryChange = percentChange(summarySeries);

  const summaryCards = useMemo(() => {
    const totalOrders = geoCostByCity.reduce((acc, g) => acc + g.orders, 0);
    const totalRevenue = geoCostByCity.reduce((acc, g) => acc + g.order_total, 0);
    const totalShipping = geoCostByCity.reduce((acc, g) => acc + g.shipping_total, 0);
    const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    return [
      { label: "إجمالي الزيارات", value: data?.summary.pageViews ?? 0, helper: "يشمل الصفحات والمنتجات", icon: <LineChart className="h-5 w-5" /> },
      { label: "إكمال الدفع", value: data?.summary.completedCheckout ?? 0, helper: "تم الدفع بنجاح", icon: <ShoppingCart className="h-5 w-5" /> },
      { label: "إجمالي المبيعات", value: nf.format(totalRevenue), helper: "قيمة الطلبات المكتملة", icon: <ShoppingCart className="h-5 w-5 text-emerald-600" /> },
      { label: "متوسط الطلب", value: nf.format(avgOrderValue), helper: "معدل إنفاق العميل", icon: <BarChart2 className="h-5 w-5 text-indigo-500" /> },
      { label: "تكاليف الشحن", value: nf.format(totalShipping), helper: "إجمالي مصاريف التوصيل", icon: <LineChart className="h-5 w-5 text-red-500" /> },
      { label: "مشاهدات المنتجات", value: data?.summary.productViews ?? 0, helper: "تفاعل مباشر على الصفحات", icon: <BarChart2 className="h-5 w-5" /> },
      { label: "عمليات البحث", value: data?.summary.searches ?? 0, helper: "استعلامات المستخدمين", icon: <Search className="h-5 w-5" /> },
      { label: "استرجاع الدفع", value: data?.summary.checkoutRecovery ?? 0, helper: "محاولات إنقاذ الدفع", icon: <ShoppingCart className="h-5 w-5 text-orange-500" /> },
    ];
  }, [data?.summary, geoCostByCity]);

  const insights = useMemo<Insight[]>(() => {
    const list: Insight[] = [];

    const add = (insight: Insight) => list.push(insight);

    // 1) منتجات أداءها ضعيف
    const lowAtc = productConversion
      .filter((p) => p.views >= 60 && safeDivide(p.add_to_cart, p.views) < 0.06)
      .sort((a, b) => safeDivide(a.add_to_cart, a.views) - safeDivide(b.add_to_cart, b.views))
      .slice(0, 3);
    if (lowAtc.length) {
      add({
        title: "منتجات تحتاج إنقاذ",
        points: [
          `المنتجات ${lowAtc.map((p) => p.name || "منتج").join("، ")} تحصل على زيارات مرتفعة لكن تحويل الإضافة للسلة أقل من 6%؛ حسّن الصور، العنوان، والسعر أو وفر حزمة."`,
        ],
        severity: "high",
        tag: "المنتجات",
      });
    }

    // 2) منتجات رابحة لتعزيزها
    const winners = productConversion
      .filter((p) => p.views >= 80 && safeDivide(p.payments, p.views) >= 0.08)
      .sort((a, b) => safeDivide(b.payments, b.views) - safeDivide(a.payments, a.views))
      .slice(0, 3);
    if (winners.length) {
      add({
        title: "منتجات تستحق الترويج",
        points: [
          `المنتجات ${winners.map((p) => p.name || "منتج").join("، ")} تحقق معدل دفع مرتفع؛ زد الظهور في الواجهة الأولى وأضف حملات لإعادة الاستهداف لهذه المنتجات.`,
        ],
        severity: "medium",
        tag: "المنتجات",
      });
    }

    // 3) بحث بلا نتائج
    const noResultsRate = data?.search.noResultsRate ?? 0;
    if (noResultsRate > 0.25) {
      add({
        title: "بحث بلا نتائج",
        points: [
          `نسبة ${formatPercent(noResultsRate)} من الاستعلامات بلا نتائج؛ أضف كلمات مفتاحية للمنتجات أو أنشئ صفحات تناسب ما يبحث عنه المستخدمون الأكثر تكراراً.`,
        ],
        severity: noResultsRate > 0.4 ? "high" : "medium",
        tag: "البحث",
      });
    }

    // 4) استعلامات ضعيفة التحويل
    const weakQueries = searchTop
      .filter((q) => q.count >= 20 && safeDivide(q.select_count, q.count) < 0.1)
      .slice(0, 3);
    if (weakQueries.length) {
      add({
        title: "استعلامات لا تؤدي لنقر",
        points: [
          `استعلامات مثل ${weakQueries.map((q) => q.query).join("، ")} نادراً ما تنتهي باختيار منتج؛ حسّن نتائج البحث أو أنشئ صفحات مخصصة لها.`,
        ],
        severity: "medium",
        tag: "البحث",
      });
    }

    // 5) تسرب الدفع
    const paymentStart = paymentLifecycle.find((s) => s.step.includes("بدأ"))?.value ?? 0;
    const paymentVerified = paymentLifecycle.find((s) => s.step.includes("موثق"))?.value ?? 0;
    const paymentSuccess = paymentLifecycle.find((s) => s.step.includes("نجاح"))?.value ?? 0;
    if (paymentStart > 0 && safeDivide(paymentVerified, paymentStart) < 0.65) {
      add({
        title: "تسرب في الدفع",
        points: [
          `هناك فقدان يقارب ${formatPercent(1 - safeDivide(paymentVerified, paymentStart))} بين بدء الدفع والتوثيق؛ راجع البوابة، بدائل الدفع، ورسائل الأخطاء.`,
        ],
        severity: "high",
        tag: "الدفع",
      });
    }
    if (paymentSuccess > 0 && safeDivide(paymentVerified, paymentSuccess) < 0.8) {
      add({
        title: "التحقق أقل من النجاح",
        points: [
          `عدد عمليات التحقق أقل من النجاحات بنسبة ${formatPercent(1 - safeDivide(paymentVerified, paymentSuccess))}; تحقق من عمليات التوثيق اللاحقة أو التنبيهات من البوابة.`,
        ],
        severity: "medium",
        tag: "الدفع",
      });
    }

    // 5.1) فشل دفع حسب الطريقة
    const worstFailure = paymentFailuresByMethod
      .map((m) => ({
        ...m,
        failRate: safeDivide(m.failed, m.failed + m.succeeded + m.verified),
      }))
      .filter((m) => m.failed >= 5)
      .sort((a, b) => b.failRate - a.failRate)[0];
    if (worstFailure && worstFailure.failRate > 0.2) {
      add({
        title: "بوابة دفع بحاجة مراجعة",
        points: [
          `طريقة الدفع ${worstFailure.payment_method || "غير محدد"} تسجل معدل فشل ${formatPercent(worstFailure.failRate)} من ${worstFailure.failed} محاولات فاشلة خلال المدى؛ افحص الإعدادات أو قدّم بديل واضح للعملاء.`,
        ],
        severity: worstFailure.failRate > 0.35 ? "high" : "medium",
        tag: "الدفع",
      });
    }

    // 6) تسجيل الدخول/التسجيل
    const authFails = (auth.login_failed ?? 0) + (auth.signup_failed ?? 0);
    const authSucc = (auth.login_success ?? 0) + (auth.signup_success ?? 0);
    if (authFails > authSucc && authFails > 20) {
      add({
        title: "مشكلات الدخول والتسجيل",
        points: [
          `المحاولات الفاشلة (${authFails}) أعلى من الناجحة (${authSucc}); اختبر تدفق OTP، الحدود الزمنية، ورسائل الخطأ للمستخدمين.`,
        ],
        severity: "medium",
        tag: "المصادقة",
      });
    }

    // 7) تفاعل الصفحات
    if ((engagement.avg_scroll_depth ?? 0) < 40) {
      add({
        title: "تفاعل منخفض مع الصفحات",
        points: ["متوسط عمق التمرير أقل من 40%؛ ضع CTA أعلى الصفحة، صغّر الوصف، وأضف صوراً سريعة التحميل."],
        severity: "low",
        tag: "التجربة",
      });
    }

    // 8) تركّز مصادر الزيارات
    const totalSourceSessions = acquisitions.sources.reduce((acc, s) => acc + (s.count || 0), 0);
    const topSourceShare = totalSourceSessions > 0 ? safeDivide(acquisitions.sources[0]?.count || 0, totalSourceSessions) : 0;
    if (topSourceShare > 0.6 && (acquisitions.sources[0]?.source || "") !== "غير محدد") {
      add({
        title: "اعتماد مرتفع على مصدر واحد",
        points: [
          `المصدر ${acquisitions.sources[0]?.source} يمثل ${formatPercent(topSourceShare)} من الجلسات؛ وزّع الميزانية على مصادر أخرى لتقليل المخاطرة.`,
        ],
        severity: "medium",
        tag: "القنوات",
      });
    }

    // 9) بيانات محيل مفقودة
    const unknownRef = acquisitions.referrers.find((r) => r.referrer === "غير محدد");
    const totalRef = acquisitions.referrers.reduce((acc, r) => acc + (r.count || 0), 0);
    if (unknownRef && totalRef > 0 && safeDivide(unknownRef.count, totalRef) > 0.35) {
      add({
        title: "بيانات إحالة ناقصة",
        points: [
          `حوالي ${formatPercent(safeDivide(unknownRef.count, totalRef))} من الجلسات بدون محيل واضح؛ راجع وسوم UTM وروابط الحملات.`,
        ],
        severity: "low",
        tag: "البيانات",
      });
    }

    // 10) أداء الويب
    if ((data?.webVitals.lcp ?? 0) > 3 || (data?.webVitals.inp ?? 0) > 0.4) {
      add({
        title: "الأداء يؤثر على التحويل",
        points: [
          `متوسط LCP = ${(data?.webVitals.lcp ?? 0).toFixed(2)}s و INP = ${(data?.webVitals.inp ?? 0).toFixed(2)}؛ حسّن الصور، التخبئة، وتقليل JS على الصفحات الأعلى زيارة.`,
        ],
        severity: "medium",
        tag: "الأداء",
      });
    }

    // 10.1) أداء ضعيف على الموبايل
    const slowMobile = webVitalsByDevice.find((d) => (d.device_type || "").toLowerCase().includes("mobile"));
    if (slowMobile && (slowMobile.lcp > 3.2 || slowMobile.inp > 0.45) && slowMobile.samples >= 20) {
      add({
        title: "الموبايل بطيء",
        points: [
          `متوسط LCP للموبايل ${slowMobile.lcp.toFixed(2)}s و INP ${slowMobile.inp.toFixed(2)} على ${slowMobile.samples} عينة؛ قلل حجم الصور وفعّل التحميل الكسول للعناصر الثقيلة.`,
        ],
        severity: "medium",
        tag: "الأداء",
      });
    }

    // 11) ربحية جغرافية ضعيفة بسبب الشحن
    const geoLosers = geoCostByCity
      .map((g) => ({
        ...g,
        netAfterShipping: g.order_total - g.shipping_total,
        shipShare: safeDivide(g.shipping_total, g.order_total || 1),
      }))
      .filter((g) => g.orders >= 5 && g.shipShare > 0.25)
      .sort((a, b) => b.shipShare - a.shipShare)
      .slice(0, 2);
    if (geoLosers.length) {
      add({
        title: "تكلفة الشحن تلتهم الهامش",
        points: [
          `مدن مثل ${geoLosers.map((g) => g.city).join("، ")} يتجاوز الشحن فيها ${geoLosers[0] ? formatPercent(geoLosers[0].shipShare) : ""} من إجمالي الطلب؛ فكر في تعديل رسوم التوصيل أو إنشاء حد أدنى للسلة في هذه المناطق.`,
        ],
        severity: "medium",
        tag: "الجغرافيا",
      });
    }

    // ضمان وجود ملاحظات كافية
    if (!list.length) {
      add({
        title: "الأمور مستقرة حالياً",
        points: ["لا توجد إنذارات حالياً؛ واصل مراقبة القنوات والمنتجات الأعلى أداءً."],
        severity: "low",
        tag: "عام",
      });
    }

    return list.slice(0, 8);
  }, [productConversion, data, paymentLifecycle, auth, engagement, searchTop, acquisitions, paymentFailuresByMethod, webVitalsByDevice, geoCostByCity]);

  const renderAreaChart = () => (
    <Card className="shadow-sm border-muted/60 bg-white/80 dark:bg-slate-900/60">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg font-semibold">
          <LineChart className="h-5 w-5" /> الأداء اليومي
        </CardTitle>
        <p className="text-sm text-muted-foreground">تطور الزيارات، مشاهدات المنتجات، والبحث خلال المدى المحدد.</p>
      </CardHeader>
      <CardContent className="h-[360px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={daily} margin={{ left: 8, right: 8, top: 10, bottom: 0 }}>
            <XAxis dataKey="day" tick={{ fontSize: 12 }} interval="preserveStartEnd" />
            <YAxis tick={{ fontSize: 12 }} width={50} />
            <Tooltip formatter={(v: any) => nf.format(Number(v || 0))} labelFormatter={(l: string) => `اليوم ${l}`} />
            <Legend />
            <Area type="monotone" dataKey="page_views" name="زيارات الصفحة" stroke="#0ea5e9" fill="#0ea5e9" fillOpacity={0.18} />
            <Area type="monotone" dataKey="product_views" name="مشاهدات المنتجات" stroke="#22c55e" fill="#22c55e" fillOpacity={0.18} />
            <Area type="monotone" dataKey="searches" name="عمليات البحث" stroke="#f97316" fill="#f97316" fillOpacity={0.18} />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );

  const renderProduct = () => (
    <div className="space-y-6">
      {renderAreaChart()}
      <Card className="shadow-sm border-muted/60 bg-white/80 dark:bg-slate-900/60">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg font-semibold">
            <BarChart2 className="h-5 w-5" /> أفضل المنتجات
          </CardTitle>
          <p className="text-sm text-muted-foreground">أكثر المنتجات مشاهدة في المدى الزمني الحالي.</p>
        </CardHeader>
        <CardContent className="h-[360px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={filteredProducts} margin={{ top: 10, right: 10, left: 0, bottom: 40 }}>
              <XAxis dataKey="name" angle={-12} textAnchor="end" height={60} tick={{ fontSize: 12 }} interval={0} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip formatter={(v: any) => nf.format(Number(v || 0))} />
              <Legend />
              <Bar dataKey="views" name="مشاهدات" fill="#2563eb" radius={[6, 6, 0, 0]} />
              <Bar dataKey="add_to_cart" name="إضافات للسلة" fill="#22c55e" radius={[6, 6, 0, 0]} />
              <Bar dataKey="payments" name="مدفوعات مكتملة" fill="#f97316" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card className="shadow-sm border-muted/60 bg-white/80 dark:bg-slate-900/60">
        <CardHeader>
          <CardTitle className="text-lg font-semibold">قائمة المنتجات</CardTitle>
          <p className="text-sm text-muted-foreground">مشاهدات، إضافات للسلة، ومدفوعات لتحسين الجودة.</p>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground border-b">
              <tr>
                <th className="py-2 text-right">المنتج</th>
                <th className="py-2 text-right">المشاهدات</th>
                <th className="py-2 text-right">إضافة للسلة</th>
                <th className="py-2 text-right">مدفوعات</th>
                <th className="py-2 text-right">تحويل إضافة/مشاهدة</th>
                <th className="py-2 text-right">تحويل دفع/مشاهدة</th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.map((p) => (
                <tr key={p.product_id || p.name} className="border-b last:border-b-0">
                  <td className="py-2 font-medium">{p.name || "منتج غير معروف"}</td>
                  <td className="py-2 text-muted-foreground">{p.views.toLocaleString("ar-LY")}</td>
                  <td className="py-2 text-muted-foreground">{p.add_to_cart.toLocaleString("ar-LY")}</td>
                  <td className="py-2 text-muted-foreground">{p.payments.toLocaleString("ar-LY")}</td>
                  <td className="py-2 text-muted-foreground">{p.views ? `${((p.add_to_cart / p.views) * 100).toFixed(1)}%` : "-"}</td>
                  <td className="py-2 text-muted-foreground">{p.views ? `${((p.payments / p.views) * 100).toFixed(1)}%` : "-"}</td>
                </tr>
              ))}
              {!filteredProducts.length && (
                <tr>
                  <td colSpan={6} className="py-3 text-center text-muted-foreground">لا توجد منتجات مطابقة.</td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card className="shadow-sm border-muted/60 bg-white/80 dark:bg-slate-900/60">
        <CardHeader>
          <CardTitle className="text-lg font-semibold">تفاعل الصفحات والمنتجات</CardTitle>
          <p className="text-sm text-muted-foreground">متوسط عمق التمرير، نقرات التفاعل، واستخدام الفلاتر/الفرز.</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-lg border border-muted/60 p-3 bg-white/70 dark:bg-slate-900/60">
              <p className="text-xs text-muted-foreground">متوسط عمق التمرير</p>
              <p className="text-2xl font-bold">{engagement.avg_scroll_depth.toFixed(1)}%</p>
            </div>
            <div className="rounded-lg border border-muted/60 p-3 bg-white/70 dark:bg-slate-900/60">
              <p className="text-xs text-muted-foreground">عدد أحداث التفاعل</p>
              <p className="text-2xl font-bold">{engagement.product_engagement_events.toLocaleString("ar-LY")}</p>
            </div>
            <div className="rounded-lg border border-muted/60 p-3 bg-white/70 dark:bg-slate-900/60">
              <p className="text-xs text-muted-foreground">استخدام الفلاتر/الفرز</p>
              <p className="text-2xl font-bold">{engagement.filter_sort_events.toLocaleString("ar-LY")}</p>
            </div>
          </div>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={engagement.actions} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
                <XAxis dataKey="action" tick={{ fontSize: 12 }} interval={0} angle={-10} textAnchor="end" height={60} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip formatter={(v: any) => nf.format(Number(v || 0))} />
                <Bar dataKey="count" name="التكرار" fill="#6366f1" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderSearch = () => (
    <div className="space-y-6">
      <Card className="shadow-sm border-muted/60 bg-white/80 dark:bg-slate-900/60">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg font-semibold">
            <Search className="h-5 w-5" /> حجم البحث اليومي
          </CardTitle>
          <p className="text-sm text-muted-foreground">حركة البحث اليومية ضمن المدى المحدد.</p>
        </CardHeader>
        <CardContent className="h-[320px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={daily} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
              <XAxis dataKey="day" tick={{ fontSize: 12 }} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 12 }} width={50} />
              <Tooltip formatter={(v: any) => nf.format(Number(v || 0))} />
              <Legend />
              <Area type="monotone" dataKey="searches" name="عمليات البحث" stroke="#f97316" fill="#f97316" fillOpacity={0.2} />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 shadow-sm border-muted/60 bg-white/80 dark:bg-slate-900/60">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">أكثر الاستعلامات</CardTitle>
            <p className="text-sm text-muted-foreground">قابلة للفرز والبحث.</p>
          </CardHeader>
          <CardContent className="space-y-3">
            {filteredQueries.map((q) => (
              <div key={q.query} className="flex items-center justify-between border rounded-lg border-muted/60 p-3 bg-white/70 dark:bg-slate-900/60">
                <div>
                  <p className="font-semibold">{q.query}</p>
                  <p className="text-xs text-muted-foreground">{q.count.toLocaleString("ar-LY")} بحث / {q.select_count.toLocaleString("ar-LY")} اختيار</p>
                </div>
                <Badge variant="outline">بحث</Badge>
              </div>
            ))}
            {!filteredQueries.length && <p className="text-sm text-muted-foreground">لا توجد استعلامات مطابقة.</p>}
          </CardContent>
        </Card>

        <Card className="shadow-sm border-muted/60 bg-white/80 dark:bg-slate-900/60">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">نسبة البحث بلا نتائج</CardTitle>
            <p className="text-sm text-muted-foreground">حصة الاستعلامات التي لم تُرجع منتجات.</p>
          </CardHeader>
          <CardContent className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  dataKey="value"
                  nameKey="name"
                  data={[
                    { name: "بنتائج", value: 1 - (data?.search.noResultsRate ?? 0) },
                    { name: "بلا نتائج", value: data?.search.noResultsRate ?? 0 },
                  ]}
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={3}
                  label
                >
                  <Cell fill="#22c55e" />
                  <Cell fill="#ef4444" />
                </Pie>
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-muted/60 bg-white/80 dark:bg-slate-900/60">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">تحويلات البحث إلى نقر</CardTitle>
            <p className="text-sm text-muted-foreground">نسبة الاستعلامات التي انتهت باختيار منتج.</p>
          </CardHeader>
          <CardContent className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={[{ name: "نسبة الاختيار", value: data?.search.selectRate ?? 0 }]}>
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tickFormatter={(v) => `${(v * 100).toFixed(0)}%`} domain={[0, 1]} tick={{ fontSize: 12 }} />
                <Tooltip formatter={(v: any) => formatPercent(Number(v || 0))} />
                <Bar dataKey="value" name="معدل الاختيار" fill="#0ea5e9" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );

  const renderCheckout = () => (
    <div className="space-y-6">
      <Card className="shadow-sm border-muted/60 bg-white/80 dark:bg-slate-900/60">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg font-semibold">
            <ShoppingCart className="h-5 w-5" /> مسار الدفع
          </CardTitle>
          <p className="text-sm text-muted-foreground">انسياب المستخدمين بين المراحل الرئيسية للدفع والسلة.</p>
        </CardHeader>
        <CardContent className="h-[320px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data?.funnel ?? []} margin={{ top: 12, right: 16, left: 0, bottom: 12 }}>
              <XAxis dataKey="step" tick={{ fontSize: 12 }} interval={0} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip formatter={(v: any) => nf.format(Number(v || 0))} />
              <Legend />
              <Bar dataKey="value" name="العدد" fill="#6366f1" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="shadow-sm border-muted/60 bg-white/80 dark:bg-slate-900/60">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">دورة حياة الدفع</CardTitle>
            <p className="text-sm text-muted-foreground">من بدء الدفع حتى التوثيق.</p>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={paymentLifecycle} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
                <XAxis dataKey="step" tick={{ fontSize: 12 }} interval={0} angle={-8} textAnchor="end" height={60} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip formatter={(v: any) => nf.format(Number(v || 0))} />
                <Bar dataKey="value" name="العدد" fill="#22c55e" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-muted/60 bg-white/80 dark:bg-slate-900/60">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">عقبات طرق الدفع</CardTitle>
            <p className="text-sm text-muted-foreground">نجاح وفشل عمليات الدفع حسب طُرق الدفع لتحديد البوابات المتعثرة.</p>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={paymentFailuresByMethod}
                margin={{ top: 10, right: 10, left: 0, bottom: 30 }}
              >
                <XAxis dataKey="payment_method" tick={{ fontSize: 12 }} interval={0} angle={-10} textAnchor="end" height={60} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip formatter={(v: any) => nf.format(Number(v || 0))} />
                <Legend />
                <Bar dataKey="succeeded" stackId="pf" name="نجاح" fill="#22c55e" radius={[0, 0, 0, 0]} />
                <Bar dataKey="verified" stackId="pf" name="موثق" fill="#14b8a6" radius={[0, 0, 0, 0]} />
                <Bar dataKey="failed" stackId="pf" name="فشل" fill="#ef4444" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-muted/60 bg-white/80 dark:bg-slate-900/60">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">نجاح الدخول والتسجيل</CardTitle>
            <p className="text-sm text-muted-foreground">نسبة النجاح والفشل لجلسات المستخدم.</p>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={[
                  { name: "تسجيل الدخول", نجاح: auth.login_success, فشل: auth.login_failed },
                  { name: "التسجيل", نجاح: auth.signup_success, فشل: auth.signup_failed },
                ]}
                margin={{ top: 10, right: 10, left: 0, bottom: 20 }}
              >
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip formatter={(v: any) => nf.format(Number(v || 0))} />
                <Legend />
                <Bar dataKey="نجاح" stackId="auth" name="نجاح" fill="#22c55e" radius={[6, 6, 0, 0]} />
                <Bar dataKey="فشل" stackId="auth" name="فشل" fill="#ef4444" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-muted/60 bg-white/80 dark:bg-slate-900/60">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">التحويل والاسترداد اليومي</CardTitle>
            <p className="text-sm text-muted-foreground">تطور إضافات السلة، إكمال الدفع، واسترجاع السلات المتروكة.</p>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={daily} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
                <XAxis dataKey="day" tick={{ fontSize: 12 }} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip formatter={(v: any) => nf.format(Number(v || 0))} />
                <Legend />
                <Area type="monotone" dataKey="add_to_cart" name="إضافة للسلة" stroke="#6366f1" fill="#6366f1" fillOpacity={0.15} />
                <Area type="monotone" dataKey="completed_checkout" name="دفع ناجح" stroke="#22c55e" fill="#22c55e" fillOpacity={0.3} />
                <Area type="monotone" dataKey="checkout_recovery" name="استرجاع الدفع" stroke="#f97316" fill="#f97316" fillOpacity={0.6} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );

  const renderCustomer = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="shadow-sm border-muted/60 bg-white/80 dark:bg-slate-900/60">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg font-semibold">
              <Users className="h-5 w-5" /> إعداد نموذج RFM
            </CardTitle>
            <p className="text-sm text-muted-foreground">تعديل نوافذ 30/90 يوماً وأوزان R / F / M مباشرة.</p>
          </CardHeader>
          <CardContent className="space-y-4">
            {!rfmForm ? (
              <p className="text-sm text-muted-foreground">جاري تحميل الإعدادات...</p>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <p className="text-xs text-muted-foreground">نافذة الحداثة (يوم)</p>
                    <Input
                      type="number"
                      min={1}
                      value={rfmForm.recency}
                      onChange={(e) => setRfmForm({ ...rfmForm, recency: Number(e.target.value) })}
                    />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">نافذة التكرار (يوم)</p>
                    <Input
                      type="number"
                      min={1}
                      value={rfmForm.frequency}
                      onChange={(e) => setRfmForm({ ...rfmForm, frequency: Number(e.target.value) })}
                    />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">نافذة القيمة (يوم)</p>
                    <Input
                      type="number"
                      min={1}
                      value={rfmForm.monetary}
                      onChange={(e) => setRfmForm({ ...rfmForm, monetary: Number(e.target.value) })}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <p className="text-xs text-muted-foreground">وزن R</p>
                    <Input
                      type="number"
                      step="0.1"
                      value={rfmForm.weightR}
                      onChange={(e) => setRfmForm({ ...rfmForm, weightR: Number(e.target.value) })}
                    />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">وزن F</p>
                    <Input
                      type="number"
                      step="0.1"
                      value={rfmForm.weightF}
                      onChange={(e) => setRfmForm({ ...rfmForm, weightF: Number(e.target.value) })}
                    />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">وزن M</p>
                    <Input
                      type="number"
                      step="0.1"
                      value={rfmForm.weightM}
                      onChange={(e) => setRfmForm({ ...rfmForm, weightM: Number(e.target.value) })}
                    />
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => saveConfigMutation.mutate()} disabled={saveConfigMutation.isPending}>
                    حفظ الإعدادات
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => runRfmMutation.mutate("30d")} disabled={runRfmMutation.isPending}>
                    <Play className="h-4 w-4" /> تشغيل 30 يوم الآن
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => runRfmMutation.mutate("90d")} disabled={runRfmMutation.isPending}>
                    <Play className="h-4 w-4" /> تشغيل 90 يوم الآن
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => scheduleMutation.mutate()} disabled={scheduleMutation.isPending}>
                    <Clock className="h-4 w-4" /> جدولة ليلية تلقائية
                  </Button>
                </div>
                {(saveConfigMutation.isError || runRfmMutation.isError || scheduleMutation.isError) && (
                  <p className="text-sm text-red-600">
                    {(saveConfigMutation.error as Error)?.message || (runRfmMutation.error as Error)?.message || (scheduleMutation.error as Error)?.message}
                  </p>
                )}
                {(saveConfigMutation.isSuccess || runRfmMutation.isSuccess || scheduleMutation.isSuccess) && (
                  <p className="text-sm text-emerald-700">تم تنفيذ الإجراء بنجاح.</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-sm border-muted/60 bg-white/80 dark:bg-slate-900/60">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">توزيع الشرائح</CardTitle>
            <p className="text-sm text-muted-foreground">أعلى الشرائح المحسوبة مؤخراً.</p>
          </CardHeader>
          <CardContent className="space-y-3">
            {rfmScoresLoading ? (
              <p className="text-sm text-muted-foreground">جاري تحميل الشرائح...</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {rfmScoresData?.segments?.map((s) => (
                  <Badge key={s.segment} variant="outline" className="px-3 py-2 text-sm">
                    {s.segment} — {s.count.toLocaleString("ar-LY")}
                  </Badge>
                ))}
                {!rfmScoresData?.segments?.length && <p className="text-sm text-muted-foreground">لا توجد بيانات بعد.</p>}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-sm border-muted/60 bg-white/80 dark:bg-slate-900/60">
        <CardHeader>
          <CardTitle className="text-lg font-semibold">سجل آخر الشرائح المحسوبة</CardTitle>
          <p className="text-sm text-muted-foreground">عرض آخر ٨٠ عميلاً بحسب المجموع الكلي والنافذة الزمنية.</p>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground border-b">
              <tr>
                <th className="py-2 text-right">المستخدم</th>
                <th className="py-2 text-right">الشريحة</th>
                <th className="py-2 text-right">المجموع</th>
                <th className="py-2 text-right">R</th>
                <th className="py-2 text-right">F</th>
                <th className="py-2 text-right">M</th>
                <th className="py-2 text-right">النافذة</th>
                <th className="py-2 text-right">عدد الطلبات</th>
                <th className="py-2 text-right">إجمالي الإنفاق</th>
                <th className="py-2 text-right">آخر طلب</th>
              </tr>
            </thead>
            <tbody>
              {rfmScoresData?.scores?.map((row) => (
                <tr key={`${row.user_id}-${row.window_label}-${row.computed_at}`} className="border-b last:border-b-0">
                  <td className="py-2">
                    <div className="flex flex-col items-end">
                      <span className="font-semibold">{row.phone || row.email || row.user_id}</span>
                      <span className="text-xs text-muted-foreground">{row.user_id}</span>
                    </div>
                  </td>
                  <td className="py-2 text-muted-foreground">{row.segment}</td>
                  <td className="py-2 text-muted-foreground">{row.total_score}</td>
                  <td className="py-2 text-muted-foreground">{row.recency_score}</td>
                  <td className="py-2 text-muted-foreground">{row.frequency_score}</td>
                  <td className="py-2 text-muted-foreground">{row.monetary_score}</td>
                  <td className="py-2 text-muted-foreground">{row.window_label}</td>
                  <td className="py-2 text-muted-foreground">{row.order_count.toLocaleString("ar-LY")}</td>
                  <td className="py-2 text-muted-foreground">{Number(row.total_spent || 0).toLocaleString("ar-LY")}</td>
                  <td className="py-2 text-muted-foreground">{formatDateTime(row.last_order_at)}</td>
                </tr>
              ))}
              {!rfmScoresData?.scores?.length && (
                <tr>
                  <td colSpan={10} className="py-3 text-center text-muted-foreground">لا توجد نتائج بعد. قم بتشغيل RFM الآن.</td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );

  const renderCohorts = () => (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card className="shadow-sm border-muted/60 bg-white/80 dark:bg-slate-900/60">
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Cohort أسبوعي</CardTitle>
          <p className="text-sm text-muted-foreground">زوار ودفع أسبوعياً.</p>
        </CardHeader>
        <CardContent className="h-[320px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={cohortsWeekly} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <XAxis dataKey="period" tick={{ fontSize: 12 }} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip formatter={(v: any) => nf.format(Number(v || 0))} />
              <Legend />
              <Area type="monotone" dataKey="page_views" name="زيارات الصفحة" stroke="#0ea5e9" fill="#0ea5e9" fillOpacity={0.16} />
              <Area type="monotone" dataKey="checkout_attempts" name="محاولات الدفع" stroke="#6366f1" fill="#6366f1" fillOpacity={0.16} />
              <Area type="monotone" dataKey="payments_completed" name="مدفوعات مكتملة" stroke="#22c55e" fill="#22c55e" fillOpacity={0.16} />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card className="shadow-sm border-muted/60 bg-white/80 dark:bg-slate-900/60">
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Cohort شهري</CardTitle>
          <p className="text-sm text-muted-foreground">مقارنة شهرية للتفاعل والدفع.</p>
        </CardHeader>
        <CardContent className="h-[320px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={cohortsMonthly} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
              <XAxis dataKey="period" tick={{ fontSize: 12 }} interval={0} angle={-10} textAnchor="end" height={60} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip formatter={(v: any) => nf.format(Number(v || 0))} />
              <Legend />
              <Bar dataKey="product_views" name="مشاهدات المنتجات" fill="#2563eb" radius={[6, 6, 0, 0]} />
              <Bar dataKey="payments_completed" name="مدفوعات" fill="#22c55e" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );

  const renderInsights = () => {
    const severityToClasses: Record<string, string> = {
      high: "bg-red-50 text-red-700 border-red-100",
      medium: "bg-amber-50 text-amber-700 border-amber-100",
      low: "bg-emerald-50 text-emerald-700 border-emerald-100",
    };

    return (
      <Card className="shadow-sm border-emerald-100 bg-gradient-to-br from-emerald-50 via-white to-white dark:from-emerald-900/20 dark:via-slate-900 dark:to-slate-950">
        <CardHeader>
          <CardTitle className="text-lg font-semibold">ملاحظات ذكية</CardTitle>
          <p className="text-sm text-muted-foreground">أولوية تلقائية لأكثر ما يؤثر على النمو والتحويل.</p>
        </CardHeader>
        <CardContent className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {insights.length ? (
            insights.map((insight, idx) => (
              <div
                key={idx}
                className={
                  "rounded-lg border p-3 shadow-xs bg-white/80 dark:bg-slate-900/60 flex flex-col gap-2 " +
                  (severityToClasses[insight.severity] || "")
                }
              >
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    {insight.tag}
                  </Badge>
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-white/70 dark:bg-slate-800/70 border border-white/60">
                    {insight.severity === "high" ? "حرِج" : insight.severity === "medium" ? "مهم" : "مراقبة"}
                  </span>
                </div>
                <p className="font-semibold text-sm lg:text-base">{insight.title}</p>
                <ul className="list-disc pr-4 space-y-1 text-sm text-emerald-900 dark:text-emerald-100">
                  {insight.points.map((p, i) => (
                    <li key={i}>{p}</li>
                  ))}
                </ul>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">لا توجد ملاحظات حالياً؛ استمر في مراقبة الأداء.</p>
          )}
        </CardContent>
      </Card>
    );
  };

  const renderSummary = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {summaryCards.map((stat) => (
          <StatCard key={stat.label} label={stat.label} value={stat.value} helper={stat.helper} change={summaryChange} icon={stat.icon} />
        ))}
      </div>
      {renderInsights()}
      {renderAreaChart()}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="shadow-sm border-muted/60 bg-white/80 dark:bg-slate-900/60">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">الأجهزة المستخدمة</CardTitle>
            <p className="text-sm text-muted-foreground">توزيع الجلسات حسب الجهاز.</p>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  dataKey="count"
                  nameKey="device"
                  data={devices}
                  innerRadius={60}
                  outerRadius={95}
                  paddingAngle={3}
                  label
                >
                  {devices.map((_, idx) => (
                    <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                  ))}
                </Pie>
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-muted/60 bg-white/80 dark:bg-slate-900/60">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">جودة الأداء (Web Vitals)</CardTitle>
            <div className="flex items-center gap-2 flex-wrap text-sm text-muted-foreground">
              <p>متوسطات CLS / LCP / FID / INP</p>
              <Select value={selectedDeviceVitals} onValueChange={setSelectedDeviceVitals}>
                <SelectTrigger className="w-[160px] text-right">
                  <SelectValue placeholder="الجهاز" />
                </SelectTrigger>
                <SelectContent align="start">
                  <SelectItem value="all">كل الأجهزة</SelectItem>
                  {webVitalsByDevice.map((d) => (
                    <SelectItem key={d.device_type} value={d.device_type}>{d.device_type}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={[
                { name: "CLS", value: webVitalsForSelected.cls ?? 0 },
                { name: "LCP", value: webVitalsForSelected.lcp ?? 0 },
                { name: "FID", value: webVitalsForSelected.fid ?? 0 },
                { name: "INP", value: webVitalsForSelected.inp ?? 0 },
              ]} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip formatter={(v: any) => Number(v || 0).toFixed(3)} />
                <Bar dataKey="value" name="المتوسط" fill="#0ea5e9" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="shadow-sm border-muted/60 bg-white/80 dark:bg-slate-900/60">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">حسب نوع الجهاز</CardTitle>
            <p className="text-sm text-muted-foreground">محمول، سطح مكتب، جهاز لوحي.</p>
          </CardHeader>
          <CardContent className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={deviceTypes} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
                <XAxis dataKey="device_type" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip formatter={(v: any) => nf.format(Number(v || 0))} />
                <Bar dataKey="count" name="العدد" fill="#22c55e" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-muted/60 bg-white/80 dark:bg-slate-900/60">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">حسب نظام التشغيل</CardTitle>
            <p className="text-sm text-muted-foreground">Windows, macOS, Android, iOS وغيرها.</p>
          </CardHeader>
          <CardContent className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={oses} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
                <XAxis dataKey="os" tick={{ fontSize: 12 }} interval={0} angle={-10} textAnchor="end" height={60} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip formatter={(v: any) => nf.format(Number(v || 0))} />
                <Bar dataKey="count" name="العدد" fill="#0ea5e9" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-muted/60 bg-white/80 dark:bg-slate-900/60">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">حسب المتصفح</CardTitle>
            <p className="text-sm text-muted-foreground">Chrome، Safari، Edge، Firefox.</p>
          </CardHeader>
          <CardContent className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={browsers} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
                <XAxis dataKey="browser" tick={{ fontSize: 12 }} interval={0} angle={-10} textAnchor="end" height={60} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip formatter={(v: any) => nf.format(Number(v || 0))} />
                <Bar dataKey="count" name="العدد" fill="#f97316" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-muted/60 bg-white/80 dark:bg-slate-900/60">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">أهم البلدان</CardTitle>
            <p className="text-sm text-muted-foreground">أعلى 20 بلد حسب الزيارات.</p>
          </CardHeader>
          <CardContent className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={countries} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
                <XAxis dataKey="country" tick={{ fontSize: 12 }} interval={0} angle={-10} textAnchor="end" height={60} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip formatter={(v: any) => nf.format(Number(v || 0))} />
                <Bar dataKey="count" name="الزيارات" fill="#10b981" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-muted/60 bg-white/80 dark:bg-slate-900/60">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">أهم المدن</CardTitle>
            <p className="text-sm text-muted-foreground">أعلى 20 مدينة حسب الزيارات.</p>
          </CardHeader>
          <CardContent className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={cities} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
                <XAxis dataKey="city" tick={{ fontSize: 12 }} interval={0} angle={-10} textAnchor="end" height={60} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip formatter={(v: any) => nf.format(Number(v || 0))} />
                <Bar dataKey="count" name="الزيارات" fill="#6366f1" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {renderCohorts()}
    </div>
  );

  const renderAcquisition = () => {
    const topSource = acquisitions.sources[0];
    const topCampaign = acquisitions.campaigns[0];
    const topMedium = acquisitions.mediums[0];
    const topReferrer = acquisitions.referrers[0];

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="shadow-sm border-muted/60 bg-white/80 dark:bg-slate-900/60">
            <CardHeader>
              <CardTitle className="text-base font-semibold">أبرز مصدر</CardTitle>
              <p className="text-sm text-muted-foreground">أكثر مصدر يجلب الزيارات خلال المدى.</p>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{topSource ? topSource.source : "غير محدد"}</p>
              <p className="text-sm text-muted-foreground">{topSource ? `${nf.format(topSource.count)} جلسة · ${topSource.medium}` : "لا بيانات"}</p>
            </CardContent>
          </Card>

          <Card className="shadow-sm border-muted/60 bg-white/80 dark:bg-slate-900/60">
            <CardHeader>
              <CardTitle className="text-base font-semibold">أبرز حملة</CardTitle>
              <p className="text-sm text-muted-foreground">الحملة الأكثر جلباً للجلسات.</p>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{topCampaign ? topCampaign.campaign : "غير محدد"}</p>
              <p className="text-sm text-muted-foreground">{topCampaign ? `${nf.format(topCampaign.count)} جلسة · ${topCampaign.source}/${topCampaign.medium}` : "لا بيانات"}</p>
            </CardContent>
          </Card>

          <Card className="shadow-sm border-muted/60 bg-white/80 dark:bg-slate-900/60">
            <CardHeader>
              <CardTitle className="text-base font-semibold">أبرز وسيط</CardTitle>
              <p className="text-sm text-muted-foreground">مثل اجتماعي أو نقرات مدفوعة أو بريد إلكتروني.</p>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{topMedium ? topMedium.medium : "غير محدد"}</p>
              <p className="text-sm text-muted-foreground">{topMedium ? `${nf.format(topMedium.count)} جلسة` : "لا بيانات"}</p>
            </CardContent>
          </Card>

          <Card className="shadow-sm border-muted/60 bg-white/80 dark:bg-slate-900/60">
            <CardHeader>
              <CardTitle className="text-base font-semibold">أبرز مُحيل</CardTitle>
              <p className="text-sm text-muted-foreground">الموقع الذي أحال الزوار.</p>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold truncate" title={topReferrer?.referrer}>{topReferrer ? topReferrer.referrer : "غير محدد"}</p>
              <p className="text-sm text-muted-foreground">{topReferrer ? `${nf.format(topReferrer.count)} جلسة` : "لا بيانات"}</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="shadow-sm border-muted/60 bg-white/80 dark:bg-slate-900/60">
            <CardHeader>
              <CardTitle className="text-lg font-semibold">المصادر الأعلى</CardTitle>
              <p className="text-sm text-muted-foreground">حسب مصدر UTM مع الوسيط.</p>
            </CardHeader>
            <CardContent className="h-[320px]">
              {acquisitions.sources.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={acquisitions.sources.map((s) => ({ name: `${s.source} / ${s.medium}`, count: s.count }))}
                    margin={{ top: 10, right: 10, left: 0, bottom: 40 }}
                  >
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} interval={0} angle={-12} textAnchor="end" height={70} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip formatter={(v: any) => nf.format(Number(v || 0))} />
                    <Bar dataKey="count" name="الجلسات" fill="#0ea5e9" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-sm text-muted-foreground">لا توجد بيانات مصادر حالياً.</p>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-sm border-muted/60 bg-white/80 dark:bg-slate-900/60">
            <CardHeader>
              <CardTitle className="text-lg font-semibold">حصة الوسائط</CardTitle>
              <p className="text-sm text-muted-foreground">توزيع وسيط UTM.</p>
            </CardHeader>
            <CardContent className="h-[320px]">
              {acquisitions.mediums.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      dataKey="count"
                      nameKey="medium"
                      data={acquisitions.mediums}
                      innerRadius={60}
                      outerRadius={95}
                      paddingAngle={3}
                      label
                    >
                      {acquisitions.mediums.map((_, idx) => (
                        <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                      ))}
                    </Pie>
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-sm text-muted-foreground">لا توجد بيانات وسائط حالياً.</p>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2 shadow-sm border-muted/60 bg-white/80 dark:bg-slate-900/60">
            <CardHeader>
              <CardTitle className="text-lg font-semibold">الحملات</CardTitle>
              <p className="text-sm text-muted-foreground">حملة UTM مع المصدر والوسيط.</p>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-muted-foreground border-b">
                  <tr>
                    <th className="py-2 text-right">الحملة</th>
                    <th className="py-2 text-right">المصدر</th>
                    <th className="py-2 text-right">الوسيط</th>
                    <th className="py-2 text-right">الجلسات</th>
                  </tr>
                </thead>
                <tbody>
                  {acquisitions.campaigns.map((c) => (
                    <tr key={`${c.campaign}-${c.source}-${c.medium}`} className="border-b last:border-b-0">
                      <td className="py-2 font-medium">{c.campaign}</td>
                      <td className="py-2 text-muted-foreground">{c.source}</td>
                      <td className="py-2 text-muted-foreground">{c.medium}</td>
                      <td className="py-2 text-muted-foreground">{c.count.toLocaleString("ar-LY")}</td>
                    </tr>
                  ))}
                  {!acquisitions.campaigns.length && (
                    <tr>
                      <td colSpan={4} className="py-3 text-center text-muted-foreground">لا توجد بيانات حملات.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>

          <Card className="shadow-sm border-muted/60 bg-white/80 dark:bg-slate-900/60">
            <CardHeader>
              <CardTitle className="text-lg font-semibold">المحيلون</CardTitle>
              <p className="text-sm text-muted-foreground">أعلى محيل مسجّل.</p>
            </CardHeader>
            <CardContent className="space-y-3">
              {acquisitions.referrers.map((r) => (
                <div key={r.referrer} className="flex items-center justify-between rounded-lg border border-muted/60 p-3 bg-white/70 dark:bg-slate-900/60">
                  <div className="truncate" title={r.referrer}>
                    <p className="font-semibold truncate">{r.referrer}</p>
                  </div>
                  <Badge variant="outline">{r.count.toLocaleString("ar-LY")} جلسة</Badge>
                </div>
              ))}
              {!acquisitions.referrers.length && <p className="text-sm text-muted-foreground">لا توجد بيانات محيلين حالياً.</p>}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  };

  const renderGeo = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="shadow-sm border-muted/60 bg-white/80 dark:bg-slate-900/60">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">أعلى البلدان دفعاً</CardTitle>
            <p className="text-sm text-muted-foreground">البلدان المرتبة حسب المدفوعات المكتملة.</p>
          </CardHeader>
          <CardContent className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={countryMetrics} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
                <XAxis dataKey="country" tick={{ fontSize: 12 }} interval={0} angle={-10} textAnchor="end" height={60} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip formatter={(v: any) => nf.format(Number(v || 0))} />
                <Bar dataKey="payments_completed" name="مدفوعات مكتملة" fill="#22c55e" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-muted/60 bg-white/80 dark:bg-slate-900/60">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">أعلى المدن دفعاً</CardTitle>
            <p className="text-sm text-muted-foreground">ترتيب المدن حسب المدفوعات المكتملة.</p>
          </CardHeader>
          <CardContent className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={cityMetrics} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
                <XAxis dataKey="city" tick={{ fontSize: 12 }} interval={0} angle={-10} textAnchor="end" height={60} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip formatter={(v: any) => nf.format(Number(v || 0))} />
                <Bar dataKey="payments_completed" name="مدفوعات مكتملة" fill="#0ea5e9" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="shadow-sm border-muted/60 bg-white/80 dark:bg-slate-900/60">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">البلدان حسب المشاهدات</CardTitle>
            <p className="text-sm text-muted-foreground">مشاهدات الصفحات والمنتجات لكل بلد.</p>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground border-b">
                <tr>
                  <th className="py-2 text-right">البلد</th>
                  <th className="py-2 text-right">مشاهدات الصفحة</th>
                  <th className="py-2 text-right">مشاهدات المنتج</th>
                  <th className="py-2 text-right">مدفوعات</th>
                </tr>
              </thead>
              <tbody>
                {countryMetrics.map((c) => (
                  <tr key={c.country} className="border-b last:border-b-0">
                    <td className="py-2 font-medium">{c.country}</td>
                    <td className="py-2 text-muted-foreground">{c.page_views.toLocaleString("ar-LY")}</td>
                    <td className="py-2 text-muted-foreground">{c.product_views.toLocaleString("ar-LY")}</td>
                    <td className="py-2 text-muted-foreground">{c.payments_completed.toLocaleString("ar-LY")}</td>
                  </tr>
                ))}
                {!countryMetrics.length && (
                  <tr>
                    <td colSpan={4} className="py-3 text-center text-muted-foreground">لا توجد بيانات بلدان حالياً.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-muted/60 bg-white/80 dark:bg-slate-900/60">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">المدن حسب المشاهدات</CardTitle>
            <p className="text-sm text-muted-foreground">مشاهدات الصفحات والمنتجات لكل مدينة.</p>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground border-b">
                <tr>
                  <th className="py-2 text-right">المدينة</th>
                  <th className="py-2 text-right">البلد</th>
                  <th className="py-2 text-right">مشاهدات الصفحة</th>
                  <th className="py-2 text-right">مشاهدات المنتج</th>
                  <th className="py-2 text-right">مدفوعات</th>
                </tr>
              </thead>
              <tbody>
                {cityMetrics.map((c) => (
                  <tr key={`${c.city}-${c.country}`} className="border-b last:border-b-0">
                    <td className="py-2 font-medium">{c.city}</td>
                    <td className="py-2 text-muted-foreground">{c.country}</td>
                    <td className="py-2 text-muted-foreground">{c.page_views.toLocaleString("ar-LY")}</td>
                    <td className="py-2 text-muted-foreground">{c.product_views.toLocaleString("ar-LY")}</td>
                    <td className="py-2 text-muted-foreground">{c.payments_completed.toLocaleString("ar-LY")}</td>
                  </tr>
                ))}
                {!cityMetrics.length && (
                  <tr>
                    <td colSpan={5} className="py-3 text-center text-muted-foreground">لا توجد بيانات مدن حالياً.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-sm border-muted/60 bg-white/80 dark:bg-slate-900/60">
        <CardHeader>
          <CardTitle className="text-lg font-semibold">ربحية الشحن وتكاليفه حسب المدينة</CardTitle>
          <p className="text-sm text-muted-foreground">تحليل تكاليف الشحن مقارنة بقيمة الطلبات للمساعدة في تسعير مناطق التوصيل.</p>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground border-b">
              <tr>
                <th className="py-2 text-right">المدينة</th>
                <th className="py-2 text-right">المنطقة (المحافظة)</th>
                <th className="py-2 text-right">الطلبات</th>
                <th className="py-2 text-right">إجمالي الطلبات</th>
                <th className="py-2 text-right">إجمالي الشحن</th>
                <th className="py-2 text-right">نسبة الشحن للطلب</th>
              </tr>
            </thead>
            <tbody>
              {geoCostByCity.map((g) => {
                const shipShare = safeDivide(g.shipping_total, g.order_total || 1);
                return (
                  <tr key={`${g.city}-${g.region}`} className="border-b last:border-b-0">
                    <td className="py-2 font-medium">{g.city}</td>
                    <td className="py-2 text-muted-foreground">{g.region || "-"}</td>
                    <td className="py-2 text-muted-foreground">{g.orders.toLocaleString("ar-LY")}</td>
                    <td className="py-2 text-muted-foreground">{nf.format(g.order_total)} د.ل</td>
                    <td className="py-2 text-muted-foreground">{nf.format(g.shipping_total)} د.ل</td>
                    <td className="py-2">
                      <span
                        className={cn(
                          "px-2 py-1 rounded-full text-xs font-semibold",
                          shipShare > 0.25 ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"
                        )}
                      >
                        {formatPercent(shipShare)}
                      </span>
                    </td>
                  </tr>
                );
              })}
              {!geoCostByCity.length && (
                <tr>
                  <td colSpan={6} className="py-3 text-center text-muted-foreground">لا توجد بيانات جغرافية للتكاليف حالياً.</td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );

  const renderBody = () => {
    if (isLoading) {
      return (
        <div className="space-y-4">
          <LoadingCard title="جاري التحميل" />
          <LoadingCard title="جاري التحميل" />
        </div>
      );
    }
    if (isError || !data) {
      return <p className="text-sm text-red-600">تعذر جلب التحليلات الآن. حاول مجدداً.</p>;
    }

    switch (activeTab) {
      case "product":
        return renderProduct();
      case "search":
        return renderSearch();
      case "customer":
        return renderCustomer();
      case "checkout":
        return renderCheckout();
      case "geo":
        return renderGeo();
      case "acquisition":
        return renderAcquisition();
      default:
        return renderSummary();
    }
  };

  return (
    <div className="w-full px-4 py-6 md:py-8 lg:py-10 bg-gradient-to-b from-slate-50 to-white dark:from-slate-950 dark:to-slate-900" dir="rtl">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold">لوحة تحليلات المتجر</h1>
            <p className="text-sm text-muted-foreground">بيانات مباشرة مع رسوم أكبر وأسهل قراءة.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {ranges.map((r) => (
              <Button key={r.key} variant={range === r.key ? "default" : "secondary"} size="sm" onClick={() => setRange(r.key)}>
                {r.label}
              </Button>
            ))}
          </div>
        </div>

        <Card className="shadow-sm border-muted/60 bg-white/80 dark:bg-slate-900/60">
          <CardContent className="p-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-1 items-center gap-2">
              <Input
                placeholder="ابحث داخل التحليلات (منتج، استعلام)"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="text-right"
              />
            </div>
            <div className="flex items-center gap-2 w-full md:w-auto">
              <Select value={sort} onValueChange={setSort}>
                <SelectTrigger className="w-full md:w-[200px]">
                  <SelectValue placeholder="ترتيب" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="views">أعلى مشاهدات</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" onClick={() => setQuery("")}>إعادة تعيين</Button>
            </div>
          </CardContent>
        </Card>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <div className="w-full overflow-x-auto">
            <TabsList className="flex min-w-max gap-2 px-1">
              {tabs.map((t) => (
                <TabsTrigger key={t.key} value={t.key} className="text-sm whitespace-nowrap">
                  {t.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
          <div>{renderBody()}</div>
        </Tabs>
      </div>
    </div>
  );
}