import type { DiagnosisInput, Product } from "../types";

type RakutenProductsResponse = {
  products?: Product[];
  error?: string;
};

export async function fetchRakutenProducts(input: DiagnosisInput) {
  const response = await fetch("/api/rakuten-products", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });

  const data = (await response.json()) as RakutenProductsResponse;
  if (!response.ok) {
    throw new Error(data.error || "楽天商品を取得できませんでした。");
  }

  return data.products ?? [];
}
