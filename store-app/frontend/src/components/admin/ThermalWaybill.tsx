import { Barcode128 } from '@/components/admin/Barcode128'
import { formatPrice } from '@/lib/format'
import type { WaybillData } from '@/lib/queries/orders'

interface ThermalWaybillProps {
  data: WaybillData
  format?: '100x150' | '80mm'
  className?: string
}

export function ThermalWaybill({
  data,
  format = '100x150',
  className = '',
}: ThermalWaybillProps) {
  const is80mm = format === '80mm'
  const isPrepaid = data.payment?.is_prepaid || parseFloat(data.payment?.cod_amount || '0') === 0

  return (
    <div
      className={`bg-card text-foreground font-sans select-none border-2 border-foreground p-3.5 mx-auto print:border-2 print:border-foreground print:m-0 print:p-3 leading-tight ${
        is80mm ? 'w-[80mm] max-w-[80mm] text-[10px]' : 'w-[100mm] max-w-[100mm] min-h-[145mm] text-xs'
      } ${className}`}
      style={{ direction: 'rtl', fontFamily: 'Cairo, sans-serif' }}
    >
      {/* Header: Store Identity & Courier */}
      <div className="flex items-center justify-between border-b-2 border-foreground pb-2 mb-2">
        <div>
          <h1 className="font-black text-sm sm:text-base tracking-tight leading-none text-foreground">
            نسائم ليبيا — عطور فاخرة
          </h1>
          <p className="text-[9px] text-muted-foreground font-mono mt-0.5">
            NASAEEM LIBYA LUXURY PERFUMES
          </p>
        </div>
        <div className="border border-border rounded px-2 py-1 text-center bg-muted">
          <span className="text-[9px] block text-muted-foreground font-bold">شركة التوصيل</span>
          <span className="font-black text-xs block text-foreground">{data.courier.name}</span>
        </div>
      </div>

      {/* Barcode & Tracking Number */}
      <div className="border-b-2 border-foreground pb-2 mb-2 text-center bg-muted/60 p-1.5 rounded">
        <Barcode128
          value={data.tracking_number || data.order_number}
          height={is80mm ? 36 : 46}
          barWidth={is80mm ? 1.8 : 2.2}
          showText={false}
          className="mx-auto"
        />
        <div className="flex items-center justify-between mt-1 px-2 font-mono text-xs font-black">
          <span>#{data.order_number}</span>
          <span className="text-muted-foreground">تتبع: {data.tracking_number}</span>
        </div>
      </div>

      {/* Recipient Details */}
      <div className="border-b-2 border-foreground pb-2 mb-2 space-y-1">
        <div className="flex items-center justify-between">
          <span className="font-bold text-muted-foreground">المستلم:</span>
          <span className="font-black text-sm text-foreground">{data.recipient.name}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="font-bold text-muted-foreground">الهاتف:</span>
          <span className="font-mono font-black text-xs" dir="ltr">
            {data.recipient.phone_1}
            {data.recipient.phone_2 ? ` / ${data.recipient.phone_2}` : ''}
          </span>
        </div>
        <div className="pt-0.5">
          <span className="font-bold text-muted-foreground block">الوجهة والعنوان:</span>
          <p className="font-bold text-xs mt-0.5 bg-muted p-1 rounded border border-border">
            {data.recipient.city}
            {data.recipient.region ? ` — ${data.recipient.region}` : ''}
            {data.recipient.address ? ` — ${data.recipient.address}` : ''}
          </p>
        </div>
      </div>

      {/* Payment / COD Collection Box */}
      <div className="border-2 border-foreground rounded-lg p-2 mb-2 text-center">
        {isPrepaid ? (
          <div className="bg-primary/10 text-primary p-1.5 rounded border border-primary/40">
            <span className="text-xs font-black block">✨ طلب مدفوع إلكترونياً بالكامل ✨</span>
            <span className="text-[10px] font-bold block mt-0.5">
              لا يُحصّل أي مبلغ نقدي من المستلم (المبلغ المستحق: 0.00 د.ل)
            </span>
          </div>
        ) : (
          <div className="bg-muted p-1.5 rounded">
            <span className="text-[10px] font-bold text-muted-foreground block">المبلغ المطلوب تحصيله (COD نقداً):</span>
            <span className="font-mono font-black text-base sm:text-lg block tracking-wide text-foreground">
              {formatPrice(data.payment.cod_amount)}
            </span>
            <span className="text-[9px] font-bold text-muted-foreground block mt-0.5">
              (كاش عند الاستلام بالدينار الليبي)
            </span>
          </div>
        )}
      </div>

      {/* Packing List */}
      <div className="border-b-2 border-foreground pb-2 mb-2">
        <span className="font-bold text-[10px] text-muted-foreground block mb-1">
          محتويات الطرد ({data.packing_list.length} أصناف عطرية):
        </span>
        <div className="space-y-1">
          {data.packing_list.map((item, idx) => (
            <div key={idx} className="flex items-center justify-between text-[11px] border-b border-border/60 pb-0.5">
              <span className="font-bold truncate max-w-[70%] text-foreground">
                {item.quantity}× {item.product_name}
                {item.variant_description ? ` (${item.variant_description})` : ''}
              </span>
              <span className="font-mono text-[9px] text-muted-foreground">{item.sku}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Fragile Glass Caution Banner */}
      <div className="border border-foreground bg-muted p-1.5 rounded text-center text-[10px] font-black mb-2 text-foreground">
        {data.fragile_warning}
      </div>

      {/* Footer Meta */}
      <div className="flex items-center justify-between text-[9px] text-muted-foreground pt-1 font-mono">
        <span>
          {new Date(data.created_at).toLocaleDateString('ar-LY', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
          })}
        </span>
        <span className="font-bold text-foreground">طرد رقم: 1 من 1</span>
        <span>نسائم ليبيا ©</span>
      </div>
    </div>
  )
}
