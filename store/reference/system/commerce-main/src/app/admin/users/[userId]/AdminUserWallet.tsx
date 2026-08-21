"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Wallet, CheckCircle2, RefreshCw, ArrowDownRight, ArrowUpRight, Plus, Minus } from "lucide-react";
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/components/ui/use-toast";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { WalletTransactionTable } from "@/components/WalletTransactionTable";

export default function AdminUserWallet({ userId }: { userId: string }) {
    const { show } = useToast();
    const queryClient = useQueryClient();

    // Adjustment states
    const [isAdjustOpen, setIsAdjustOpen] = useState(false);
    const [adjustMode, setAdjustMode] = useState<"credit" | "debit">("credit");
    const [amount, setAmount] = useState("");
    const [reason, setReason] = useState("");
    const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());

    // Fetch Wallet Balance
    const { data: walletData, isLoading: walletLoading } = useQuery({
        queryKey: ["admin-user-wallet", userId],
        queryFn: async () => {
            const res = await fetch(`/api/admin/users/${userId}/wallet`);
            if (!res.ok) throw new Error("Failed to fetch wallet status");
            return res.json();
        }
    });

    // Fetch Wallet Transactions
    const { data: txData, isLoading: txLoading } = useQuery({
        queryKey: ["admin-user-wallet-tx", userId],
        queryFn: async () => {
            const res = await fetch(`/api/admin/users/${userId}/wallet/transactions`);
            if (!res.ok) throw new Error("Failed to fetch transactions");
            return res.json();
        }
    });

    // Adjust Mutation (Credit/Debit)
    const adjustMutation = useMutation({
        mutationFn: async ({ amt, rsn }: { amt: number, rsn: string }) => {
            const res = await fetch(`/api/admin/users/${userId}/wallet`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    amount: adjustMode === "credit" ? amt : -amt,
                    reason: rsn,
                    idempotencyKey
                })
            });
            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.error || "فشل تعديل المحفظة");
            }
            return res.json();
        },
        onSuccess: (data) => {
            show({
                title: "تمت العملية بنجاح",
                description: `تم تحديث الرصيد بنجاح. الرصيد الجديد: ${data.newBalance}`,
                variant: "success"
            });
            setIsAdjustOpen(false);
            setAmount("");
            setReason("");
            setIdempotencyKey(crypto.randomUUID());
            queryClient.invalidateQueries({ queryKey: ["admin-user-wallet", userId] });
            queryClient.invalidateQueries({ queryKey: ["admin-user-wallet-tx", userId] });
        },
        onError: (err: any) => {
            show({ title: "خطأ", description: err.message, variant: "error" });
        }
    });

    const handleAdjust = (e: React.FormEvent) => {
        e.preventDefault();
        const parsedAmount = parseFloat(amount);
        if (!parsedAmount || parsedAmount <= 0) {
            show({ title: "خطأ", description: "الرجاء إدخال مبلغ صحيح أكبر من الصفر", variant: "error" });
            return;
        }
        if (!reason.trim()) {
            show({ title: "خطأ", description: "الرجاء إدخال سبب التعديل", variant: "error" });
            return;
        }
        adjustMutation.mutate({ amt: parsedAmount, rsn: reason.trim() });
    };

    const openAdjustDialog = (mode: "credit" | "debit") => {
        setAdjustMode(mode);
        setIsAdjustOpen(true);
    };

    const balance = walletData?.wallet?.currentBalance || 0;
    const currency = walletData?.wallet?.currency || "LYD";

    return (
        <div className="space-y-6" dir="rtl">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Wallet Balance Card */}
                <Card className="bg-white border-slate-200 shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 left-0 p-4 opacity-10">
                        <Wallet className="w-24 h-24" />
                    </div>
                    <CardHeader>
                        <CardTitle className="text-lg text-slate-700 flex items-center gap-2">
                            <Wallet className="w-5 h-5" />
                            رصيد محفظة المستخدم
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {walletLoading ? (
                            <RefreshCw className="w-5 h-5 animate-spin text-slate-400" />
                        ) : (
                            <div>
                                <span className={`text-4xl font-bold ${balance < 0 ? 'text-red-500' : 'text-slate-900'}`}>{balance}</span>
                                <span className="text-lg text-slate-500 mr-2 font-semibold tracking-wider uppercase">{currency}</span>
                            </div>
                        )}
                        <p className="text-sm text-slate-500 mt-2">يمكنك إضافة أو خصم رصيد يدوياً من هذه اللوحة.</p>

                        <div className="flex gap-2 mt-6">
                            <Button
                                variant="outline"
                                className="flex-1 border-emerald-500 text-emerald-600 hover:bg-emerald-50"
                                onClick={() => openAdjustDialog("credit")}
                            >
                                <Plus className="w-4 h-4 ml-2" /> إضافة رصيد
                            </Button>
                            <Button
                                variant="outline"
                                className="flex-1 border-red-500 text-red-600 hover:bg-red-50"
                                onClick={() => openAdjustDialog("debit")}
                            >
                                <Minus className="w-4 h-4 ml-2" /> خصم رصيد
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Adjust Wallet Dialog */}
            <Dialog open={isAdjustOpen} onOpenChange={setIsAdjustOpen}>
                <DialogContent dir="rtl">
                    <DialogHeader>
                        <DialogTitle className={adjustMode === "credit" ? "text-emerald-600" : "text-red-600"}>
                            {adjustMode === "credit" ? "إضافة رصيد للمحفظة" : "خصم رصيد من المحفظة"}
                        </DialogTitle>
                        <DialogDescription>
                            هذا الإجراء سيقوم بـ {adjustMode === "credit" ? "إيداع" : "سحب"} المبلغ المحدد {adjustMode === "credit" ? "إلى" : "من"} محفظة المستخدم.
                        </DialogDescription>
                    </DialogHeader>

                    <form onSubmit={handleAdjust} className="space-y-4 my-4">
                        <div>
                            <label className="text-sm font-medium mb-1 block">المبلغ ({currency})</label>
                            <Input
                                type="number"
                                step="0.01"
                                min="0.01"
                                placeholder="0.00"
                                value={amount}
                                onChange={e => setAmount(e.target.value)}
                                disabled={adjustMutation.isPending}
                            />
                        </div>
                        <div>
                            <label className="text-sm font-medium mb-1 block">سبب {adjustMode === "credit" ? "الإضافة" : "الخصم"} (إجباري)</label>
                            <Input
                                type="text"
                                placeholder="مثلاً: تعويض عن طلب ملغي"
                                value={reason}
                                onChange={e => setReason(e.target.value)}
                                disabled={adjustMutation.isPending}
                            />
                        </div>

                        <DialogFooter className="mt-4 sm:justify-start">
                            <Button
                                type="submit"
                                className={adjustMode === "credit" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-red-600 hover:bg-red-700"}
                                disabled={!amount || !reason || adjustMutation.isPending}
                            >
                                {adjustMutation.isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : "تأكيد"}
                            </Button>
                            <Button type="button" variant="ghost" onClick={() => setIsAdjustOpen(false)}>
                                إيقاف
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Transaction History */}
            <Card className="bg-white border-slate-200 shadow-sm">
                <CardHeader>
                    <CardTitle className="text-lg text-slate-700">سجل المعاملات</CardTitle>
                    <CardDescription>عرض لآخر حركات المحفظة الخاصة بهذا المستخدم.</CardDescription>
                </CardHeader>
                <CardContent>
                    <WalletTransactionTable
                        transactions={txData?.transactions || []}
                        isLoading={txLoading}
                    />
                </CardContent>
            </Card>
        </div>
    );
}
