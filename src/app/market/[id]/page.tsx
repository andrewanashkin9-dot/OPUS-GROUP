import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProductDetail } from "@/components/market/ProductDetail";
import { PRODUCTS, productById } from "@/lib/marketplace";

/**
 * Product pages are known at build time — the catalogue is a file, not a
 * database — so all of them are rendered statically and the reader never
 * waits on a server for one.
 */
export function generateStaticParams() {
  return PRODUCTS.map((product) => ({ id: product.id }));
}

export async function generateMetadata({
  params,
}: PageProps<"/market/[id]">): Promise<Metadata> {
  const { id } = await params;
  const product = productById(id);
  if (!product) return { title: "Материал не найден — OPUS GROUP" };
  return {
    title: `${product.name} — OPUS GROUP`,
    description: product.summary,
  };
}

export default async function ProductPage({ params }: PageProps<"/market/[id]">) {
  const { id } = await params;
  const product = productById(id);
  if (!product) notFound();
  return <ProductDetail product={product} />;
}
