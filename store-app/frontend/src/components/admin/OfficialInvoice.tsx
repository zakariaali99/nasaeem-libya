import { Barcode128 } from '@/components/admin/Barcode128'
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
    <>
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 10mm;
          }
          body {
            background: #ffffff !important;
            color: #000000 !important;
          }
        }
      `}</style>
      <div
        className={`bg-card text-foreground font-sans select-none p-8 sm:p-12 mx-auto print:p-0 print:m-0 max-w-[210mm] min-h-[297mm] leading-normal border border-border shadow-sm print:border-none print:shadow-none ${className}`}
        style={{ direction: 'rtl', fontFamily: 'Cairo, sans-serif' }}
      >
        {/* 1. Official Header */}
        <div className="flex items-start justify-between border-b-2 border-foreground print:border-black pb-5 mb-5">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <div className="size-11 rounded-xl bg-foreground print:bg-black text-background print:text-white flex items-center justify-center font-serif text-xl font-black tracking-widest">
                NL
              </div>
              <div>
                <h1 className="font-black text-xl sm:text-2xl text-foreground print:text-black tracking-tight leading-none">
                  {data.company.name || 'نسائم ليبيا — للعطور الفاخرة'}
                </h1>
                <p className="text-[11px] text-muted-foreground print:text-black font-mono mt-0.5 tracking-wider">
                  {data.company.name_en || 'NASAEEM LIBYA LUXURY PERFUMES'}
                </p>
              </div>
            </div>
            <div className="text-xs text-muted-foreground print:text-black space-y-0.5 pt-2">
              <p>السجل التجاري: <span className="font-mono font-bold text-foreground print:text-black">{data.company.cr_number || '1048291'}</span> | الرقم الضريبي: <span className="font-mono font-bold text-foreground print:text-black">2026-LY-884</span></p>
              <p>المقر الرئيسي: <span className="font-semibold text-foreground print:text-black">{data.company.city || 'طرابلس'}</span> | هاتف الإدارة: <span className="font-mono font-bold text-foreground print:text-black" dir="ltr">{data.company.phone || '0919999999'}</span></p>
            </div>
          </div>

          <div className="text-start sm:text-end space-y-1">
            <div className="inline-block bg-foreground print:bg-black text-background print:text-white px-3.5 py-1 rounded text-xs font-black tracking-wider mb-1">
              فاتورة مبيعات ضريبية رسمية
            </div>
            <p className="font-mono font-black text-sm text-foreground print:text-black block">
              {data.invoice_number}
            </p>
            <p className="text-xs text-muted-foreground print:text-black">
              رقم الطلب: <span className="font-mono font-bold text-foreground print:text-black">#{data.order_number}</span>
            </p>
            <p className="text-xs text-muted-foreground print:text-black">
              تاريخ الإصدار: <span className="font-mono font-bold text-foreground print:text-black">{data.issue_date}</span> — <span className="font-mono text-muted-foreground print:text-black">{data.issue_time}</span>
            </p>
          </div>
        </div>

        {/* 2. Customer & Delivery Info Grid */}
        <div className="grid grid-cols-2 gap-4 rounded-xl border border-border print:border-black bg-muted/40 print:bg-transparent p-4 mb-5 text-xs">
          <div className="space-y-1">
            <span className="font-black text-foreground print:text-black block text-[13px] border-b border-border print:border-black pb-1 mb-1">
              بيانات العميل (المشتري):
            </span>
            <p><span className="text-muted-foreground print:text-black">الاسم:</span> <strong className="text-foreground print:text-black text-[13px]">{data.customer.name}</strong></p>
            <p><span className="text-muted-foreground print:text-black">رقم الهاتف:</span> <strong className="font-mono text-foreground print:text-black" dir="ltr">{data.customer.phone}</strong></p>
            {data.customer.email && (
              <p><span className="text-muted-foreground print:text-black">البريد الإلكتروني:</span> <span className="font-mono text-foreground print:text-black">{data.customer.email}</span></p>
            )}
          </div>

          <div className="space-y-1">
            <span className="font-black text-foreground print:text-black block text-[13px] border-b border-border print:border-black pb-1 mb-1">
              وجهة الشحن والتسليم:
            </span>
            <p><span className="text-muted-foreground print:text-black">المدينة / المنطقة:</span> <strong className="text-foreground print:text-black">{data.customer.city} {data.customer.region ? `— ${data.customer.region}` : ''}</strong></p>
            <p><span className="text-muted-foreground print:text-black">العنوان بالتفصيل:</span> <span className="text-foreground print:text-black">{data.customer.address}</span></p>
            <p><span className="text-muted-foreground print:text-black">طريقة الدفع:</span> <strong className="text-foreground print:text-black">{data.financials.payment_method === 'manual_payment' ? 'الدفع عند الاستلام (COD / نقداً)' : 'دفع إلكتروني معتمد'}</strong></p>
          </div>
        </div>

        {/* 3. Items Breakdown Table */}
        <div className="mb-5 overflow-hidden rounded-xl border border-foreground print:border-black">
          <table className="w-full text-xs text-start border-collapse">
            <thead>
              <tr className="bg-foreground print:bg-black text-background print:text-white font-bold text-[11px]">
                <th className="p-2.5 text-center w-10">#</th>
                <th className="p-2.5 text-start">العطر / الصنف والمواصفات</th>
                <th className="p-2.5 font-mono text-center">رمز الصنف (SKU)</th>
                <th className="p-2.5 text-center w-16">الكمية</th>
                <th className="p-2.5 text-end font-mono">سعر الوحدة</th>
                <th className="p-2.5 text-end font-mono">الإجمالي</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border print:divide-black">
              {data.items.map((item, idx) => (
                <tr key={idx} className="even:bg-muted/30 print:even:bg-transparent">
                  <td className="p-2.5 text-center font-mono text-muted-foreground print:text-black font-bold">{idx + 1}</td>
                  <td className="p-2.5 text-start">
                    <span className="font-bold text-foreground print:text-black block">{item.product_name}</span>
                    {item.variant_description && (
                      <span className="text-[11px] text-muted-foreground print:text-black block">{item.variant_description}</span>
                    )}
                  </td>
                  <td className="p-2.5 font-mono text-center text-muted-foreground print:text-black">{item.sku || '—'}</td>
                  <td className="p-2.5 text-center font-mono font-bold text-foreground print:text-black">{item.quantity}</td>
                  <td className="p-2.5 text-end font-mono text-foreground print:text-black">{formatPrice(item.unit_price)}</td>
                  <td className="p-2.5 text-end font-mono font-bold text-foreground print:text-black">{formatPrice(item.total_price)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* 4. Financial Summary & Tafqeet */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 items-start mb-5">
          {/* Left column: Tafqeet & Guarantee Stamp */}
          <div className="space-y-3 rounded-xl border border-border print:border-black p-4 bg-muted/20 print:bg-transparent">
            <div>
              <span className="text-xs text-muted-foreground print:text-black font-bold block mb-1">المبلغ المطلوب كتابةً بالدينار الليبي:</span>
              <p className="text-xs font-black text-foreground print:text-black bg-card print:bg-transparent p-2.5 rounded-lg border border-border print:border-black">
                {tafqeet}
              </p>
            </div>

            {/* Luxury Quality & Authenticity Stamp */}
            <div className="flex items-center gap-3 p-3 rounded-lg border-2 border-dashed border-foreground print:border-black bg-muted/10 text-foreground print:text-black">
              <div className="size-8 rounded-full bg-foreground print:bg-black text-background print:text-white flex items-center justify-center font-bold text-xs shrink-0">
                ✓
              </div>
              <div className="text-[11px] leading-tight">
                <strong className="block font-bold text-xs mb-0.5">ختم الضمان والأصالة العطرية الرسمية</strong>
                نسائم ليبيا تضمن أصالة كافة العطور بنسبة 100% وجودة التخزين والتركيز الدولي.
              </div>
            </div>
          </div>

          {/* Right column: Calculations Table */}
          <div className="rounded-xl border border-foreground print:border-black overflow-hidden text-xs">
            <div className="p-2.5 bg-muted/40 print:bg-transparent border-b border-border print:border-black flex justify-between font-semibold">
              <span>المجموع الفرعي للمنتجات:</span>
              <span className="font-mono font-bold">{formatPrice(data.financials.subtotal)}</span>
            </div>

            {parseFloat(data.financials.discount_total || '0') > 0 && (
              <div className="p-2.5 border-b border-border print:border-black flex justify-between font-semibold bg-muted/20 print:bg-transparent">
                <span>خصومات العروض والكوبونات:</span>
                <span className="font-mono font-bold">- {formatPrice(data.financials.discount_total)}</span>
              </div>
            )}

            <div className="p-2.5 border-b border-border print:border-black flex justify-between text-muted-foreground print:text-black">
              <span>رسوم الشحن والتوصيل:</span>
              {parseFloat(data.financials.shipping_total || '0') === 0 ? (
                <span className="font-bold">مجاني (عرض خاص)</span>
              ) : (
                <span className="font-mono font-bold">{formatPrice(data.financials.shipping_total)}</span>
              )}
            </div>

            <div className="p-3 bg-foreground print:bg-black text-background print:text-white flex justify-between items-center">
              <span className="font-black text-sm">المبلغ الإجمالي الصافي:</span>
              <span className="font-mono font-black text-base tracking-wide">
                {formatPrice(data.financials.total)}
              </span>
            </div>
          </div>
        </div>

        {/* 5. Barcode & Verification */}
        <div className="my-4 text-center">
          <Barcode128
            value={data.order_number}
            height={32}
            barWidth={1.8}
            showText={true}
            className="mx-auto"
          />
        </div>

        {/* 6. Footer: QR Code & Verification Policy */}
        <div className="flex items-center justify-between border-t-2 border-foreground print:border-black pt-3.5 text-[11px] text-muted-foreground print:text-black">
          <div className="max-w-[75%] space-y-1">
            <p className="font-bold text-foreground print:text-black">شروط الاسترجاع والضمان:</p>
            <p className="leading-relaxed">{data.terms || 'يحق للعميل معاينة الشحنة قبل الاستلام. الاستبدال متاح خلال 48 ساعة للمنتجات غير المفتوحة بحالتها الأصلية.'}</p>
            <p className="text-[10px] text-muted-foreground print:text-black font-mono mt-1">
              تم إصدار هذه الفاتورة إلكترونياً وتعتبر معتمدة رسمياً ومطابقة لأنظمة التجارة الإلكترونية.
            </p>
          </div>

          <div className="flex flex-col items-center text-center">
            <QRCodeSVG value={data.verification_url || data.order_number} size={64} />
            <span className="font-mono text-[9px] text-muted-foreground print:text-black mt-1">التحقق الإلكتروني</span>
          </div>
        </div>
      </div>
    </>
  )
}
