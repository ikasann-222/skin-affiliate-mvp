import { useEffect, useMemo, useState } from "react";
import { ingredientGuides } from "./data/products";
import { buildPriorityTags, rankProducts, recommendProducts } from "./services/recommendation";
import { fetchRakutenProducts } from "./services/rakutenProducts";
import { clearDiagnosis, loadDiagnosis, saveDiagnosis } from "./services/storage";
import type {
  AgeRange,
  BudgetRange,
  CosmeticCategory,
  CurrentCosmetic,
  DiagnosisInput,
  Gender,
  LifestyleHabit,
  Product,
  SkinTrouble,
  SkinType,
} from "./types";

type Page = "top" | "diagnosis" | "result";

const ageRanges: AgeRange[] = ["10代", "20代", "30代", "40代", "50代", "60代", "60代以上"];
const genders: Gender[] = ["女性", "男性", "その他", "回答しない"];
const skinTypes: SkinType[] = ["乾燥肌", "脂性肌", "混合肌", "敏感肌", "普通肌"];
const troubles: SkinTrouble[] = ["ニキビ", "赤み", "毛穴", "テカリ", "乾燥", "くすみ"];
const habits: LifestyleHabit[] = ["睡眠不足", "ストレス", "マスク着用時間が長い", "夜更かし", "食生活の乱れ"];
const budgetRanges: BudgetRange[] = ["指定なし", "1,000円未満", "1,000円台", "2,000円台", "3,000円台", "4,000円台", "5,000円以上"];
const cosmeticCategories: CosmeticCategory[] = [
  "化粧水",
  "乳液",
  "美容液",
  "クリーム",
  "洗顔",
  "クレンジング",
  "日焼け止め",
  "パック",
  "その他",
];

function productCategoryTags(tags: string[]) {
  return cosmeticCategories.filter((category) => tags.includes(category));
}

function initialDiagnosis(): DiagnosisInput {
  return {
    ageRange: "",
    gender: "",
    skinTypes: [],
    troubles: [],
    customTroubleText: "",
    avoidedText: "",
    desiredCosmetics: [],
    currentProducts: [createCosmetic()],
    budgetRange: "",
    habits: [],
    customHabitText: "",
    updatedAt: new Date().toISOString(),
  };
}

function createCosmetic(category: CosmeticCategory = "化粧水"): CurrentCosmetic {
  return {
    id: crypto.randomUUID(),
    category,
    name: "",
  };
}

function toggle<T extends string>(items: T[], item: T) {
  return items.includes(item) ? items.filter((value) => value !== item) : [...items, item];
}

function toggleSingle<T extends string>(current: T | "", item: T) {
  return current === item ? "" : item;
}

function normalizeDiagnosis(input: DiagnosisInput | null): DiagnosisInput {
  const fallback = initialDiagnosis();
  if (!input) {
    return fallback;
  }

  const legacySkinType = (input as unknown as { skinType?: SkinType }).skinType;
  const legacyCurrentProducts = (input as unknown as { currentProducts?: string | CurrentCosmetic[] }).currentProducts;
  const currentProducts =
    Array.isArray(legacyCurrentProducts)
      ? legacyCurrentProducts.length > 0
        ? legacyCurrentProducts
        : fallback.currentProducts
      : legacyCurrentProducts?.trim()
        ? [{ ...createCosmetic("その他"), name: legacyCurrentProducts }]
        : fallback.currentProducts;

  return {
    ...fallback,
    ...input,
    skinTypes: input.skinTypes ?? (legacySkinType ? [legacySkinType] : fallback.skinTypes),
    customTroubleText: input.customTroubleText ?? "",
    desiredCosmetics: input.desiredCosmetics ?? [],
    currentProducts,
    budgetRange: input.budgetRange ?? "",
    customHabitText: input.customHabitText ?? "",
  };
}

export default function App() {
  const storedDiagnosis = loadDiagnosis();
  const [hasStoredDiagnosis, setHasStoredDiagnosis] = useState(Boolean(storedDiagnosis));
  const [page, setPage] = useState<Page>(storedDiagnosis ? "result" : "top");
  const [diagnosis, setDiagnosis] = useState<DiagnosisInput>(normalizeDiagnosis(storedDiagnosis));
  const [rakutenProducts, setRakutenProducts] = useState<Product[]>([]);
  const [isLoadingRakutenProducts, setIsLoadingRakutenProducts] = useState(false);
  const [rakutenProductError, setRakutenProductError] = useState("");
  const localRecommendations = useMemo(() => recommendProducts(diagnosis), [diagnosis]);
  const rakutenRecommendations = useMemo(() => rankProducts(diagnosis, rakutenProducts, 24), [diagnosis, rakutenProducts]);
  const recommendations = rakutenRecommendations.length > 0 ? rakutenRecommendations : localRecommendations;
  const priorityTags = useMemo(() => buildPriorityTags(diagnosis).slice(0, 9), [diagnosis]);

  useEffect(() => {
    if (page !== "result") {
      return;
    }

    let isActive = true;
    setIsLoadingRakutenProducts(true);
    setRakutenProductError("");

    fetchRakutenProducts(diagnosis)
      .then((products) => {
        if (!isActive) {
          return;
        }
        setRakutenProducts(products);
      })
      .catch((error: unknown) => {
        if (!isActive) {
          return;
        }
        setRakutenProducts([]);
        setRakutenProductError(error instanceof Error ? error.message : "楽天商品を取得できませんでした。");
      })
      .finally(() => {
        if (isActive) {
          setIsLoadingRakutenProducts(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, [diagnosis, page]);

  function showResults() {
    const nextDiagnosis = {
      ...diagnosis,
      updatedAt: new Date().toISOString(),
    };
    setDiagnosis(nextDiagnosis);
    setRakutenProducts([]);
    setRakutenProductError("");
    saveDiagnosis(nextDiagnosis);
    setHasStoredDiagnosis(true);
    setPage("result");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function resetDiagnosisData() {
    clearDiagnosis();
    setHasStoredDiagnosis(false);
    setDiagnosis(initialDiagnosis());
    setPage("diagnosis");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function updateCosmetic(id: string, patch: Partial<CurrentCosmetic>) {
    setDiagnosis({
      ...diagnosis,
      currentProducts: diagnosis.currentProducts.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    });
  }

  function removeCosmetic(id: string) {
    const nextProducts = diagnosis.currentProducts.filter((item) => item.id !== id);
    setDiagnosis({
      ...diagnosis,
      currentProducts: nextProducts.length > 0 ? nextProducts : [createCosmetic()],
    });
  }

  return (
    <main className="site-shell">
      {page === "top" ? (
        <section className="hero">
          <div className="hero-copy">
            <p className="kicker">Skin Match</p>
            <h1>
              <span>30秒で、</span>
              <span>今の肌に近いスキンケア候補へ。</span>
            </h1>
            <p>
              肌質、悩み、避けたい成分から商品DBをタグマッチ。SNSの口コミを追い続ける前に、候補を短く整理できます。
            </p>
            <div className="actions">
              <button type="button" className="primary-button" onClick={() => setPage("diagnosis")}>
                30秒診断をはじめる
              </button>
              {hasStoredDiagnosis ? (
                <button type="button" className="secondary-button" onClick={() => setPage("result")}>
                  前回の結果を見る
                </button>
              ) : null}
              {hasStoredDiagnosis ? (
                <button type="button" className="danger-button" onClick={resetDiagnosisData}>
                  入力データをリセット
                </button>
              ) : null}
            </div>
          </div>
          <div className="hero-visual" aria-hidden="true">
            <div className="hero-summary-card">
              <span>診断で見ること</span>
              <strong>肌質・悩み・予算・欲しいカテゴリ</strong>
              <p>ボタン選択を中心に、商品候補に必要な情報だけを整理します。</p>
            </div>
            <div className="hero-summary-card">
              <span>推薦の仕組み</span>
              <strong>商品タグと入力内容を照合</strong>
              <p>化粧水や美容液などのカテゴリも結果に反映します。</p>
            </div>
            <div className="hero-summary-card hero-summary-accent">
              <span>結果画面</span>
              <strong>候補から商品ページへ</strong>
              <p>気になる商品は画像・商品名・ボタンから確認できます。</p>
            </div>
          </div>
        </section>
      ) : null}

      {page === "diagnosis" ? (
        <section className="panel diagnosis">
          <div className="section-head">
            <p className="kicker">Diagnosis</p>
            <h2>肌情報を入力</h2>
            <p>必須項目はボタン中心です。自由入力は分かる範囲だけで大丈夫です。</p>
            {hasStoredDiagnosis ? (
              <button type="button" className="text-button" onClick={resetDiagnosisData}>
                前回入力したデータをリセット
              </button>
            ) : null}
          </div>

          <Step title="年齢">
            <ChipGroup
              options={ageRanges}
              selected={diagnosis.ageRange ? [diagnosis.ageRange] : []}
              onSelect={(ageRange) => setDiagnosis({ ...diagnosis, ageRange: toggleSingle(diagnosis.ageRange, ageRange) })}
            />
          </Step>

          <Step title="性別">
            <ChipGroup
              options={genders}
              selected={diagnosis.gender ? [diagnosis.gender] : []}
              onSelect={(gender) => setDiagnosis({ ...diagnosis, gender: toggleSingle(diagnosis.gender, gender) })}
            />
          </Step>

          <Step title="肌質">
            <ChipGroup
              options={skinTypes}
              selected={diagnosis.skinTypes}
              onSelect={(skinType) => setDiagnosis({ ...diagnosis, skinTypes: toggle(diagnosis.skinTypes, skinType) })}
            />
          </Step>

          <Step title="直したい肌トラブル">
            <ChipGroup
              options={troubles}
              selected={diagnosis.troubles}
              onSelect={(trouble) =>
                setDiagnosis({
                  ...diagnosis,
                  troubles: diagnosis.troubles.includes(trouble) ? [] : [trouble],
                  customTroubleText: diagnosis.troubles.includes(trouble) ? diagnosis.customTroubleText : "",
                })
              }
            />
            {diagnosis.troubles.length === 0 ? (
              <label className="nested-field">
                <span>上記にない場合入力してください</span>
                <textarea
                  value={diagnosis.customTroubleText}
                  onChange={(event) => setDiagnosis({ ...diagnosis, customTroubleText: event.target.value })}
                  placeholder="例: フェイスラインのざらつき、鼻まわりの毛穴、季節のゆらぎ"
                />
              </label>
            ) : null}
          </Step>

          <Step title="生活習慣">
            <ChipGroup
              options={habits}
              selected={diagnosis.habits}
              onSelect={(habit) => setDiagnosis({ ...diagnosis, habits: toggle(diagnosis.habits, habit) })}
            />
            <label className="nested-field">
              <span>生活習慣</span>
              <textarea
                value={diagnosis.customHabitText}
                onChange={(event) => setDiagnosis({ ...diagnosis, customHabitText: event.target.value })}
                placeholder="例: 部活で日差しを浴びる、メイクを落とすのが遅い、空調の部屋に長くいる"
              />
            </label>
          </Step>

          <label className="field">
            <span>過去に荒れた成分・商品（ある場合）</span>
            <textarea
              value={diagnosis.avoidedText}
              onChange={(event) => setDiagnosis({ ...diagnosis, avoidedText: event.target.value })}
              placeholder="例: アルコール、香料、レチノール、特定の商品名"
            />
          </label>

          <Step title="欲しい化粧品">
            <ChipGroup
              options={cosmeticCategories}
              selected={diagnosis.desiredCosmetics}
              onSelect={(category) => setDiagnosis({ ...diagnosis, desiredCosmetics: toggle(diagnosis.desiredCosmetics, category) })}
            />
          </Step>

          <Step title="予算">
            <ChipGroup
              options={budgetRanges}
              selected={diagnosis.budgetRange ? [diagnosis.budgetRange] : []}
              onSelect={(budgetRange) => setDiagnosis({ ...diagnosis, budgetRange: toggleSingle(diagnosis.budgetRange, budgetRange) })}
            />
          </Step>

          <section className="field">
            <span>現在使用している化粧品（任意入力）</span>
            <div className="cosmetic-list">
              {diagnosis.currentProducts.map((item) => (
                <div className="cosmetic-row" key={item.id}>
                  <label>
                    <span>種類</span>
                    <select value={item.category} onChange={(event) => updateCosmetic(item.id, { category: event.target.value as CosmeticCategory })}>
                      {cosmeticCategories.map((category) => (
                        <option key={category} value={category}>
                          {category}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>商品名</span>
                    <input
                      value={item.name}
                      onChange={(event) => updateCosmetic(item.id, { name: event.target.value })}
                      placeholder="例: 商品名を入力"
                    />
                  </label>
                  <button type="button" className="icon-button" aria-label="この化粧品を削除" onClick={() => removeCosmetic(item.id)}>
                    ×
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              className="secondary-button add-button"
              onClick={() => setDiagnosis({ ...diagnosis, currentProducts: [...diagnosis.currentProducts, createCosmetic()] })}
            >
              化粧品を追加
            </button>
          </section>

          <div className="sticky-actions">
            <button type="button" className="secondary-button" onClick={() => setPage("top")}>
              戻る
            </button>
            <button
              type="button"
              className="primary-button"
              disabled={diagnosis.skinTypes.length === 0 || (diagnosis.troubles.length === 0 && !diagnosis.customTroubleText.trim())}
              onClick={showResults}
            >
              結果を見る
            </button>
          </div>
        </section>
      ) : null}

      {page === "result" ? (
        <div className="results">
          <section className="panel">
            <div className="section-head">
              <p className="kicker">Result</p>
              <h2>おすすめ商品</h2>
              <p>
                {rakutenRecommendations.length > 0
                  ? "楽天市場から取得した商品を、入力内容との一致度で並べています。"
                  : "入力内容から優先タグを作り、商品DBのタグ一致数と価格で並べています。"}
              </p>
            </div>
            <div className="tag-row">
              {priorityTags.map((tag) => (
                <span key={tag}>{tag}</span>
              ))}
            </div>
            <div className="result-status">
              {isLoadingRakutenProducts ? <p>楽天市場の商品を取得しています...</p> : null}
              {!isLoadingRakutenProducts && rakutenRecommendations.length > 0 ? (
                <p className="status-success">楽天市場から{rakutenProducts.length}件取得しました。楽天の商品を表示しています。</p>
              ) : null}
              {!isLoadingRakutenProducts && !rakutenProductError && rakutenProducts.length === 0 ? (
                <p className="status-fallback">楽天市場の商品が0件だったため、手入力の商品DBを表示しています。</p>
              ) : null}
              {!isLoadingRakutenProducts && rakutenProducts.length > 0 && rakutenRecommendations.length === 0 ? (
                <p className="status-fallback">
                  楽天市場から{rakutenProducts.length}件取得しましたが、条件に合う商品が少ないため手入力の商品DBを表示しています。
                </p>
              ) : null}
              {!isLoadingRakutenProducts && rakutenProductError ? (
                <p className="status-fallback">
                  楽天API取得エラーのため、手入力の商品DBを表示しています。詳細: {rakutenProductError}
                </p>
              ) : null}
            </div>
          </section>

          <section className="product-list">
            {recommendations.map((recommendation, index) => (
              <article className="product-card" key={recommendation.product.id}>
                <div className="rank">#{index + 1}</div>
                <a className="product-image-link" href={recommendation.product.affiliateUrl} target="_blank" rel="noreferrer">
                  <ProductImage
                    src={recommendation.product.imageUrl}
                    alt={recommendation.product.name}
                    brand={recommendation.product.brand}
                    name={recommendation.product.name}
                  />
                </a>
                <div className="product-body">
                  <p className="brand">{recommendation.product.brand}</p>
                  <h3>
                    <a href={recommendation.product.affiliateUrl} target="_blank" rel="noreferrer">
                      {recommendation.product.name}
                    </a>
                  </h3>
                  <div className="category-row" aria-label="商品カテゴリ">
                    {productCategoryTags(recommendation.product.tags).map((category) => (
                      <span key={category}>{category}</span>
                    ))}
                  </div>
                  <p className="price">{recommendation.product.priceLabel}</p>
                  {recommendation.matchedTags.length > 0 ? (
                    <div className="match-row" aria-label="一致したタグ">
                      {recommendation.matchedTags.slice(0, 6).map((tag) => (
                        <span key={tag}>{tag}</span>
                      ))}
                    </div>
                  ) : null}
                  <div className="feature-row">
                    {recommendation.product.features.map((feature) => (
                      <span key={feature}>{feature}</span>
                    ))}
                  </div>
                  <p className="ingredients">成分特徴: {recommendation.product.ingredients.join("、")}</p>
                  <a className="affiliate-button" href={recommendation.product.affiliateUrl} target="_blank" rel="noreferrer">
                    楽天で見る
                  </a>
                </div>
              </article>
            ))}
          </section>

          <section className="panel">
            <div className="section-head">
              <p className="kicker">Ingredients</p>
              <h2>成分ミニ辞典</h2>
            </div>
            <div className="dictionary">
              {ingredientGuides.map((ingredient) => (
                <article key={ingredient.name}>
                  <h3>{ingredient.name}</h3>
                  <p>{ingredient.summary}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="panel notice">
            <p>この結果は医療診断ではありません。肌に強い違和感がある場合は、購入判断だけで済ませず専門家へ相談してください。</p>
            <div className="actions">
              <button type="button" className="primary-button" onClick={() => setPage("diagnosis")}>
                入力を修正する
              </button>
              <button type="button" className="danger-button" onClick={resetDiagnosisData}>
                入力データをリセット
              </button>
              <button type="button" className="secondary-button" onClick={() => setPage("top")}>
                トップへ
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}

function ProductImage({ src, alt, brand, name }: { src: string; alt: string; brand: string; name: string }) {
  const [hasError, setHasError] = useState(false);

  if (hasError || !src) {
    return (
      <div className="product-image-fallback" aria-label={`${alt}の商品画像`}>
        <span>{brand}</span>
        <strong>{name}</strong>
      </div>
    );
  }

  return (
    <img
      className="product-image"
      src={src}
      alt={alt}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setHasError(true)}
    />
  );
}

function Step({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="step">
      <h3>{title}</h3>
      {children}
    </section>
  );
}

function ChipGroup<T extends string>({
  options,
  selected,
  onSelect,
}: {
  options: T[];
  selected: T[];
  onSelect: (option: T) => void;
}) {
  return (
    <div className="chip-grid">
      {options.map((option) => (
        <button
          type="button"
          className={selected.includes(option) ? "chip active" : "chip"}
          key={option}
          onClick={() => onSelect(option)}
        >
          {option}
        </button>
      ))}
    </div>
  );
}
