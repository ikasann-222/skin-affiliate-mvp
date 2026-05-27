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
  const skinHints = (input.skinTypes || [])
    .map((skinType) => {
      if (skinType === "敏感肌") return "敏感肌 低刺激";
      if (skinType === "乾燥肌") return "高保湿";
      if (skinType === "脂性肌") return "さっぱり";
      if (skinType === "混合肌") return "バランス";
      return "";
    })
    .filter(Boolean);
  const avoided = input.avoidedText || "";
  const safeHints = avoided.includes("アルコール") || avoided.includes("エタノール") ? "アルコールフリー" : "";

  return unique(
    desiredCosmetics.slice(0, 4).flatMap((category) => [
      `${category} スキンケア`,
      unique([category, trouble]).join(" "),
      ...skinHints.map((hint) => unique([category, hint]).join(" ")),
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

const categoryMatchers = [
  { category: "クレンジング", pattern: /(クレンジング|メイク落とし|cleansing|cleanser)/i },
  { category: "洗顔", pattern: /(洗顔|ウォッシュ|フォーム|洗顔料|face\s*wash|facial\s*wash)/i },
  { category: "日焼け止め", pattern: /(日焼け止め|UV|サンスクリーン|sunscreen)/i },
  { category: "美容液", pattern: /(美容液|セラム|エッセンス|アンプル|serum|essence|ampoule)/i },
  { category: "乳液", pattern: /(乳液|ミルク|エマルジョン|emulsion)/i },
  { category: "化粧水", pattern: /(化粧水|ローション|トナー|化粧液|lotion|toner)/i },
  { category: "クリーム", pattern: /(クリーム|バーム|cream|balm)/i },
  { category: "パック", pattern: /(パック|マスク|フェイスマスク|sheet\s*mask|mask)/i },
];

const troubleMatchers = [
  { tag: "ニキビ", pattern: /(ニキビ|にきび|アクネ|吹き出物|acne)/i },
  { tag: "赤み", pattern: /(赤み|赤ら顔|肌あれ|肌荒れ|炎症|ゆらぎ)/i },
  { tag: "毛穴", pattern: /(毛穴|角栓|黒ずみ|皮脂|ポア|pore)/i },
  { tag: "テカリ", pattern: /(テカリ|皮脂|脂性|オイリー|oil\s*control)/i },
  { tag: "乾燥", pattern: /(乾燥|かさつき|高保湿|保湿|うるおい|潤い|しっとり|moist|hydrating)/i },
  { tag: "肌荒れ", pattern: /(肌荒れ|肌あれ|ゆらぎ|バリア|低刺激|敏感)/i },
  { tag: "シミ", pattern: /(シミ|美白|ブライト|ホワイト|ビタミンC|bright|white)/i },
  { tag: "くすみ", pattern: /(くすみ|透明感|ブライト|ビタミンC|bright)/i },
];

const skinProfileMatchers = [
  { tag: "敏感肌", pattern: /(敏感肌|低刺激|無添加|アルコールフリー|エタノールフリー|弱酸性|パッチテスト|アレルギーテスト|ゆらぎ)/i },
  { tag: "乾燥肌", pattern: /(乾燥肌|高保湿|保湿|しっとり|セラミド|ヒアルロン酸|moist|hydrating)/i },
  { tag: "脂性肌", pattern: /(脂性肌|オイリー|皮脂|テカリ|さっぱり|ノンコメド|oil\s*free)/i },
  { tag: "混合肌", pattern: /(混合肌|バランス|水分油分|インナードライ)/i },
  { tag: "普通肌", pattern: /(普通肌|すべての肌|全肌質)/i },
];

function inferCategory(itemName) {
  return categoryMatchers.find((matcher) => matcher.pattern.test(itemName))?.category || "";
}

function inferTags(itemName) {
  return unique([
    ...troubleMatchers.filter((matcher) => matcher.pattern.test(itemName)).map((matcher) => matcher.tag),
    ...skinProfileMatchers.filter((matcher) => matcher.pattern.test(itemName)).map((matcher) => matcher.tag),
    /(低刺激|無添加|アルコールフリー|エタノールフリー|弱酸性)/i.test(itemName) ? "低刺激" : "",
    /(高保湿|保湿|しっとり|セラミド|ヒアルロン酸|moist|hydrating)/i.test(itemName) ? "保湿" : "",
    /(さっぱり|皮脂|オイリー|oil\s*free)/i.test(itemName) ? "さっぱり" : "",
  ]);
}

function isAssortment(itemName) {
  return /(セット|キット|トライアル|お試し|サンプル|スターター|福袋|\d+\s*点)/i.test(itemName);
}

function cleanItemName(itemName, category) {
  const removablePatterns = [
    /^【[^】]{1,18}】\s*/g,
    /^\[[^\]]{1,18}\]\s*/g,
    /【[^】]*(楽天ランキング|ランキング|送料無料|ポイント|クーポン|SALE|セール|最安|あす楽|メール便)[^】]*】/gi,
    /\[[^\]]*(楽天ランキング|ランキング|送料無料|ポイント|クーポン|SALE|セール|最安|あす楽|メール便)[^\]]*\]/gi,
    /(楽天ランキング\s*\d+位|ランキング\s*\d+位|送料無料|ポイント\d+倍|最大P\d+倍|P\d+倍|クーポン|あす楽|メール便|公式ショップ|正規品|国内|海外|お試しセット|トライアルセット)/gi,
    /(半額|割引|値引き|セール|SALE|限定|期間限定|タイムセール)[^!！。]*[!！。]?/gi,
    /\d{1,2}\s*[\/月]\s*\d{1,2}\s*\d{1,2}:\d{2}\s*[~〜～-]\s*\d{1,2}:\d{2}\s*まで[!！]?/g,
    /\d{1,2}\s+\d{1,2}\s+\d{1,2}:\d{2}\s*[~〜～-]\s*\d{1,2}:\d{2}\s*まで[!！]?/g,
    /[\d,]+\s*円\s*[→〜~\-ー]\s*[\d,]+\s*円[!！]?/g,
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
    "セット",
    "2点",
    "3点",
    "お試し",
    "トライアル",
    "公式",
    "半額",
    "限定",
  ]);

  let cleanedName = itemName.replace(/　/g, " ");
  removablePatterns.forEach((pattern) => {
    cleanedName = cleanedName.replace(pattern, " ");
  });
  cleanedName = cleanedName
    .replace(/[【】\[\]]/g, " ")
    .replace(/^\s*(公式|正規品|ショップ|店|販売店)\s+/g, " ")
    .replace(/\s*(クレンジング|洗顔|化粧水|ローション|乳液|美容液|クリーム|日焼け止め|UV|プライマー|エッセンス|ジェル|パック|マスク|オイル)\s*・.*/g, " $1");

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
  const detectedCategory = inferCategory(rawItem.itemName) || category;
  const inferredTags = inferTags(rawItem.itemName);

  return {
    id: `rakuten-${rawItem.itemCode}`,
    name: cleanItemName(rawItem.itemName, detectedCategory),
    brand: rawItem.shopName || "楽天市場",
    price: rawItem.itemPrice,
    priceLabel: priceLabel(rawItem.itemPrice),
    imageUrl,
    affiliateUrl: rawItem.affiliateUrl || rawItem.itemUrl,
    tags: unique([
      detectedCategory,
      ...inferredTags,
      priceLabel(rawItem.itemPrice),
      "楽天取得",
    ]),
    ingredients: [],
    features: ["楽天市場の商品", rawItem.shopName ? `${rawItem.shopName}取扱` : "", `${rawItem.itemPrice.toLocaleString()}円`].filter(Boolean),
  };
}

function matchesRequestedCategory(itemName, input) {
  const requestedCategories = (input.desiredCosmetics || []).filter((category) => category !== "その他");
  if (requestedCategories.length === 0) {
    return true;
  }

  if (isAssortment(itemName)) {
    return false;
  }

  const detectedCategory = inferCategory(itemName);
  return detectedCategory ? requestedCategories.includes(detectedCategory) : false;
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
      orFlag: "0",
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
      if (!matchesRequestedCategory(item.itemName, input)) {
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
