"use client";

import React from "react";
import { format } from "date-fns";
import { RefreshCw, ArrowDownRight, ArrowUpRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export interface WalletTransactionTableProps {
    transactions: any[];
    isLoading: boolean;
}

export function WalletTransactionTable({ transactions, isLoading }: WalletTransactionTableProps) {
    if (isLoading) {
        return (
            <div className="py-8 flex justify-center text-muted-foreground">
                <RefreshCw className="w-6 h-6 animate-spin" />
            </div>
        );
    }

    return (
        <div className="rounded-md border overflow-x-auto">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead className="text-right whitespace-nowrap">نوع الحركة</TableHead>
                        <TableHead className="text-right whitespace-nowrap">المبلغ</TableHead>
                        <TableHead className="text-right whitespace-nowrap min-w-[200px]">التفاصيل</TableHead>
                        <TableHead className="text-right whitespace-nowrap">رقم المرجع</TableHead>
                        <TableHead className="text-right whitespace-nowrap">التاريخ</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {(!transactions || transactions.length === 0) && (
                        <TableRow>
                            <TableCell colSpan={5} className="text-center py-6 text-muted-foreground">
                                لا توجد حركات سابقة.
                            </TableCell>
                        </TableRow>
                    )}
                    {transactions?.map((tx: any) => {
                        const isCredit = ["topup", "voucher_credit", "refund", "credit", "admin_credit"].includes(tx.type);
                        return (
                            <TableRow key={tx.id}>
                                <TableCell>
                                    <div className="flex items-center gap-2">
                                        {isCredit ? (
                                            <ArrowUpRight className="w-4 h-4 text-emerald-500" />
                                        ) : (
                                            <ArrowDownRight className="w-4 h-4 text-red-500" />
                                        )}
                                        <Badge variant={isCredit ? "default" : "secondary"}>
                                            {isCredit ? "إضافة" : "خصم"}
                                        </Badge>
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <span className={`font-bold whitespace-nowrap ${isCredit ? "text-emerald-600" : "text-red-600"} `}>
                                        {isCredit ? "+" : "-"}{tx.amount} {tx.currency}
                                    </span>
                                </TableCell>
                                <TableCell>
                                    {tx.referenceType === "voucher" && "بطاقة قسيمة (Voucher)"}
                                    {tx.referenceType === "order" && "دفع طلب شراء"}
                                    {tx.referenceType === "refund" && "استرجاع مبلغ طلب"}
                                    {tx.referenceType === "topup" && "شحن رصيد إلكتروني"}
                                    {tx.referenceType === "adjustment" && "تسوية مالية"}
                                    {tx.referenceType === "admin_adjustment" && (
                                        <div className="flex flex-col gap-1 items-start">
                                            <span>تسوية إدارة</span>
                                            {tx.metadata?.reason && (
                                                <Badge variant="outline" className="text-[10px] bg-slate-50">{tx.metadata.reason}</Badge>
                                            )}
                                        </div>
                                    )}
                                    {(!["voucher", "order", "refund", "topup", "adjustment", "admin_adjustment"].includes(tx.referenceType)) && tx.referenceType}
                                </TableCell>
                                <TableCell className="font-mono text-xs text-muted-foreground">
                                    {tx.referenceId ? tx.referenceId.slice(-8) : "-"}
                                </TableCell>
                                <TableCell dir="ltr" className="text-right text-sm text-slate-600 whitespace-nowrap">
                                    {format(new Date(tx.createdAt), "yyyy-MM-dd HH:mm")}
                                </TableCell>
                            </TableRow>
                        )
                    })}
                </TableBody>
            </Table>
        </div>
    );
}
