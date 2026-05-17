# Skin Match 30秒診断

既存アプリとは独立した、肌診断 × アフィリエイト商品推薦のMVPです。

## 機能

- ログイン不要
- ステップ形式の肌情報入力
- LocalStorageで前回診断を保存
- JSON商品DB
- ルールベースの商品推薦
- 推薦理由と成分特徴の表示
- 楽天リンクへの遷移
- スマホ対応

## 主なファイル

```text
src/App.tsx
src/data/products.ts
src/services/recommendation.ts
src/services/storage.ts
src/styles.css
```

## 開発

```bash
npm install
npm run dev
```

## ビルド

```bash
npm run build
```

## 運用メモ

- `src/data/products.ts` の `affiliateUrl` を正式な楽天アフィリエイトURLへ差し替えてください。
- 商品選定はAIではなくルールベースです。
- OpenAI APIを使う場合は、APIキー保護のためサーバーまたはサーバーレス関数経由で推薦理由生成だけを差し替える想定です。
- 本アプリは医療診断ではありません。
