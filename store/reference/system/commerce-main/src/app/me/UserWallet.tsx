"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Wallet, Ticket, CheckCircle2, RefreshCw, CreditCard, ArrowDownRight, ArrowUpRight } from "lucide-react";
import { Card, CardHeader, CardContent, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/components/ui/use-toast";
import { WalletTransactionTable } from "@/components/WalletTransactionTable";

export default function UserWallet() {
    const { show } = useToast();
    const queryClient = useQueryClient();
    const [voucherCode, setVoucherCode] = useState("");
    const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());

    // Fetch Wallet Balance
    const { data: walletData, isLoading: walletLoading } = useQuery({
        queryKey: ["user-wallet"],
        queryFn: async () => {
            const res = await fetch("/api/wallets/me");
            if (!res.ok) throw new Error("Failed to fetch wallet");
            return res.json();
        }
    });

    // Fetch Wallet Transactions
    const { data: txData, isLoading: txLoading } = useQuery({
        queryKey: ["user-wallet-tx"],
        queryFn: async () => {
            const res = await fetch("/api/wallets/me/transactions");
            if (!res.ok) throw new Error("Failed to fetch transactions");
            return res.json();
        }
    });

    // Redeem Voucher Mutation
    const redeemMutation = useMutation({
        mutationFn: async (code: string) => {
            const res = await fetch("/api/vouchers/redeem", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-idempotency-key": idempotencyKey
                },
                body: JSON.stringify({ code })
            });
            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.error || "فشل شحن القسيمة");
            }
            return res.json();
        },
        onSuccess: (data) => {
            show({
                title: "تم الشحن بنجاح",
                description: `تمت إضافة ${data.creditedAmount} ${data.currency} إلى رصيدك.`,
                variant: "success"
            });
            setVoucherCode("");
            setIdempotencyKey(crypto.randomUUID()); // Generate new key for the next potential top-up
            queryClient.invalidateQueries({ queryKey: ["user-wallet"] });
            queryClient.invalidateQueries({ queryKey: ["user-wallet-tx"] });
        },
        onError: (err: any) => {
            show({ title: "خطأ", description: err.message, variant: "error" });
        }
    });

    const handleRedeem = (e: React.FormEvent) => {
        e.preventDefault();
        if (!voucherCode.trim()) return;
        redeemMutation.mutate(voucherCode.trim());
    };

    const balance = walletData?.wallet?.currentBalance || 0;
    const currency = walletData?.wallet?.currency || "د.ل";

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Wallet Balance Card */}
                <Card className="bg-white border-slate-200 shadow-sm relative overflow-hidden">
                    <CardHeader>
                        <CardTitle className="text-lg text-slate-700 flex items-center gap-2">
                            <Wallet className="w-5 h-5" />
                            رصيد المحفظة
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {walletLoading ? (
                            <RefreshCw className="w-5 h-5 animate-spin text-slate-400" />
                        ) : (
                            <div>
                                <span className="text-4xl font-bold text-slate-900">{balance}</span>
                                <span className="text-lg text-slate-500 mr-2 font-semibold tracking-wider uppercase">{currency}</span>
                            </div>
                        )}
                        <p className="text-sm text-slate-500 mt-2">رصيدك الحالي المتاح للاستخدام في مشترياتك</p>
                    </CardContent>
                </Card>

                {/* Redeem Voucher Card */}
                <Card className="bg-white border-slate-200 shadow-sm">
                    <CardHeader>
                        <CardTitle className="text-lg text-slate-700 flex items-center gap-2">
                            <Ticket className="w-5 h-5" />
                            شحن المحفظة بقسيمة
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleRedeem} className="space-y-4">
                            <div>
                                <label htmlFor="voucher" className="text-sm font-medium text-slate-700 mb-1 block">
                                    كود القسيمة (Voucher Code)
                                </label>
                                <div className="flex gap-2">
                                    <Input
                                        id="voucher"
                                        placeholder="أدخل كود القسيمة المكون من 12 رمز أو أكثر"
                                        value={voucherCode}
                                        onChange={e => setVoucherCode(e.target.value)}
                                        className="flex-1 uppercase font-mono tracking-wider"
                                        dir="ltr"
                                        disabled={redeemMutation.isPending}
                                    />
                                    <Button type="submit" disabled={!voucherCode || redeemMutation.isPending} className="px-6">
                                        {redeemMutation.isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : "شحن"}
                                    </Button>
                                </div>
                            </div>
                        </form>
                    </CardContent>
                </Card>
            </div>

            {/* Transaction History */}
            <Card className="bg-white border-slate-200 shadow-sm">
                <CardHeader>
                    <CardTitle className="text-lg text-slate-700">سجل المعاملات</CardTitle>
                    <CardDescription>عرض لآخر الحركات والرصيد المضاف أو المخصوم من محفظتك.</CardDescription>
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
