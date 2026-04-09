"use client";

import { useParams } from "next/navigation";
import ProductDetailView from "@/components/products/ProductDetailView";

export default function LandingProductDetailPage() {
  const params = useParams<{ id: string }>();
  
  if (!params?.id) return null;

  return <ProductDetailView productId={params.id as string} isModal={false} />;
}
