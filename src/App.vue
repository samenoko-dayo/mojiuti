<script setup lang="ts">
import {
  computed,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
} from "vue";
import { open as openFileDialog, save as saveFileDialog } from "@tauri-apps/plugin-dialog";
import { readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { useEditorSession } from "./stores/editorSession";
import { useEditorSettings } from "./stores/editorSettings";
import { FilePlus2, FolderOpen, Save, Settings2 } from "lucide-vue-next";

type SaveState = "idle" | "saving" | "saved" | "error";

const editor = ref<{ $el: HTMLTextAreaElement } | null>(null);
const text = ref("");
const lastSavedText = ref("");
const isSettingsOpen = ref(false);
const saveState = ref<SaveState>("idle");
const saveErrorMessage = ref("");

const { settings, reset } = useEditorSettings();
const {
  session,
  initialize: initializeSession,
  setCurrentFilePath,
  clearCurrentFilePath,
} = useEditorSession();

const themeOptions = [
  { label: "ライト", value: "light" },
  { label: "ダーク", value: "dark" },
] as const;

const fontFamilies = [
  {
    label: "Sans",
    value:
      '"Avenir Next", "Hiragino Sans", "Hiragino Kaku Gothic ProN", "Yu Gothic", "Yu Gothic UI", sans-serif',
  },
  {
    label: "Serif",
    value:
      '"Iowan Old Style", "Hiragino Mincho ProN", "Yu Mincho", "YuMincho", serif',
  },
  {
    label: "Mono",
    value:
      '"SFMono-Regular", "Cascadia Code", "JetBrains Mono", Menlo, Monaco, Consolas, monospace',
  },
] as const;

const currentFilePath = computed<string | null>({
  get() {
    return session.currentFilePath;
  },
  set(value) {
    if (value) {
      setCurrentFilePath(value);
      return;
    }

    clearCurrentFilePath();
  },
});

const currentFileName = computed(() => {
  if (!currentFilePath.value) {
    return "Untitled";
  }

  const segments = currentFilePath.value.split(/[\\/]/);
  return segments[segments.length - 1] || currentFilePath.value;
});

const isDirty = computed(() => text.value !== lastSavedText.value);

const documentTitle = computed(() => {
  const dirtyMark = isDirty.value ? " *" : "";
  return `${currentFileName.value}${dirtyMark} - mojiuti`;
});

const editorStyle = computed(() => ({
  fontFamily: settings.fontFamily,
  fontSize: `${settings.fontSize}px`,
  lineHeight: `${settings.lineHeight}`,
  letterSpacing: `${settings.letterSpacing}em`,
}));

const saveStatusText = computed(() => {
  if (saveState.value === "saving") {
    return "保存中";
  }

  if (saveState.value === "saved") {
    return "保存しました";
  }

  if (saveState.value === "error") {
    return saveErrorMessage.value || "保存に失敗しました";
  }

  return "";
});

function applyTheme(theme: "light" | "dark") {
  if (typeof document === "undefined") {
    return;
  }

  document.documentElement.dataset.theme = theme;
  document.documentElement.classList.toggle("dark", theme === "dark");
}

function setNumericSetting(
  key: "fontSize" | "lineHeight" | "letterSpacing",
  value: string | number,
) {
  const parsed = typeof value === "number" ? value : Number(value);

  if (!Number.isFinite(parsed)) {
    return;
  }

  settings[key] = parsed;
}

function markSaved() {
  lastSavedText.value = text.value;
  saveErrorMessage.value = "";
  saveState.value = "saved";

  window.setTimeout(() => {
    if (saveState.value === "saved") {
      saveState.value = "idle";
    }
  }, 1200);
}

async function loadDocument(path: string) {
  const contents = await readTextFile(path);
  currentFilePath.value = path;
  text.value = contents;
  lastSavedText.value = contents;
  saveErrorMessage.value = "";
  saveState.value = "idle";
}

async function restoreLastOpenedDocument() {
  await initializeSession();

  if (!currentFilePath.value) {
    editor.value?.$el.focus();
    return;
  }

  try {
    await loadDocument(currentFilePath.value);
  } catch (error) {
    console.error("Failed to restore file", error);
    currentFilePath.value = null;
    text.value = "";
    lastSavedText.value = "";
  } finally {
    editor.value?.$el.focus();
  }
}

async function openDocument() {
  const selectedPath = await openFileDialog({
    title: "ファイルを開く",
    multiple: false,
    directory: false,
    filters: [{ name: "Text", extensions: ["txt", "md", "text"] }],
  });

  if (typeof selectedPath !== "string" || selectedPath.length === 0) {
    return;
  }

  try {
    await loadDocument(selectedPath);
    editor.value?.$el.focus();
  } catch (error) {
    console.error("Failed to open file", error);
    saveErrorMessage.value =
      error instanceof Error ? error.message : "ファイルを開けませんでした";
    saveState.value = "error";
  }
}

function newDocument() {
  currentFilePath.value = null;
  text.value = "";
  lastSavedText.value = "";
  saveErrorMessage.value = "";
  saveState.value = "idle";
  editor.value?.$el.focus();
}

async function saveDocument(forceSaveAs = false) {
  if (saveState.value === "saving") {
    return;
  }

  let filePath = currentFilePath.value;

  if (forceSaveAs || !filePath) {
    filePath = await saveFileDialog({
      title: "保存先を選択",
      defaultPath: currentFilePath.value ?? "mojiuti.txt",
      filters: [{ name: "Text", extensions: ["txt", "md", "text"] }],
    });
  }

  if (!filePath) {
    return;
  }

  currentFilePath.value = filePath;
  saveState.value = "saving";

  try {
    await writeTextFile(filePath, text.value);
    markSaved();
  } catch (error) {
    console.error("Failed to save file", error);
    saveErrorMessage.value =
      error instanceof Error ? error.message : "保存に失敗しました";
    saveState.value = "error";
  }
}

function openSettings() {
  isSettingsOpen.value = true;
}

function handleKeydown(event: KeyboardEvent) {
  const isMod = event.ctrlKey || event.metaKey;

  if (isMod && event.key.toLowerCase() === "o") {
    event.preventDefault();
    void openDocument();
    return;
  }

  if (isMod && event.key.toLowerCase() === "n") {
    event.preventDefault();
    newDocument();
    return;
  }

  if (isMod && event.key.toLowerCase() === "s") {
    event.preventDefault();
    void saveDocument(event.shiftKey);
    return;
  }

  if (event.key === "Escape" && isSettingsOpen.value) {
    isSettingsOpen.value = false;
  }
}

watch(
  () => settings.theme,
  (theme) => {
    applyTheme(theme);
  },
  { immediate: true },
);

watch(
  documentTitle,
  (title) => {
    if (typeof document !== "undefined") {
      document.title = title;
    }
  },
  { immediate: true },
);

onMounted(() => {
  void restoreLastOpenedDocument();
  window.addEventListener("keydown", handleKeydown);
});

onBeforeUnmount(() => {
  window.removeEventListener("keydown", handleKeydown);
});
</script>

<template>
  <main class="min-h-screen bg-background text-foreground">
    <header
      class="fixed inset-x-0 top-0 z-30 border-b border-border/70 bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/75"
    >
      <div class="flex h-16 items-center justify-between gap-4 px-4 sm:px-6">
        <div class="flex min-w-0 items-center gap-3">
          <div class="min-w-0">
            <div class="flex items-center gap-2">
              <p class="truncate text-sm font-medium">
                {{ currentFileName }}
              </p>
              <Badge v-if="isDirty" variant="secondary" class="rounded-full">
                未保存
              </Badge>
            </div>
            <p class="truncate text-xs text-muted-foreground">
              {{ currentFilePath ?? "新規ドキュメント" }}
            </p>
          </div>
        </div>

        <div class="flex items-center gap-2">
          <Button variant="ghost" size="sm" class="gap-2" @click="newDocument">
            <FilePlus2 class="size-4" />
            <span class="hidden sm:inline">新規</span>
          </Button>
          <Button variant="ghost" size="sm" class="gap-2" @click="openDocument">
            <FolderOpen class="size-4" />
            <span class="hidden sm:inline">開く</span>
          </Button>
          <Button
            variant="secondary"
            size="sm"
            class="gap-2"
            @click="() => saveDocument()"
          >
            <Save class="size-4" />
            <span class="hidden sm:inline">保存</span>
          </Button>
        </div>
      </div>
    </header>

    <section class="pt-16">
      <Textarea
        ref="editor"
        v-model="text"
        class="min-h-[calc(100vh-4rem)] w-full resize-none rounded-none border-0 bg-transparent px-4 py-6 text-[18px] leading-[1.9] shadow-none focus-visible:ring-0 sm:px-6 lg:px-10"
        :style="editorStyle"
        spellcheck="false"
        autocapitalize="off"
        autocomplete="off"
        autocorrect="off"
        aria-label="Text editor"
        placeholder="ここに文字を打てます"
      />
    </section>

    <Button
      variant="outline"
      size="icon"
      class="fixed right-5 bottom-5 z-40 size-11 rounded-full border-border/80 bg-background/90 shadow-sm backdrop-blur"
      aria-label="設定を開く"
      @click="openSettings"
    >
      <Settings2 class="size-4" />
    </Button>

    <div
      v-if="saveStatusText"
      class="fixed bottom-5 left-5 z-40 max-w-[min(90vw,28rem)]"
      aria-live="polite"
    >
      <Badge variant="outline" class="rounded-full px-3 py-1 text-xs font-normal">
        {{ saveStatusText }}
      </Badge>
    </div>

    <Dialog v-model:open="isSettingsOpen">
      <DialogContent class="sm:max-w-[36rem]">
        <DialogHeader>
          <DialogTitle>設定</DialogTitle>
          <DialogDescription>
            フォントと表示だけを静かに調整します。
          </DialogDescription>
        </DialogHeader>

        <div class="grid gap-5 py-2">
          <div class="grid gap-2">
            <Label for="theme">テーマ</Label>
            <Select id="theme" v-model="settings.theme">
              <SelectTrigger>
                <SelectValue placeholder="テーマを選択" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem
                  v-for="theme in themeOptions"
                  :key="theme.value"
                  :value="theme.value"
                >
                  {{ theme.label }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Separator />

          <div class="grid gap-2">
            <Label for="font-family">フォント</Label>
            <Select id="font-family" v-model="settings.fontFamily">
              <SelectTrigger>
                <SelectValue placeholder="フォントを選択" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem
                  v-for="font in fontFamilies"
                  :key="font.label"
                  :value="font.value"
                >
                  {{ font.label }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div class="grid gap-2">
            <Label for="font-size">文字サイズ</Label>
            <Input
              id="font-size"
              :model-value="settings.fontSize"
              type="number"
              min="12"
              max="28"
              step="1"
              @update:model-value="(value) => setNumericSetting('fontSize', value)"
            />
          </div>

          <div class="grid gap-2">
            <Label for="line-height">行間</Label>
            <Input
              id="line-height"
              :model-value="settings.lineHeight"
              type="number"
              min="1.2"
              max="2.6"
              step="0.05"
              @update:model-value="(value) => setNumericSetting('lineHeight', value)"
            />
          </div>

          <div class="grid gap-2">
            <Label for="letter-spacing">字間</Label>
            <Input
              id="letter-spacing"
              :model-value="settings.letterSpacing"
              type="number"
              min="-0.03"
              max="0.08"
              step="0.005"
              @update:model-value="(value) => setNumericSetting('letterSpacing', value)"
            />
          </div>
        </div>

        <DialogFooter class="gap-2 sm:gap-0">
          <Button variant="ghost" @click="reset">既定値に戻す</Button>
          <Button @click="isSettingsOpen = false">閉じる</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </main>
</template>
