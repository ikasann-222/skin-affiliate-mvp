const RAKUTEN_ENDPOINT = "https://openapi.rakuten.co.jp/ichibams/api/IchibaItem/Search/20260401";
const SITE_URL = "https://skin-affiliate-mvp.vercel.app";

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
  const avoided = input.avoidedText || "";
  const safeHints = avoided.includes("アルコール") || avoided.includes("エタノール") ? "アルコールフリー" : "";

  return unique(
    desiredCosmetics.slice(0, 4).flatMap((category) => [
      `${category} スキンケア`,
      unique([category, trouble]).join(" "),
      unique([category, "保湿"]).join(" "),
      unique([category, safeHints]).join(" "),
      category,
    ]),
  ).slice(0, 12);
}

function describeRakutenError(status, body, keyword) {
  const description = body?.error_description || body?.error || body?.message || "詳細なし";
  return `${status} ${keyword}: ${description}`;
}

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function getImageUrl(...imageGroups) {
  for (const group of imageGroups) {
    const firstImage = Array.isArray(group) ? group[0] : group;
    if (typeof firstImage === "string") {
      return firstImage;
    }
    if (firstImage?.imageUrl) {
      return firstImage.imageUrl;
    }
    if (firstImage?.url) {
      return firstImage.url;
    }
  }

  return "";
}

function cleanItemName(itemName, category) {
  const removablePatterns = [
    /【[^】]*(楽天ランキング|ランキング|送料無料|ポイント|クーポン|SALE|セール|最安|あす楽|メール便)[^】]*】/gi,
    /\[[^\]]*(楽天ランキング|ランキング|送料無料|ポイント|クーポン|SALE|セール|最安|あす楽|メール便)[^\]]*\]/gi,
    /(楽天ランキング\s*\d+位|ランキング\s*\d+位|送料無料|ポイント\d+倍|クーポン|あす楽|メール便|公式ショップ|正規品)/gi,
  ];
  const noiseWords = new Set([
    "大人ニキビ",
    "思春期ニキビ",
    "子供ニキビ",
    "背中ニキビ",
    "赤ニキビ",
    "白ニキビ",
    "敏感肌",
    "乾燥肌",
    "アトピー肌",
    "肌荒れ",
    "無添加",
    "ノンケミカル",
    "オーガニック",
    "スキンケア",
    "プレゼント",
    "ギフト",
  ]);

  let cleanedName = itemName.replace(/　/g, " ");
  removablePatterns.forEach((pattern) => {
    cleanedName = cleanedName.replace(pattern, " ");
  });

  const compactTokens = cleanedName
    .replace(/[|｜/／,，]+/g, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean)
    .filter((token) => !noiseWords.has(token))
    .filter((token) => token !== category);

  const uniqueTokens = [];
  compactTokens.forEach((token) => {
    if (!uniqueTokens.includes(token)) {
      uniqueTokens.push(token);
    }
  });

  const shortened = uniqueTokens.join(" ").trim() || itemName;
  return shortened.length > 48 ? `${shortened.slice(0, 48)}...` : shortened;
}

function normalizeItem(rawItem, category, input) {
  const imageUrl = getImageUrl(rawItem.mediumImageUrls, rawItem.smallImageUrls, rawItem.imageUrl);

  return {
    id: `rakuten-${rawItem.itemCode}`,
    name: cleanItemName(rawItem.itemName, category),
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

  const accessKey = process.env.RAKUTEN_ACCESS_KEY;
  if (!accessKey) {
    return response.status(501).json({ error: "RAKUTEN_ACCESS_KEY is not configured" });
  }

  const affiliateId = process.env.RAKUTEN_AFFILIATE_ID;
  const input = request.body || {};
  const keywords = buildKeywords(input);
  const productsById = new Map();
  const requestErrors = [];

  for (const keyword of keywords.slice(0, 6)) {
    const category = input.desiredCosmetics?.find((item) => keyword.includes(item)) || "スキンケア";
    const params = new URLSearchParams({
      applicationId,
      accessKey,
      format: "json",
      formatVersion: "2",
      keyword,
      hits: "30",
      field: "0",
      imageFlag: "1",
      orFlag: "1",
      sort: "standard",
    });

    if (affiliateId) {
      params.set("affiliateId", affiliateId);
    }

    const rakutenResponse = await fetch(`${RAKUTEN_ENDPOINT}?${params.toString()}`, {
      headers: {
        Referer: SITE_URL,
        Origin: SITE_URL,
      },
    });
    const data = await rakutenResponse.json().catch(() => ({}));
    if (!rakutenResponse.ok) {
      requestErrors.push(describeRakutenError(rakutenResponse.status, data, keyword));
      await wait(350);
      continue;
    }

    const entries = data.Items || data.items || [];
    entries.forEach((entry) => {
      const item = entry.Item || entry.item || entry;
      if (!item?.itemCode || !item?.itemName || !item?.itemPrice) {
        return;
      }

      productsById.set(item.itemCode, normalizeItem(item, category, input));
    });

    if (productsById.size >= 60) {
      break;
    }

    await wait(350);
  }

  if (productsById.size === 0 && requestErrors.length > 0) {
    return response.status(502).json({ error: `楽天APIへのリクエストに失敗しました: ${requestErrors.slice(0, 3).join(", ")}` });
  }

  return response.status(200).json({
    products: Array.from(productsById.values()).slice(0, 80),
  });
}
