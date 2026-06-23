export type AgeRange = "10代" | "20代" | "30代" | "40代" | "50代" | "60代" | "60代以上";

export type Gender = "女性" | "男性" | "その他" | "回答しない";

export type SkinType = "乾燥肌" | "脂性肌" | "混合肌" | "敏感肌" | "普通肌";

export type SkinTrouble =
  | "ニキビ"
  | "赤み"
  | "毛穴"
  | "テカリ"
  | "乾燥"
  | "肌荒れ"
  | "黒ずみ"
  | "シミ"
  | "くすみ";

export type CosmeticCategory =
  | "化粧水"
  | "乳液"
  | "美容液"
  | "クリーム"
  | "洗顔"
  | "クレンジング"
  | "日焼け止め"
  | "パック"
  | "その他";

export type CurrentCosmetic = {
  id: string;
  category: CosmeticCategory;
  name: string;
};

export type BudgetRange =
  | "指定なし"
  | "1,000円未満"
  | "1,000円台"
  | "2,000円台"
  | "3,000円台"
  | "4,000円台"
  | "5,000円以上";

export type DiagnosisInput = {
  ageRange: AgeRange | "";
  gender: Gender | "";
  skinTypes: SkinType[];
  troubles: SkinTrouble[];
  customTroubleText: string;
  avoidedText: string;
  desiredCosmetics: CosmeticCategory[];
  currentProducts: CurrentCosmetic[];
  budgetRange: BudgetRange | "";
  updatedAt: string;
};

export type Product = {
  id: string;
  name: string;
  brand: string;
  price: number;
  priceLabel: string;
  imageUrl: string;
  affiliateUrl: string;
  isAffiliateLink?: boolean;
  tags: string[];
  ingredients: string[];
  features: string[];
};

export type Recommendation = {
  product: Product;
  score: number;
  matchedTags: string[];
  reason: string;
};

export type IngredientGuide = {
  name: string;
  summary: string;
};
