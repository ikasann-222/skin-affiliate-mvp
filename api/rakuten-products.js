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

const categorySearchTerms = {
  パック: ["フェイスパック", "シートマスク", "フェイスマスク", "パック スキンケア"],
};

function searchTermsForCategory(category) {
  return categorySearchTerms[category] || [category];
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
    desiredCosmetics.slice(0, 4).flatMap((category) =>
      searchTermsForCategory(category).flatMap((searchTerm) => [
        `${searchTerm} スキンケア`,
        unique([searchTerm, trouble]).join(" "),
        ...skinHints.map((hint) => unique([searchTerm, hint]).join(" ")),
        unique([searchTerm, "保湿"]).join(" "),
        unique([searchTerm, safeHints]).join(" "),
        searchTerm,
      ]),
    ),
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
  {
    category: "パック",
    pattern: /(フェイスパック|シートパック|シートマスク|フェイスマスク|美容パック|スキンケア.*パック|パック.*スキンケア|美容.*パック|顔.*パック|肌.*パック|マスク|sheet\s*mask|face\s*mask)/i,
  },
];

const beautyCategoryPattern =
  /(スキンケア|コスメ|化粧品|基礎化粧品|フェイス|顔|肌|美容|保湿|化粧水|ローション|トナー|乳液|美容液|セラム|エッセンス|クリーム|洗顔|クレンジング|メイク落とし|日焼け止め|UV|パック|マスク|シートマスク|フェイスマスク)/i;

const nonBeautyProductPattern =
  /(バックパック|リュック|バッグ|鞄|かばん|トート|ポーチ|収納|旅行|アウトドア|登山|キャンプ|ランドセル|食品|食料|ご飯|米|肉|魚|野菜|冷凍|真空パック|パックご飯|詰め替えパック|カード|トレカ|パック販売|バッテリーパック|電池パック)/i;

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
  if (nonBeautyProductPattern.test(itemName)) {
    return "";
  }

  return categoryMatchers.find((matcher) => matcher.pattern.test(itemName))?.category || "";
}

function isBeautyProduct(itemName) {
  return beautyCategoryPattern.test(itemName) && !nonBeautyProductPattern.test(itemName);
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

function cleanItemName(itemName, category, shopName = "") {
  const removablePatterns = [
    /^【[^】]{1,18}】\s*/g,
    /^\[[^\]]{1,18}\]\s*/g,
    /【[^】]*(楽天ランキング|ランキング|送料無料|ポイント|クーポン|SALE|セール|最安|あす楽|メール便)[^】]*】/gi,
    /\[[^\]]*(楽天ランキング|ランキング|送料無料|ポイント|クーポン|SALE|セール|最安|あす楽|メール便)[^\]]*\]/gi,
    /(楽天ランキング\s*\d+位|ランキング\s*\d+位|送料無料|ポイント\d+倍|最大P\d+倍|P\d+倍|P\s*\d+倍|クーポン|あす楽|メール便|公式ショップ|正規品|国内|海外|お試しセット|トライアルセット)/gi,
    /(最大\s*)?[\d,]+\s*円\s*OFF/gi,
    /(最大\s*)?[\d,]+\s*円\s*オフ/gi,
    /(最大\s*)?[\d,]+\s*円\s*割引/gi,
    /\d{1,2}\s*日?\s*\d{1,2}:\d{2}\s*(迄|まで|迄に|までに)?[!！]?/g,
    /\d{1,2}\s*日\s*\d{1,2}:\d{2}\s*(迄|まで)[!！]?/g,
    /(半額|割引|値引き|セール|SALE|限定|期間限定|タイムセール)[^!！。]*[!！。]?/gi,
    /\d{1,2}\s*[\/月]\s*\d{1,2}\s*\d{1,2}:\d{2}\s*[~〜～-]\s*\d{1,2}:\d{2}\s*まで[!！]?/g,
    /\d{1,2}\s+\d{1,2}\s+\d{1,2}:\d{2}\s*[~〜～-]\s*\d{1,2}:\d{2}\s*まで[!！]?/g,
    /[\d,]+\s*円\s*[→〜~\-ー]\s*[\d,]+\s*円[!！]?/g,
    /[★☆♪]+/g,
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
    "OFF",
    "off",
    "OFFICIAL",
    "official",
    "迄",
    "まで",
    "当日発送",
    "最強配送",
    "ランキング",
    "1位",
    "No.1",
  ]);
  const genericDescriptorPattern =
    /^(保湿|高保湿|乾燥|乾燥肌|敏感肌|低刺激|さっぱり|しっとり|毛穴|ニキビ|にきび|肌荒れ|肌あれ|美白|ブライトニング|大容量|詰め替え|詰替|無添加|ノンコメド|セラミド|ヒアルロン酸|プラセンタ|ビタミンC|レチノール|化粧水|ローション|美容液|乳液|クリーム|洗顔|クレンジング|パック|マスク|スキンケア)$/i;
  const promoTokenPattern =
    /(最大|OFF|オフ|割引|値引き|半額|クーポン|ポイント|ランキング|送料無料|無料|限定|SALE|セール|最安|あす楽|メール便|公式|正規品|お試し|トライアル|セット|プレゼント|ギフト|当日発送|最強配送|迄|まで|No\.?1|NO\.?1)/i;

  const shopTokens = shopName
    .replace(/楽天市場店|公式ショップ|公式|OFFICIAL|official/gi, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean);

  let cleanedName = itemName
    .replace(/　/g, " ")
    .replace(/[＼\\／]+/g, " ")
    .replace(/(\d)\s+(\d{3}円\s*(OFF|オフ|割引))/gi, "$1,$2");
  shopTokens.forEach((token) => {
    cleanedName = cleanedName.replace(new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"), " ");
  });
  removablePatterns.forEach((pattern) => {
    cleanedName = cleanedName.replace(pattern, " ");
  });
  cleanedName = cleanedName
    .replace(/^\s*(最大|クーポン|ポイント|セール|SALE|限定|期間限定|タイムセール|割引|値引き|OFF|オフ|迄|まで|!|！|★|☆|\d|,|円|:|-|~|〜|～)+\s*/gi, " ")
    .replace(/\s+/g, " ");
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
    .filter((token) => !promoTokenPattern.test(token))
    .filter((token) => !/^[\d,]+円?(OFF|オフ|割引)?$/i.test(token))
    .filter((token) => !/^\d{1,2}日?$/.test(token))
    .filter((token) => !/^\d{1,2}:\d{2}(迄|まで)?$/.test(token))
    .filter((token) => token !== category);

  const uniqueTokens = [];
  compactTokens.forEach((token) => {
    if (!uniqueTokens.includes(token) && (!genericDescriptorPattern.test(token) || uniqueTokens.length === 0)) {
      uniqueTokens.push(token);
    }
  });

  const productLikeTokens = uniqueTokens.filter((token, index) => {
    if (index === 0 && genericDescriptorPattern.test(token)) {
      return false;
    }

    return !genericDescriptorPattern.test(token) || /\d+(ml|g|枚|本|個|包|mL)/i.test(token);
  });
  const titleTokens = productLikeTokens.length ? productLikeTokens : uniqueTokens;
  const title = titleTokens.slice(0, 5).join(" ").trim() || category || itemName;

  return title.length > 42 ? `${title.slice(0, 42)}...` : title;
}

function normalizeItem(rawItem, category, input) {
  const imageUrl = getImageUrl(rawItem.mediumImageUrls, rawItem.smallImageUrls, rawItem.imageUrl);
  const detectedCategory = inferCategory(rawItem.itemName) || category;
  const inferredTags = inferTags(rawItem.itemName);
  const isAffiliateLink = Boolean(rawItem.affiliateUrl);

  return {
    id: `rakuten-${rawItem.itemCode}`,
    name: cleanItemName(rawItem.itemName, detectedCategory, rawItem.shopName),
    brand: rawItem.shopName || "楽天市場",
    price: rawItem.itemPrice,
    priceLabel: priceLabel(rawItem.itemPrice),
    imageUrl,
    affiliateUrl: rawItem.affiliateUrl,
    isAffiliateLink,
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
    return isBeautyProduct(itemName);
  }

  if (isAssortment(itemName)) {
    return false;
  }
  if (!isBeautyProduct(itemName)) {
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
      if (!item.affiliateUrl) {
        console.warn("[rakuten-products] Missing affiliateUrl; product skipped", {
          itemCode: item.itemCode,
          itemName: item.itemName,
          itemUrl: item.itemUrl,
        });
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
