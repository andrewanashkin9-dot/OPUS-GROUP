import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProductDetail } from "@/components/market/ProductDetail";
import { PRODUCTS, productById } from "@/lib/marketplace";
import { productText } from "@/lib/i18n/product-text";

/**
 * Английские страницы товаров.
 *
 * Как и русские, известны на этапе сборки — каталог это файл, а не база, —
 * поэтому все 37 отдаются готовыми и читатель не ждёт сервер.
 */
export function generateStaticParams() {
  return PRODUCTS.map((product) => ({ id: product.id }));
}

export async function generateMetadata({
  params,
}: PageProps<"/en/market/[id]">): Promise<Metadata> {
  const { id } = await params;
  const product = productById(id);
  if (!product) return { title: "Material not found — OPUS GROUP" };
  const text = productText(product, "en");
  return {
    title: `${text.name} — OPUS GROUP`,
    description: text.summary,
    alternates: {
      canonical: `/en/market/${id}`,
      languages: { ru: `/market/${id}`, en: `/en/market/${id}` },
    },
  };
}

export default async function Page({ params }: PageProps<"/en/market/[id]">) {
  const { id } = await params;
  const product = productById(id);
  if (!product) notFound();
  return <ProductDetail product={product} locale="en" />;
}
