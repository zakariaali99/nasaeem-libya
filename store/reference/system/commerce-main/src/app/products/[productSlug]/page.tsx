import { Metadata, ResolvingMetadata } from 'next';
import { getProductBySlugOrId } from '@/modules/products/services/productService';
import { getVariantsByProductId } from '@/modules/variants/services/variantService';
import { getOptionsWithValuesByProductId } from '@/modules/options/services/optionService';
import { getRelatedProducts } from '@/modules/products/services/productService';
import { auth } from '@/lib/auth';
import { cookies, headers } from 'next/headers';
import ProductClientPage from './ProductClientPage';
import { ProductDescription } from './ProductDescription';
import { ProductSpecs } from './ProductSpecs';
import { RelatedProductsSection } from './RelatedProductsSection';
import { notFound } from 'next/navigation';
import { Product } from '@/modules/products/types/productTypes';
import { ProductVariantWithImages } from '@/modules/variants/types/variantTypes';
import { OptionWithValues } from '@/modules/options/types/optionTypes';

interface ProductPageProps {
  params: Promise<{
    productSlug: string;
  }>;
}

export async function generateMetadata(
  { params }: ProductPageProps,
  parent: ResolvingMetadata
): Promise<Metadata> {
  const slug = (await params).productSlug;
  const product = await getProductBySlugOrId(slug);

  if (!product) {
    return {
      title: 'المنتج غير موجود',
      description: 'لم نتمكن من العثور على المنتج الذي تبحث عنه.',
    };
  }

  const previousImages = (await parent).openGraph?.images || [];

  const images = product.images?.map(img => ({
    url: new URL(img.url, process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').toString(),
    width: 800,
    height: 600,
    alt: img.altText || product.name,
  })) || [];

  return {
    metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'),
    title: product.metaTitle || product.name,
    description: product.metaDescription || product.description,
    openGraph: {
      title: product.metaTitle || product.name,
      description: product.metaDescription || product.description || '',
      images: [...images, ...previousImages],
    },
  };
}

async function getProductData(slug: string): Promise<{ product: Product, variants: ProductVariantWithImages[], options: OptionWithValues[] }> {
  const product = await getProductBySlugOrId(slug);

  if (!product) {
    notFound();
  }

  const [variants, options] = await Promise.all([
    product.hasVariants ? getVariantsByProductId(product.id) : Promise.resolve([]),
    product.hasVariants ? getOptionsWithValuesByProductId(product.id) : Promise.resolve([]),
  ]);

  return { product, variants: variants as ProductVariantWithImages[], options };
}

export default async function ProductPage({ params }: ProductPageProps) {
  const slug = (await params).productSlug;
  const { product, variants, options } = await getProductData(slug);

  const headerStore = await headers();
  const req = new Request(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000', { headers: headerStore });
  const session = await auth.api.getSession(req as any);
  const cookieStore = await cookies();
  const anonymousId = cookieStore.get('wave_anonymous_id')?.value || null;

  const relatedProducts = await getRelatedProducts(product.id, {
    userId: session?.user?.id ?? null,
    anonymousId,
    limit: 8,
  });

  return (
    <>
      <ProductClientPage
        product={product}
        initialVariants={variants}
        options={options}
      >
        <ProductDescription description={product.description ?? null} />
        <ProductSpecs product={product} />
      </ProductClientPage>

      <div className="container mx-auto px-4">
        <RelatedProductsSection relatedProducts={relatedProducts} currentProductId={product.id} />
      </div>
    </>
  );
}
