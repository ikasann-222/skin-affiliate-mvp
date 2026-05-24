const RAKUTEN_ENDPOINT = "https://app.rakuten.co.jp/services/api/IchibaItem/Search/20220601";

function unique(items) {
  return Array.from(new Set(items.filter(Boolean)));
}

function priceLabel(price) {
  if (price < 1000) return "1,000円未満";
  if (price < 2000) return "1,000円台";
  if (price < 3000) return "2,000円台";
  if (price < 4000) return "3,000円台";
  if (price < 5000) return "4,000円台";
  return "5,000円以上";
}

function buildKeywords(input) {
  const desiredCosmetics = input.desiredCosmetics?.length ? input.desiredCosmetics : ["スキンケア"];
  const trouble = input.troubles?.[0] || input.customTroubleText || "";
  const skinType = input.skinTypes?.[0] || "";
  const avoided = input.avoidedText || "";

  return desiredCosmetics.slice(0, 4).map((category) => {
    const safeHints = avoided.includes("アルコール") || avoided.includes("エタノール") ? "アルコールフリー" : "";
    return unique([category, skinType, trouble, safeHints, "スキンケア"]).join(" ");
  });
}

function normalizeItem(rawItem, category, input) {
  const imageUrl =
    rawItem.mediumImageUrls?.[0]?.imageUrl ||
    rawItem.smallImageUrls?.[0]?.imageUrl ||
    "";

  return {
    id: `rakuten-${rawItem.itemCode}`,
    name: rawItem.itemName,
    brand: rawItem.shopName || "楽天市場",
    price: rawItem.itemPrice,
    priceLabel: priceLabel(rawItem.itemPrice),
    imageUrl,
    affiliateUrl: rawItem.affiliateUrl || rawItem.itemUrl,
    tags: unique([
      category,
      ...(input.skinTypes || []),
      ...(input.troubles || []),
      ...(input.desiredCosmetics || []),
      priceLabel(rawItem.itemPrice),
      "楽天取得",
    ]),
    ingredients: [],
    features: ["楽天市場の商品", rawItem.shopName ? `${rawItem.shopName}取扱` : "", `${rawItem.itemPrice.toLocaleString()}円`].filter(Boolean),
  };
}

export default async function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return response.status(405).json({ error: "Method not allowed" });
  }

  const applicationId = process.env.RAKUTEN_APPLICATION_ID;
  if (!applicationId) {
    return response.status(501).json({ error: "RAKUTEN_APPLICATION_ID is not configured" });
  }

  const affiliateId = process.env.RAKUTEN_AFFILIATE_ID;
  const input = request.body || {};
  const keywords = buildKeywords(input);
  const productsById = new Map();

  await Promise.all(
    keywords.map(async (keyword) => {
      const category = input.desiredCosmetics?.find((item) => keyword.includes(item)) || "スキンケア";
      const params = new URLSearchParams({
        applicationId,
        format: "json",
        keyword,
        hits: "30",
        imageFlag: "1",
        sort: "standard",
      });

      if (affiliateId) {
        params.set("affiliateId", affiliateId);
      }

      const rakutenResponse = await fetch(`${RAKUTEN_ENDPOINT}?${params.toString()}`);
      if (!rakutenResponse.ok) {
        return;
      }

      const data = await rakutenResponse.json();
      (data.Items || []).forEach((entry) => {
        const item = entry.Item;
        if (!item?.itemCode || !item?.itemName || !item?.itemPrice) {
          return;
        }

        productsById.set(item.itemCode, normalizeItem(item, category, input));
      });
    }),
  );

  return response.status(200).json({
    products: Array.from(productsById.values()).slice(0, 80),
  });
}
