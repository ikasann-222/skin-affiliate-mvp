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

function scoreProduct(product: Product, priorityTags: string[], input: DiagnosisInput) {
  const searchableTerms = searchableProductTerms(product);
  const matchedTags = priorityTags.filter((tag) => searchableTerms.some((term) => term.includes(tag) || tag.includes(term)));
  const skinTypeBonus = input.skinTypes.reduce((total, skinType) => total + (product.tags.includes(skinType) ? 8 : 0), 0);
  const troubleBonus = input.troubles.reduce((total, trouble) => total + (product.tags.includes(trouble) ? 5 : 0), 0);
  const desiredBonus = input.desiredCosmetics.reduce(
    (total, category) => total + (searchableTerms.some((term) => term.includes(category)) ? 7 : 0),
    0,
  );
  const ingredientBonus = priorityTags.some((tag) => product.ingredients.includes(tag)) ? 4 : 0;
  const budgetBonus = input.budgetRange && input.budgetRange !== "指定なし" && product.priceLabel === input.budgetRange ? 6 : 0;

  return {
    score: matchedTags.length * 10 + skinTypeBonus + troubleBonus + desiredBonus + ingredientBonus + budgetBonus,
    matchedTags,
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
  const sensitivity =
    input.avoidedText.trim().length > 0
      ? "過去に合わなかった成分の入力があるため、刺激感に配慮しやすいタグを優先しています。"
      : "はじめて選ぶ人でも比較しやすい、肌質と悩みの一致度を優先しています。";

  const ingredientText = ingredients ? `${ingredients}などの成分特徴があり、` : "";

  return `${skinTypes}で${concerns}が気になる入力のため、${matched}に合う商品を上位にしています。${ingredientText}${sensitivity}`;
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
