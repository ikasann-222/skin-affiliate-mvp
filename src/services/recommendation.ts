import { products } from "../data/products";
import type { DiagnosisInput, Product, Recommendation } from "../types";

const troubleTags: Record<string, string[]> = {
  ニキビ: ["ニキビ", "低刺激", "さっぱり"],
  赤み: ["赤み", "敏感肌", "低刺激", "アルコールフリー"],
  毛穴: ["毛穴", "ビタミンC", "さっぱり"],
  テカリ: ["テカリ", "脂性肌", "さっぱり"],
  乾燥: ["乾燥", "保湿", "セラミド", "ヒアルロン酸", "アルコールフリー"],
  肌荒れ: ["肌荒れ", "敏感肌", "低刺激", "アルコールフリー"],
  黒ずみ: ["毛穴", "ビタミンC", "さっぱり"],
  シミ: ["シミ", "ビタミンC"],
  くすみ: ["くすみ", "ビタミンC", "保湿"],
};

const habitTags: Record<string, string[]> = {
  睡眠不足: ["低刺激", "保湿"],
  ストレス: ["敏感肌", "低刺激"],
  マスク着用時間が長い: ["ニキビ", "赤み", "低刺激", "さっぱり"],
  夜更かし: ["保湿", "ビタミンC"],
  食生活の乱れ: ["ニキビ", "保湿"],
};

function unique(items: string[]) {
  return Array.from(new Set(items.filter(Boolean)));
}

function normalize(value: string) {
  return value.toLowerCase().replace(/\s/g, "");
}

function textTags(value: string) {
  const normalized = normalize(value);
  const tags: string[] = [];

  Object.entries(troubleTags).forEach(([keyword, mappedTags]) => {
    if (normalized.includes(keyword)) {
      tags.push(keyword, ...mappedTags);
    }
  });

  Object.entries(habitTags).forEach(([keyword, mappedTags]) => {
    if (normalized.includes(keyword)) {
      tags.push(keyword, ...mappedTags);
    }
  });

  if (normalized.includes("日差し") || normalized.includes("紫外線")) {
    tags.push("シミ", "くすみ", "低刺激");
  }
  if (normalized.includes("ざらつき") || normalized.includes("ザラつき") || normalized.includes("ごわつき")) {
    tags.push("毛穴", "肌荒れ", "低刺激");
  }
  if (normalized.includes("吹き出物") || normalized.includes("ぶつぶつ")) {
    tags.push("ニキビ", "低刺激", "さっぱり");
  }
  if (normalized.includes("ひりつき") || normalized.includes("ヒリつき") || normalized.includes("刺激")) {
    tags.push("敏感肌", "低刺激", "アルコールフリー");
  }
  if (normalized.includes("かさつき") || normalized.includes("粉ふき")) {
    tags.push("乾燥", "保湿", "セラミド");
  }
  if (normalized.includes("空調") || normalized.includes("エアコン")) {
    tags.push("乾燥", "保湿");
  }
  if (normalized.includes("メイク") || normalized.includes("クレンジング")) {
    tags.push("肌荒れ", "低刺激");
  }

  return tags;
}

export function buildPriorityTags(input: DiagnosisInput) {
  const avoided = normalize(input.avoidedText);
  const tags = [
    ...input.skinTypes,
    input.ageRange === "10代" || input.ageRange === "20代" ? "学生向け" : "",
    ...input.troubles.flatMap((trouble) => troubleTags[trouble] ?? [trouble]),
    ...input.habits.flatMap((habit) => habitTags[habit] ?? []),
    ...textTags(input.customTroubleText),
    ...textTags(input.customHabitText),
    ...input.desiredCosmetics,
    input.budgetRange && input.budgetRange !== "指定なし" ? input.budgetRange : "",
  ];

  if (avoided.includes("アルコール") || avoided.includes("エタノール")) {
    tags.push("アルコールフリー", "低刺激", "敏感肌");
  }
  if (avoided.includes("香料")) {
    tags.push("低刺激", "敏感肌");
  }
  if (avoided.includes("レチノール")) {
    tags.push("低刺激", "保湿");
  }

  return unique(tags);
}

function searchableProductTerms(product: Product) {
  return [...product.tags, ...product.ingredients, ...product.features, product.name, product.priceLabel];
}

const skinTypeFitTags: Record<string, string[]> = {
  敏感肌: ["敏感肌", "低刺激", "アルコールフリー", "エタノールフリー", "無添加", "弱酸性", "ゆらぎ"],
  乾燥肌: ["乾燥肌", "保湿", "高保湿", "セラミド", "ヒアルロン酸", "しっとり", "うるおい"],
  脂性肌: ["脂性肌", "さっぱり", "皮脂", "テカリ", "オイリー", "ノンコメド"],
  混合肌: ["混合肌", "バランス", "水分油分", "インナードライ"],
  普通肌: ["普通肌", "全肌質", "すべての肌"],
};

const sensitiveCautionTags = ["ピーリング", "スクラブ", "レチノール", "高濃度", "AHA", "BHA", "角質ケア"];

function hasTerm(searchableTerms: string[], keyword: string) {
  return searchableTerms.some((term) => term.includes(keyword) || keyword.includes(term));
}

function matchedFrom(searchableTerms: string[], keywords: string[]) {
  return unique(keywords.filter((keyword) => hasTerm(searchableTerms, keyword)));
}

function scoreProduct(product: Product, priorityTags: string[], input: DiagnosisInput) {
  const searchableTerms = searchableProductTerms(product);
  const matchedTags = priorityTags.filter((tag) => searchableTerms.some((term) => term.includes(tag) || tag.includes(term)));
  const desiredMatches = matchedFrom(searchableTerms, input.desiredCosmetics.filter((category) => category !== "その他"));
  const troubleKeywords = unique([
    ...input.troubles.flatMap((trouble) => troubleTags[trouble] ?? [trouble]),
    ...textTags(input.customTroubleText),
  ]);
  const troubleMatches = matchedFrom(searchableTerms, troubleKeywords);
  const skinKeywords = unique(input.skinTypes.flatMap((skinType) => skinTypeFitTags[skinType] ?? [skinType]));
  const skinMatches = matchedFrom(searchableTerms, skinKeywords);
  const sensitivityPenalty =
    input.skinTypes.includes("敏感肌") && sensitiveCautionTags.some((tag) => hasTerm(searchableTerms, tag)) ? 35 : 0;
  const sensitiveSafetyBonus =
    input.skinTypes.includes("敏感肌") && skinMatches.some((tag) => ["敏感肌", "低刺激", "アルコールフリー", "無添加", "弱酸性"].includes(tag))
      ? 35
      : 0;
  const desiredBonus = input.desiredCosmetics.reduce(
    (total, category) => total + (hasTerm(searchableTerms, category) ? 100 : 0),
    0,
  );
  const troubleBonus = troubleMatches.length * 45;
  const skinTypeBonus = skinMatches.length * 25 + sensitiveSafetyBonus - sensitivityPenalty;
  const ingredientBonus = priorityTags.some((tag) => product.ingredients.includes(tag)) ? 8 : 0;
  const budgetBonus = input.budgetRange && input.budgetRange !== "指定なし" && product.priceLabel === input.budgetRange ? 10 : 0;
  const functionalScore = desiredBonus + troubleBonus + skinTypeBonus + matchedTags.length * 3 + ingredientBonus;

  return {
    score: functionalScore + budgetBonus,
    matchedTags: unique([...desiredMatches, ...troubleMatches, ...skinMatches, ...matchedTags]).slice(0, 10),
  };
}

function matchesDesiredCosmetics(product: Product, input: DiagnosisInput) {
  const strictCategories = input.desiredCosmetics.filter((category) => category !== "その他");
  if (strictCategories.length === 0) {
    return true;
  }

  const searchableTerms = searchableProductTerms(product);
  return strictCategories.some((category) => searchableTerms.some((term) => term.includes(category)));
}

function reasonFor(product: Product, input: DiagnosisInput, matchedTags: string[]) {
  const concerns = input.troubles.slice(0, 2).join("・") || input.customTroubleText.trim() || "肌状態";
  const skinTypes = input.skinTypes.join("・") || "入力された肌質";
  const matched = matchedTags.slice(0, 4).join("、") || "肌質に近い特徴";
  const ingredients = product.ingredients.slice(0, 3).join("、");
  const categories = input.desiredCosmetics.filter((category) => category !== "その他").join("・") || "希望カテゴリ";
  const sensitivity =
    input.skinTypes.includes("敏感肌")
      ? "敏感肌が選ばれているため、低刺激・無添加・アルコールフリーなどの表記を特に重視しています。"
      : input.skinTypes.includes("乾燥肌")
        ? "乾燥肌が選ばれているため、保湿・しっとり・セラミド系の表記を重視しています。"
        : input.skinTypes.includes("脂性肌")
          ? "脂性肌が選ばれているため、さっぱり・皮脂ケア系の表記を重視しています。"
          : input.avoidedText.trim().length > 0
            ? "過去に合わなかった成分の入力があるため、刺激感に配慮しやすいタグを優先しています。"
            : "はじめて選ぶ人でも比較しやすい、肌質と悩みの一致度を優先しています。";
  const budgetText =
    input.budgetRange && input.budgetRange !== "指定なし" && product.priceLabel === input.budgetRange
      ? `価格帯も${input.budgetRange}に収まっています。`
      : "価格よりもカテゴリ・悩み・肌質の一致度を優先しています。";
  const sensitivityText =
    input.avoidedText.trim().length > 0
      ? `${sensitivity} 避けたい成分の入力も加味しています。`
      : sensitivity;

  const ingredientText = ingredients ? `${ingredients}などの成分特徴があり、` : "";

  return `${categories}の中から、${concerns}と${skinTypes}への合いやすさを優先しています。${matched}に合う商品を上位にしています。${ingredientText}${sensitivityText} ${budgetText}`;
}

export function rankProducts(input: DiagnosisInput, productPool: Product[], limit = 12): Recommendation[] {
  const priorityTags = buildPriorityTags(input);

  return productPool
    .filter((product) => matchesDesiredCosmetics(product, input))
    .map((product) => {
      const { score, matchedTags } = scoreProduct(product, priorityTags, input);
      return {
        product,
        score,
        matchedTags,
        reason: reasonFor(product, input, matchedTags),
      };
    })
    .sort((a, b) => b.score - a.score || a.product.price - b.product.price)
    .slice(0, limit);
}

export function recommendProducts(input: DiagnosisInput, limit = 12): Recommendation[] {
  return rankProducts(input, products, limit);
}
