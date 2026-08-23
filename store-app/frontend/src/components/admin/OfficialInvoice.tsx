import { QRCodeSVG } from '@/components/admin/QRCodeSVG'
import { formatPrice } from '@/lib/format'
import type { InvoiceData } from '@/lib/queries/orders'
import { tafqeetLibyanDinars } from '@/lib/tafqeet'

interface OfficialInvoiceProps {
  data: InvoiceData
  className?: string
}

export function OfficialInvoice({ data, className = '' }: OfficialInvoiceProps) {
  const tafqeet = data.financials.tafqeet || tafqeetLibyanDinars(data.financials.total)

  return (
    <div
      className={`bg-card text-foreground font-sans select-none p-8 sm:p-12 mx-auto print:p-6 print:m-0 max-w-[210mm] min-h-[297mm] leading-normal border border-border shadow-sm print:border-none print:shadow-none ${className}`}
      style={{ direction: 'rtl', fontFamily: 'Cairo, sans-serif' }}
    >
      {/* 1. Official Header */}
      <div className="flex items-start justify-between border-b-2 border-foreground pb-6 mb-6">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-foreground text-background flex items-center justify-center font-serif text-lg font-black tracking-widest">
              NL
            </div>
            <div>
              <h1 className="font-black text-xl sm:text-2xl text-foreground tracking-tight leading-none">
                {data.company.name}
              </h1>
              <p className="text-[11px] text-muted-foreground font-mono mt-0.5 tracking-wider">
                {data.company.name_en}
              </p>
            </div>
          </div>
          <div className="text-xs text-muted-foreground space-y-0.5 pt-2">
            <p>السجل التجاري: <span className="font-mono font-bold text-foreground">{data.company.cr_number}</span></p>
            <p>المقر الرئيسي: <span className="font-semibold text-foreground">{data.company.city}</span> | هاتف: <span className="font-mono font-bold text-foreground" dir="ltr">{data.company.phone}</span></p>
          </div>
        </div>

        <div className="text-start sm:text-end space-y-1">
          <div className="inline-block bg-foreground text-background px-3 py-1 rounded text-xs font-black tracking-wider mb-1">
            فاتورة مبيعات رسمية
          </div>
          <p className="font-mono font-black text-sm text-foreground block">
            {data.invoice_number}
          </p>
          <p className="text-xs text-muted-foreground">
            رقم الطلب: <span className="font-mono font-bold text-foreground">#{data.order_number}</span>
          </p>
          <p className="text-xs text-muted-foreground">
            تاريخ الإصدار: <span className="font-mono font-bold text-foreground">{data.issue_date}</span> — <span className="font-mono text-muted-foreground">{data.issue_time}</span>
          </p>
        </div>
      </div>

      {/* 2. Customer & Delivery Info Grid */}
      <div className="grid grid-cols-2 gap-4 rounded-xl border border-border bg-muted/40 p-4 mb-6 text-xs">
        <div className="space-y-1">
          <span className="font-black text-foreground block text-[13px] border-b border-border pb-1 mb-1">
            بيانات العميل (المشتري):
          </span>
          <p><span className="text-muted-foreground">الاسم:</span> <strong className="text-foreground text-[13px]">{data.customer.name}</strong></p>
          <p><span className="text-muted-foreground">رقم الهاتف:</span> <strong className="font-mono text-foreground" dir="ltr">{data.customer.phone}</strong></p>
          {data.customer.email && (
            <p><span className="text-muted-foreground">البريد الإلكتروني:</span> <span className="font-mono text-foreground">{data.customer.email}</span></p>
          )}
        </div>

        <div className="space-y-1">
          <span className="font-black text-foreground block text-[13px] border-b border-border pb-1 mb-1">
            وجهة الشحن والتسليم:
          </span>
          <p><span className="text-muted-foreground">المدينة / المنطقة:</span> <strong className="text-foreground">{data.customer.city} {data.customer.region ? `— ${data.customer.region}` : ''}</strong></p>
          <p><span className="text-muted-foreground">العنوان بالتفصيل:</span> <span className="text-foreground">{data.customer.address}</span></p>
          <p><span className="text-muted-foreground">طريقة الدفع:</span> <strong className="text-foreground">{data.financials.payment_method === 'manual_payment' ? 'الدفع عند الاستلام (COD / نقداً)' : 'دفع إلكتروني معتمد'}</strong></p>
        </div>
      </div>

      {/* 3. Items Breakdown Table */}
      <div className="mb-6 overflow-hidden rounded-xl border border-foreground">
        <table className="w-full text-xs text-start border-collapse">
          <thead>
            <tr className="bg-foreground text-background font-bold text-[11px]">
              <th className="p-2.5 text-center w-10">#</th>
              <th className="p-2.5 text-start">العطر / الصنف والمواصفات</th>
              <th className="p-2.5 font-mono text-center">رمز الصنف (SKU)</th>
              <th className="p-2.5 text-center w-16">الكمية</th>
              <th className="p-2.5 text-end font-mono">سعر الوحدة</th>
              <th className="p-2.5 text-end font-mono">الإجمالي</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {data.items.map((item, idx) => (
              <tr key={idx} className="even:bg-muted/30">
                <td className="p-2.5 text-center font-mono text-muted-foreground font-bold">{idx + 1}</td>
                <td className="p-2.5 text-start">
                  <span className="font-bold text-foreground block">{item.product_name}</span>
                  {item.variant_description && (
                    <span className="text-[11px] text-muted-foreground block">{item.variant_description}</span>
                  )}
                </td>
                <td className="p-2.5 font-mono text-center text-muted-foreground">{item.sku || '—'}</td>
                <td className="p-2.5 text-center font-mono font-bold text-foreground">{item.quantity}</td>
                <td className="p-2.5 text-end font-mono text-foreground">{formatPrice(item.unit_price)}</td>
                <td className="p-2.5 text-end font-mono font-bold text-foreground">{formatPrice(item.total_price)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 4. Financial Summary & Tafqeet */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 items-start mb-6">
        {/* Left column: Tafqeet & Guarantee Stamp */}
        <div className="space-y-4 rounded-xl border border-border p-4 bg-muted/20">
          <div>
            <span className="text-xs text-muted-foreground font-bold block mb-1">المبلغ المطلوب كتابةً بالدينار الليبي:</span>
            <p className="text-xs font-black text-foreground bg-card p-2.5 rounded-lg border border-border">
              {tafqeet}
            </p>
          </div>

          {/* Luxury Quality & Authenticity Stamp */}
          <div className="flex items-center gap-3 p-3 rounded-lg border-2 border-dashed border-primary/50 bg-primary/5 text-foreground">
            <div className="size-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-xs shrink-0">
              ✓
            </div>
            <div className="text-[11px] leading-tight">
              <strong className="block text-primary text-xs mb-0.5">ختم الضمان والأصالة العطرية</strong>
              نسائم ليبيا تضمن أصالة كافة العطور بنسبة 100% ومطابقتها للمواصفات الدولية.
            </div>
          </div>
        </div>

        {/* Right column: Calculations Table */}
        <div className="rounded-xl border border-foreground overflow-hidden text-xs">
          <div className="p-3 bg-muted border-b border-border flex justify-between font-semibold">
            <span>المجموع الفرعي للمنتجات:</span>
            <span className="font-mono font-bold">{formatPrice(data.financials.subtotal)}</span>
          </div>

          {parseFloat(data.financials.discount_total || '0') > 0 && (
            <div className="p-3 border-b border-border flex justify-between text-primary font-semibold bg-primary/10">
              <span>خصومات العروض والكوبونات:</span>
              <span className="font-mono font-bold">- {formatPrice(data.financials.discount_total)}</span>
            </div>
          )}

          <div className="p-3 border-b border-border flex justify-between text-muted-foreground">
            <span>رسوم الشحن والتوصيل:</span>
            {parseFloat(data.financials.shipping_total || '0') === 0 ? (
              <span className="text-primary font-bold">مجاني (عرض خاص)</span>
            ) : (
              <span className="font-mono font-bold">{formatPrice(data.financials.shipping_total)}</span>
            )}
          </div>

          <div className="p-3.5 bg-foreground text-background flex justify-between items-center">
            <span className="font-black text-sm">المبلغ الإجمالي الصافي:</span>
            <span className="font-mono font-black text-base tracking-wide">
              {formatPrice(data.financials.total)}
            </span>
          </div>
        </div>
      </div>

      {/* 5. Footer: QR Code & Verification Policy */}
      <div className="flex items-center justify-between border-t-2 border-foreground pt-4 text-[11px] text-muted-foreground">
        <div className="max-w-[75%] space-y-1">
          <p className="font-bold text-foreground">شروط الاسترجاع والضمان:</p>
          <p className="leading-relaxed">{data.terms}</p>
          <p className="text-[10px] text-muted-foreground font-mono mt-1">
            تم إصدار هذه الفاتورة إلكترونياً وتعتبر معتمدة دون الحاجة لختم ورقي تقليدي.
          </p>
        </div>

        <div className="flex flex-col items-center text-center">
          <QRCodeSVG value={data.verification_url || data.order_number} size={68} />
          <span className="font-mono text-[9px] text-muted-foreground mt-1">التحقق الإلكتروني</span>
        </div>
      </div>
    </div>
  )
}
