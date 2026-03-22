import { LazyStore } from "@tauri-apps/plugin-store";
import { computed, reactive, ref, watch } from "vue";

export type EditorSession = {
  currentFilePath: string | null;
};

const STORE_PATH = "editor-session.json";
const STORE_KEY = "editorSession";

const defaultSession: EditorSession = {
  currentFilePath: null,
};

const store = new LazyStore(STORE_PATH, {
  defaults: {
    [STORE_KEY]: defaultSession,
  },
});

const state = reactive<EditorSession>({ ...defaultSession });
const isReady = ref(false);
let initialization: Promise<void> | null = null;

function applySession(value: Partial<EditorSession> | null | undefined) {
  state.currentFilePath = value?.currentFilePath ?? null;
}

async function initialize() {
  if (!initialization) {
    initialization = (async () => {
      const persisted = await store.get<Partial<EditorSession>>(STORE_KEY);
      applySession(persisted);
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

export function useEditorSession() {
  void initialize();

  function setCurrentFilePath(path: string | null) {
    state.currentFilePath = path;
  }

  function clearCurrentFilePath() {
    state.currentFilePath = null;
  }

  return {
    session: state,
    ready: computed(() => isReady.value),
    initialize,
    setCurrentFilePath,
    clearCurrentFilePath,
  };
}
