import { LazyStore } from "@tauri-apps/plugin-store";
import { computed, reactive, ref, watch } from "vue";

export type ThemeMode = "light" | "dark";

export type EditorSettings = {
  theme: ThemeMode;
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  letterSpacing: number;
};

const STORE_PATH = "editor-settings.json";
const STORE_KEY = "editorSettings";

const defaultSettings: EditorSettings = {
  theme: "light",
  fontFamily:
    '"Avenir Next", "Hiragino Sans", "Hiragino Kaku Gothic ProN", "Yu Gothic", "Yu Gothic UI", sans-serif',
  fontSize: 18,
  lineHeight: 1.9,
  letterSpacing: 0.01,
};

const store = new LazyStore(STORE_PATH, {
  defaults: {
    [STORE_KEY]: defaultSettings,
  },
});

const state = reactive({ ...defaultSettings });
const isReady = ref(false);
let initialization: Promise<void> | null = null;

function normalizeSettings(value: Partial<EditorSettings> | null | undefined) {
  return {
    theme: value?.theme === "dark" ? "dark" : defaultSettings.theme,
    fontFamily: value?.fontFamily ?? defaultSettings.fontFamily,
    fontSize: value?.fontSize ?? defaultSettings.fontSize,
    lineHeight: value?.lineHeight ?? defaultSettings.lineHeight,
    letterSpacing: value?.letterSpacing ?? defaultSettings.letterSpacing,
  } satisfies EditorSettings;
}

function applySettings(value: Partial<EditorSettings> | null | undefined) {
  Object.assign(state, normalizeSettings(value));
}

async function initialize() {
  if (!initialization) {
    initialization = (async () => {
      const persisted = await store.get<Partial<EditorSettings>>(STORE_KEY);
      applySettings(persisted);
      isReady.value = true;
    })();
  }

  return initialization;
}

watch(
  state,
  (value) => {
    if (!isReady.value) {
      return;
    }

    void store.set(STORE_KEY, { ...value });
  },
  { deep: true },
);

export function useEditorSettings() {
  void initialize();

  function reset() {
    Object.assign(state, defaultSettings);
  }

  return {
    settings: state,
    defaults: defaultSettings,
    ready: computed(() => isReady.value),
    initialize,
    reset,
  };
}
