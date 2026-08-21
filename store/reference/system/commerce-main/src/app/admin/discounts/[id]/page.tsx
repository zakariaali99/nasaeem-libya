"use client";

import { useEffect, useState, use } from "react";
import { DiscountForm } from "../components/DiscountForm";
import { Loader2 } from "lucide-react";
import { useParams } from "next/navigation";

export default function EditDiscountPage({ params }: { params: Promise<{ id: string }> }) {
    const [initialData, setInitialData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const resolvedParams = use(params);
    const id = resolvedParams.id;

    useEffect(() => {
        fetch(`/api/discounts/${id}`)
            .then((res) => {
                if (!res.ok) throw new Error("فشل إحضار بيانات الخصم");
                return res.json();
            })
            .then((data) => {
                // Format dates correctly for the form
                const discount = { ...data.data };
                if (discount.bogo && typeof discount.bogo === 'string') {
                    try { discount.bogo = JSON.parse(discount.bogo); } catch (e) { }
                }
                if (discount.tiered && typeof discount.tiered === 'string') {
                    try { discount.tiered = JSON.parse(discount.tiered); } catch (e) { }
                }
                setInitialData(discount);
            })
            .catch((err) => setError(err.message))
            .finally(() => setLoading(false));
    }, [id]);

    if (loading) {
        return (
            <div className="flex h-[400px] items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    if (error || !initialData) {
        return (
            <div className="flex h-[400px] items-center justify-center text-destructive">
                {error || "لم يتم العثور على الخصم"}
            </div>
        );
    }

    return (
        <div className="container mx-auto p-4 md:p-8" dir="rtl">
            <DiscountForm initialData={initialData} />
        </div>
    );
}
