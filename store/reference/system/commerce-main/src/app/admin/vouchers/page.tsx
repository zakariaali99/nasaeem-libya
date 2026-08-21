"use client"

import React, { useState } from "react"
import Link from "next/link"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { format } from "date-fns"
import {
    Ticket,
    Plus,
    Link as LinkIcon,
    ShieldCheck,
    AlertCircle,
    CheckCircle2,
    Trash2,
    RefreshCw,
    KeySquare,
    Copy,
    PowerOff,
    Power,
    Banknote
} from "lucide-react"
import {
    Card,
    CardHeader,
    CardTitle,
    CardDescription,
    CardContent,
    CardFooter
} from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from "@/components/ui/table"
import { useToast } from "@/components/ui/use-toast"
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert"

export default function VouchersAdminPage() {
    const { show } = useToast();
    const queryClient = useQueryClient();
    const [activeTab, setActiveTab] = useState("vouchers");

    // Fetch Vouchers
    const { data: vouchersData, isLoading: vouchersLoading } = useQuery({
        queryKey: ["admin-vouchers"],
        queryFn: async () => {
            const res = await fetch("/api/admin/vouchers")
            if (!res.ok) throw new Error("Failed to fetch vouchers")
            return res.json()
        }
    })

    // Fetch Partners
    const { data: partnersData, isLoading: partnersLoading } = useQuery({
        queryKey: ["admin-partners"],
        queryFn: async () => {
            const res = await fetch("/api/admin/vouchers/partners")
            if (!res.ok) throw new Error("Failed to fetch partners")
            return res.json()
        }
    })

    // State for Issue Voucher Form
    const [amount, setAmount] = useState<number>(0);
    const [currency, setCurrency] = useState("LYD");
    const [count, setCount] = useState<number>(1);
    const [expiresAt, setExpiresAt] = useState("");

    // Issue Manual Vouchers
    const issueMutation = useMutation({
        mutationFn: async (payload: any) => {
            const res = await fetch("/api/admin/vouchers", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            })
            if (!res.ok) {
                const err = await res.json()
                throw new Error(err.error || "Failed to issue vouchers")
            }
            return res.json()
        },
        onSuccess: (data) => {
            show({ title: "تم الإصدار", description: data.message, variant: "success" });
            queryClient.invalidateQueries({ queryKey: ["admin-vouchers"] })
            // Reset form
            setAmount(0)
            setCount(1)
        },
        onError: (err: any) => {
            show({ title: "خطأ", description: err.message, variant: "error" });
        }
    })

    // State for Partner App Form
    const [partnerName, setPartnerName] = useState("");
    const [newCredentials, setNewCredentials] = useState<any>(null);

    // Create Partner Account
    const createPartnerMutation = useMutation({
        mutationFn: async (payload: any) => {
            const res = await fetch("/api/admin/vouchers/partners", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            })
            if (!res.ok) {
                const err = await res.json()
                throw new Error(err.error || "Failed to create partner app")
            }
            return res.json()
        },
        onSuccess: (data) => {
            show({ title: "تم الإنشاء", description: "تم إنشاء حساب الشريك بنجاح", variant: "success" });
            setNewCredentials(data.credentials)
            queryClient.invalidateQueries({ queryKey: ["admin-partners"] })
            setPartnerName("");
        },
        onError: (err: any) => {
            show({ title: "خطأ", description: err.message, variant: "error" });
        }
    })

    // Update Partner Status
    const updatePartnerStatusMutation = useMutation({
        mutationFn: async ({ id, status }: { id: string, status: string }) => {
            const res = await fetch(`/api/admin/vouchers/partners/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status })
            })
            if (!res.ok) throw new Error("Failed to update status")
            return res.json()
        },
        onSuccess: () => {
            show({ title: "تم التحديث", description: "تم تحديث حالة الشريك", variant: "success" })
            queryClient.invalidateQueries({ queryKey: ["admin-partners"] })
        },
        onError: (err: any) => {
            show({ title: "خطأ", description: err.message, variant: "error" })
        }
    });

    // Record Partner Payment
    const recordPaymentMutation = useMutation({
        mutationFn: async ({ id, currentSettled, addAmount }: { id: string, currentSettled: number, addAmount: number }) => {
            const res = await fetch(`/api/admin/vouchers/partners/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ settledAmount: currentSettled + addAmount })
            })
            if (!res.ok) throw new Error("Failed to record payment")
            return res.json()
        },
        onSuccess: () => {
            show({ title: "تم التسجيل", description: "تم تحديث الدفعات", variant: "success" })
            queryClient.invalidateQueries({ queryKey: ["admin-partners"] })
        },
        onError: (err: any) => {
            show({ title: "خطأ", description: err.message, variant: "error" })
        }
    });

    return (
        <div className="container mx-auto p-6 max-w-7xl space-y-8" dir="rtl">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">إدارة القسائم (Vouchers)</h1>
                    <p className="text-muted-foreground mt-2">
                        التحكم الكامل في إصدار ومتابعة القسائم وتكامل شركاء B2B بأمان.
                    </p>
                </div>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
                <TabsList className="bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
                    <TabsTrigger value="vouchers" className="flex gap-2">
                        <Ticket className="w-4 h-4" /> القسائم النشطة
                    </TabsTrigger>
                    <TabsTrigger value="issue" className="flex gap-2">
                        <Plus className="w-4 h-4" /> إصدار قسائم
                    </TabsTrigger>
                    <TabsTrigger value="partners" className="flex gap-2">
                        <LinkIcon className="w-4 h-4" /> شركاء الربط (B2B)
                    </TabsTrigger>
                </TabsList>

                {/* VOUCHERS LIST */}
                <TabsContent value="vouchers" className="space-y-4 animate-in fade-in-50 duration-500">
                    <Card>
                        <CardHeader>
                            <CardTitle>أحدث القسائم المصدرة</CardTitle>
                            <CardDescription>عرض لمائة قسيمة أخيرة مصدرة وحالتها الحالية.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {vouchersLoading ? (
                                <div className="py-8 flex justify-center text-muted-foreground">
                                    <RefreshCw className="w-6 h-6 animate-spin" />
                                </div>
                            ) : (
                                <div className="rounded-md border overflow-x-auto">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead className="text-right">الكود (أخر 4)</TableHead>
                                                <TableHead className="text-right">القيمة</TableHead>
                                                <TableHead className="text-right">الحملة / المصدر</TableHead>
                                                <TableHead className="text-right">الحالة</TableHead>
                                                <TableHead className="text-right">تاريخ الإصدار</TableHead>
                                                <TableHead className="text-right">الاستخدام</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {vouchersData?.vouchers?.length === 0 && (
                                                <TableRow>
                                                    <TableCell colSpan={6} className="text-center py-6 text-muted-foreground">
                                                        لا توجد قسائم مصدرة.
                                                    </TableCell>
                                                </TableRow>
                                            )}
                                            {vouchersData?.vouchers?.map((v: any) => (
                                                <TableRow key={v.id}>
                                                    <TableCell className="font-mono font-medium">
                                                        ****-{v.codeLast4}
                                                    </TableCell>
                                                    <TableCell>
                                                        {v.amount} {v.currency}
                                                    </TableCell>
                                                    <TableCell>
                                                        {v.campaign?.name || "بدون حملة"}
                                                        <br />
                                                        <span className="text-xs text-muted-foreground">
                                                            {v.campaign?.issuerType === "internal" ? "إصدار داخلي" : "تطبيق شريك"}
                                                        </span>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge variant={v.status === "active" ? "default" : (v.status === "redeemed" ? "secondary" : "destructive")}>
                                                            {v.status === "active" && "فعالة"}
                                                            {v.status === "redeemed" && "مستخدمة"}
                                                            {v.status === "void" && "ملغاة"}
                                                            {v.status === "expired" && "منتهية"}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell dir="ltr" className="text-right">
                                                        {format(new Date(v.createdAt), "yyyy-MM-dd HH:mm")}
                                                    </TableCell>
                                                    <TableCell>
                                                        {v.redeemedByUser ? (
                                                            <div className="text-sm">
                                                                <Link
                                                                    href={`/admin/users/${v.redeemedByUser.id}`}
                                                                    className="font-medium text-blue-600 hover:text-blue-800 hover:underline transition-colors block"
                                                                >
                                                                    {v.redeemedByUser.name || "مستخدم"}
                                                                </Link>
                                                                <Link
                                                                    href={`/admin/users/${v.redeemedByUser.id}`}
                                                                    className="text-xs text-muted-foreground hover:text-blue-600 transition-colors block mt-0.5"
                                                                >
                                                                    {v.redeemedByUser.phoneNumber || v.redeemedByUser.email}
                                                                </Link>
                                                                <p className="text-xs text-green-600 mt-1" dir="ltr">
                                                                    {v.redeemedAt && format(new Date(v.redeemedAt), "yyyy-MM-dd HH:mm")}
                                                                </p>
                                                            </div>
                                                        ) : (
                                                            <span className="text-muted-foreground text-sm">-</span>
                                                        )}
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* ISSUE VOUCHER */}
                <TabsContent value="issue" className="animate-in fade-in-50 duration-500">
                    <Card className="max-w-2xl mx-auto">
                        <CardHeader>
                            <CardTitle>إصدار قسائم تعويض يدوية</CardTitle>
                            <CardDescription>
                                يتم إصدار هذه القسائم مباشرة وتكون صالحة للاستخدام. يمكنك إصدار حتى 100 قسيمة في المرة الواحدة وتصدير أكوادها فور الإصدار.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="amount">قيمة القسيمة</Label>
                                    <Input
                                        id="amount"
                                        type="number"
                                        value={amount}
                                        onChange={(e) => setAmount(Number(e.target.value))}
                                        placeholder="مثال: 50"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>العملة</Label>
                                    <Input value="LYD" readOnly className="bg-slate-50 opacity-70" />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="count">عدد القسائم</Label>
                                    <Input
                                        id="count"
                                        type="number"
                                        value={count}
                                        onChange={(e) => setCount(Number(e.target.value))}
                                        min={1}
                                        max={100}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="expiresAt">تاريخ الصلاحية (اختياري)</Label>
                                    <Input
                                        id="expiresAt"
                                        type="datetime-local"
                                        value={expiresAt}
                                        onChange={(e) => setExpiresAt(e.target.value)}
                                    />
                                </div>
                            </div>
                        </CardContent>
                        <CardFooter className="bg-slate-50 px-6 py-4 rounded-b-lg border-t gap-4 justify-between">
                            <Button
                                disabled={amount <= 0 || issueMutation.isPending}
                                onClick={() => issueMutation.mutate({ amount, currency, count, expiresAt })}
                                className="w-full gap-2"
                            >
                                {issueMutation.isPending && <RefreshCw className="w-4 h-4 animate-spin" />}
                                إصدار الآن
                            </Button>
                        </CardFooter>
                    </Card>

                    {issueMutation.data?.vouchers && (
                        <Card className="max-w-2xl mx-auto mt-6 border-emerald-200 bg-emerald-50">
                            <CardHeader>
                                <CardTitle className="text-emerald-800 flex items-center gap-2">
                                    <CheckCircle2 className="w-5 h-5" />
                                    تم الإصدار بنجاح
                                </CardTitle>
                                <CardDescription className="text-emerald-700">
                                    تم إنشاء الأكواد التالية. <strong>تنبيه: لن تستطيع استرجاع الأكواد لاحقاً! يرجى نسخها الآن!</strong>
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="bg-white p-4 rounded border font-mono text-sm max-h-60 overflow-y-auto">
                                    {issueMutation.data.vouchers.map((v: any) => (
                                        <div key={v.id} className="py-1 flex justify-between border-b last:border-0 border-dashed">
                                            <span>{v.code}</span>
                                            <span className="text-emerald-600 font-semibold">{v.amount} {v.currency}</span>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </TabsContent>

                {/* PARTNER INTEGRATIONS */}
                <TabsContent value="partners" className="space-y-8 animate-in fade-in-50 duration-500">
                    <Card>
                        <CardHeader>
                            <CardTitle>إنشاء تطبيق شريك (B2B)</CardTitle>
                            <CardDescription>
                                توليد مفاتيح API آمنة تسمح لأنظمة خارجية بإصدار قسائم متجرنا كحملات ترويجية لهم.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="max-w-md space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="partnerName">اسم الشريك أو التطبيق</Label>
                                    <div className="flex gap-4">
                                        <Input
                                            id="partnerName"
                                            placeholder="مثال: تطبيق المصرف التجاري"
                                            value={partnerName}
                                            onChange={e => setPartnerName(e.target.value)}
                                        />
                                        <Button
                                            disabled={!partnerName || createPartnerMutation.isPending}
                                            onClick={() => createPartnerMutation.mutate({ name: partnerName })}
                                            className="w-32"
                                        >
                                            إنشاء
                                        </Button>
                                    </div>
                                </div>
                            </div>

                            {newCredentials && (
                                <Alert className="bg-amber-50 border-amber-300 mt-6 max-w-2xl text-amber-900">
                                    <KeySquare className="h-6 w-6 text-amber-600 mb-2" />
                                    <AlertTitle className="text-amber-800 font-bold text-lg">مفاتيح الربط (API Credentials)</AlertTitle>
                                    <AlertDescription className="mt-2 text-base">
                                        <p className="font-semibold text-red-700 bg-red-50 p-3 rounded-md mb-4 border border-red-200">
                                            يرجى حفظ المفتاح السري فوراً؛ لن يتم عرضه مرة أخرى لدواعي أمنية.
                                        </p>
                                        <div className="bg-white p-4 rounded-md border border-amber-200 font-mono text-sm space-y-4 shadow-sm" dir="ltr">
                                            <div>
                                                <span className="text-muted-foreground block text-xs uppercase tracking-wider font-sans mb-1 font-semibold">API Key ID (معرف المفتاح):</span>
                                                <div className="flex items-center gap-2">
                                                    <strong className="select-all flex-1 p-2 bg-slate-50 border rounded-md text-slate-800 break-all">{newCredentials.apiKeyId}</strong>
                                                    <Button variant="outline" size="icon" onClick={() => { navigator.clipboard.writeText(newCredentials.apiKeyId); show({ title: "تم النسخ", description: "تم نسخ معرف المفتاح!", variant: "success" }); }}>
                                                        <Copy className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </div>
                                            <div>
                                                <span className="text-muted-foreground block text-xs uppercase tracking-wider font-sans mb-1 font-semibold">Secret Key (المفتاح السري لتوقيع HMAC):</span>
                                                <div className="flex items-center gap-2">
                                                    <strong className="select-all flex-1 p-2 bg-slate-50 border rounded-md text-emerald-700 break-all">{newCredentials.apiSecret}</strong>
                                                    <Button variant="outline" size="icon" onClick={() => { navigator.clipboard.writeText(newCredentials.apiSecret); show({ title: "تم النسخ", description: "تم نسخ المفتاح السري!", variant: "success" }); }}>
                                                        <Copy className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                    </AlertDescription>
                                </Alert>
                            )}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>الشركاء المسجلين</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {partnersLoading ? (
                                <div className="py-8 flex justify-center text-muted-foreground">
                                    <RefreshCw className="w-6 h-6 animate-spin" />
                                </div>
                            ) : (
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="text-right">اسم الشريك</TableHead>
                                            <TableHead className="text-right">حالة الربط</TableHead>
                                            <TableHead className="text-right">إجمالي العجز (قسائم حقيقية)</TableHead>
                                            <TableHead className="text-right">المدفوع (المسدد)</TableHead>
                                            <TableHead className="text-right">المتبقي (المطلوب دفعه)</TableHead>
                                            <TableHead className="text-center">إجراءات</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {partnersData?.partners?.length === 0 && (
                                            <TableRow>
                                                <TableCell colSpan={6} className="text-center py-6 text-muted-foreground">
                                                    لا توجد تطبيقات شركاء مسجلة.
                                                </TableCell>
                                            </TableRow>
                                        )}
                                        {partnersData?.partners?.map((p: any) => {
                                            const owed = p.totalIssuedAmount || 0;
                                            const settled = p.settledAmount || 0;
                                            const balance = owed - settled;
                                            return (
                                                <TableRow key={p.id}>
                                                    <TableCell>
                                                        <div className="font-semibold">{p.name}</div>
                                                        <div className="font-mono text-xs text-muted-foreground mt-1">ID: {p.apiKeyId}</div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge variant={p.status === "active" ? "default" : "secondary"}>
                                                            {p.status === "active" ? "فعال" : "معطل"}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="font-semibold">{owed.toLocaleString()} LYD</TableCell>
                                                    <TableCell className="text-emerald-700 font-semibold">{settled.toLocaleString()} LYD</TableCell>
                                                    <TableCell className="text-red-700 font-bold">{balance.toLocaleString()} LYD</TableCell>
                                                    <TableCell className="text-center">
                                                        <div className="flex justify-center gap-2">
                                                            <Button
                                                                variant={p.status === "active" ? "destructive" : "default"}
                                                                size="sm"
                                                                onClick={() => {
                                                                    if (confirm(`هل أنت متأكد من ${p.status === "active" ? "تعطيل" : "تفعيل"} هذا الشريك؟`)) {
                                                                        updatePartnerStatusMutation.mutate({ id: p.id, status: p.status === "active" ? "inactive" : "active" });
                                                                    }
                                                                }}
                                                                title={p.status === "active" ? "تعطيل التطبيق" : "تفعيل التطبيق"}
                                                            >
                                                                {p.status === "active" ? <PowerOff className="w-4 h-4" /> : <Power className="w-4 h-4" />}
                                                            </Button>
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                className="border-primary text-primary hover:bg-primary hover:text-white"
                                                                onClick={() => {
                                                                    const amountStr = window.prompt("أدخل قيمة الدفعة المستلمة من هذا الشريك (بالدينار الليبي):", "0");
                                                                    if (amountStr) {
                                                                        const added = parseFloat(amountStr);
                                                                        if (!isNaN(added) && added > 0) {
                                                                            recordPaymentMutation.mutate({ id: p.id, currentSettled: settled, addAmount: added });
                                                                        }
                                                                    }
                                                                }}
                                                                title="تسجيل دفعة مستلمة"
                                                            >
                                                                <Banknote className="w-4 h-4" />
                                                            </Button>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            )
                                        })}
                                    </TableBody>
                                </Table>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    )
}
