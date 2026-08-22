import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { usePageTitle } from '@/lib/usePageTitle'

interface Endpoint {
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  path: string
  title: string
  description: string
  auth: 'عام (Public)' | 'مستخدم (Auth)' | 'مدير (Admin)'
  requestBody?: string
  responseExample: string
}

const ENDPOINTS: Endpoint[] = [
  {
    method: 'GET',
    path: '/api/health/',
    title: 'فحص صحة النظام',
    description: 'التحقق من اتصال الخادم بقاعدة البيانات وذاكرة Redis.',
    auth: 'عام (Public)',
    responseExample: JSON.stringify({ status: 'ok', database: 'ok', cache: 'ok' }, null, 2),
  },
  {
    method: 'GET',
    path: '/api/products/',
    title: 'قائمة المنتجات والتصفية',
    description: 'جلب قائمة المنتجات مع دعم البحث والتصنيف والترتيب والترقيم.',
    auth: 'عام (Public)',
    responseExample: JSON.stringify(
      {
        data: [
          {
            id: 'd9b7f58a-3642-4917-8e6d-97216a6cb390',
            name: 'عطر مسك الليل الفاخر',
            slug: 'musk-night-luxury',
            price: '185.00',
            compare_at_price: '220.00',
            stock: 24,
            is_active: true,
          },
        ],
        meta: { page: 1, limit: 20, total: 1, pages: 1 },
      },
      null,
      2,
    ),
  },
  {
    method: 'POST',
    path: '/api/cart/',
    title: 'إضافة منتج للسلة',
    description: 'إضافة عنصر إلى سلة الشراء للزائر أو المستخدم المسجل.',
    auth: 'عام (Public)',
    requestBody: JSON.stringify(
      { product_id: 'd9b7f58a-3642-4917-8e6d-97216a6cb390', quantity: 1 },
      null,
      2,
    ),
    responseExample: JSON.stringify(
      {
        data: {
          id: 'item-uuid',
          quantity: 1,
          product_name: 'عطر مسك الليل الفاخر',
          unit_price: '185.00',
          total_price: '185.00',
        },
        message: 'تمت إضافة المنتج إلى السلة',
      },
      null,
      2,
    ),
  },
  {
    method: 'GET',
    path: '/api/storefront/layout/',
    title: 'تخطيط الصفحة الرئيسية',
    description: 'جلب التخطيط النشط والودجات المهيأة للعرض المباشر.',
    auth: 'عام (Public)',
    responseExample: JSON.stringify(
      {
        data: {
          id: 'layout-uuid',
          name: 'التخطيط الافتراضي',
          widgets: [
            {
              id: 'widget-uuid',
              type: 'hero_cta',
              data: { title: 'أفخم العطور الشرقية', buttonLabel: 'تسوق الآن', buttonUrl: '/products' },
              order: 0,
            },
          ],
        },
      },
      null,
      2,
    ),
  },
  {
    method: 'POST',
    path: '/api/payments/',
    title: 'بدء عملية الدفع',
    description: 'توليد رابط التحويل لبوابات الدفع (معاملات، بلوتو، سداد) أو تعليمات الحوالة.',
    auth: 'مستخدم (Auth)',
    requestBody: JSON.stringify(
      { order_id: 'order-uuid', method_code: 'moamalat' },
      null,
      2,
    ),
    responseExample: JSON.stringify(
      {
        data: {
          payment_id: 'pay-uuid',
          method_code: 'moamalat',
          action: 'redirect',
          gateway_url: 'https://gateway.moamalat.net/checkout/...',
          amount: '185.00',
        },
      },
      null,
      2,
    ),
  },
]

export default function ApiDocsPage() {
  usePageTitle('دليل واجهة التطبيقات — المطورين')
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'public' | 'auth'>('all')

  const filtered = ENDPOINTS.filter((ep) => {
    if (selectedFilter === 'public') return ep.auth.includes('Public')
    if (selectedFilter === 'auth') return ep.auth.includes('Auth') || ep.auth.includes('Admin')
    return true
  })

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 space-y-8">
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Badge tone="primary">API Documentation v1</Badge>
          <span className="text-xs font-mono text-muted-foreground">JSON / RESTful</span>
        </div>
        <h1 className="text-3xl font-bold text-foreground">دليل واجهة برمجة التطبيقات للمطورين</h1>
        <p className="text-muted-foreground text-sm max-w-2xl">
          توثيق شامل لنقاط النهاية ونماذج البيانات المستخدمة في منصة نسائم ليبيا، مصممة للتكامل السلس والآمن.
        </p>
      </div>

      <div className="flex gap-2 border-b border-border pb-3">
        <Button
          size="sm"
          variant={selectedFilter === 'all' ? 'default' : 'ghost'}
          onClick={() => setSelectedFilter('all')}
        >
          جميع النقاط ({ENDPOINTS.length})
        </Button>
        <Button
          size="sm"
          variant={selectedFilter === 'public' ? 'default' : 'ghost'}
          onClick={() => setSelectedFilter('public')}
        >
          النقاط العامة
        </Button>
        <Button
          size="sm"
          variant={selectedFilter === 'auth' ? 'default' : 'ghost'}
          onClick={() => setSelectedFilter('auth')}
        >
          النقاط المحمية
        </Button>
      </div>

      <div className="space-y-6">
        {filtered.map((ep) => (
          <div key={ep.path + ep.method} className="rounded-lg border border-border bg-card p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
              <div className="flex items-center gap-3">
                <span
                  className={`rounded px-2.5 py-1 text-xs font-bold font-mono ${
                    ep.method === 'GET'
                      ? 'bg-emerald-500/10 text-emerald-600'
                      : ep.method === 'POST'
                      ? 'bg-blue-500/10 text-blue-600'
                      : ep.method === 'PATCH'
                      ? 'bg-amber-500/10 text-amber-600'
                      : 'bg-rose-500/10 text-rose-600'
                  }`}
                >
                  {ep.method}
                </span>
                <span className="font-mono text-sm font-semibold text-foreground" dir="ltr">
                  {ep.path}
                </span>
              </div>
              <Badge tone="neutral">{ep.auth}</Badge>
            </div>

            <div className="space-y-1">
              <h3 className="font-bold text-foreground">{ep.title}</h3>
              <p className="text-sm text-muted-foreground">{ep.description}</p>
            </div>

            {ep.requestBody && (
              <div className="space-y-1">
                <span className="text-xs font-semibold text-muted-foreground">Request Payload:</span>
                <pre className="rounded-md bg-muted/60 p-3 text-xs font-mono text-foreground overflow-x-auto" dir="ltr">
                  {ep.requestBody}
                </pre>
              </div>
            )}

            <div className="space-y-1">
              <span className="text-xs font-semibold text-muted-foreground">Response 200 OK:</span>
              <pre className="rounded-md bg-muted/60 p-3 text-xs font-mono text-foreground overflow-x-auto" dir="ltr">
                {ep.responseExample}
              </pre>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
