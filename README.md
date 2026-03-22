# mojiuti

ただ文字を打つための、最小限のデスクトップアプリです。

Tauri v2, Vue, Bun, shadcn-vue で作っています。

## できること

- 文章を打つ
- ファイルを開く
- ファイルを保存する
- 開いていたファイルを次回起動時に復元する
- フォントやテーマを切り替える

## 開発

```bash
bun install
bun run dev
```

## ビルド

```bash
bun run build
bun run tauri build
```

## 使っているもの

- Vue 3
- Tauri v2
- Bun
- shadcn-vue
- Tauri store plugin

