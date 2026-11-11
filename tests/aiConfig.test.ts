import assert from "node:assert/strict";
import { afterEach, test } from "node:test";

import { initializeCloudAIFromSettings } from "../src/lib/aiConfig";
import { settings, type Settings } from "../src/lib/settings";

const originalMode = process.env.NEXT_PUBLIC_AI_MODE;
const originalEnvKey = process.env.NEXT_PUBLIC_OPENAI_API_KEY;
const originalWindowDescriptor = Object.getOwnPropertyDescriptor(globalThis, "window");
const originalLocalStorageDescriptor = Object.getOwnPropertyDescriptor(globalThis, "localStorage");

function installSettingsStorage(settingsJson: string) {
  const storage: Storage = {
    length: 1,
    clear() {},
    getItem(key) {
      return key === "rowing_app_settings" ? settingsJson : null;
    },
    key(index) {
      return index === 0 ? "rowing_app_settings" : null;
    },
    removeItem() {},
    setItem() {},
  };

  Object.defineProperty(globalThis, "window", {
    value: globalThis,
    configurable: true,
  });
  Object.defineProperty(globalThis, "localStorage", {
    value: storage,
    configurable: true,
  });
}

afterEach(() => {
  if (originalMode === undefined) delete process.env.NEXT_PUBLIC_AI_MODE;
  else process.env.NEXT_PUBLIC_AI_MODE = originalMode;
  if (originalEnvKey === undefined) {
    delete process.env.NEXT_PUBLIC_OPENAI_API_KEY;
  } else {
    process.env.NEXT_PUBLIC_OPENAI_API_KEY = originalEnvKey;
  }

  if (originalWindowDescriptor) {
    Object.defineProperty(globalThis, "window", originalWindowDescriptor);
  } else {
    Reflect.deleteProperty(globalThis, "window");
  }

  if (originalLocalStorageDescriptor) {
    Object.defineProperty(globalThis, "localStorage", originalLocalStorageDescriptor);
  } else {
    Reflect.deleteProperty(globalThis, "localStorage");
  }
});

test("initializeCloudAIFromSettings treats a missing API key as quiet unconfigured state", () => {
  process.env.NEXT_PUBLIC_AI_MODE = "personal";
  delete process.env.NEXT_PUBLIC_OPENAI_API_KEY;
  const storedSettings = JSON.parse(JSON.stringify(settings.getSettings())) as Settings;
  storedSettings.aiSettings.cloudAIEnabled = true;
  storedSettings.aiSettings.openaiApiKey = "";
  installSettingsStorage(JSON.stringify(storedSettings));

  const warnings: unknown[][] = [];
  const originalWarn = console.warn;
  console.warn = (...args: unknown[]) => {
    warnings.push(args);
  };

  try {
    assert.equal(initializeCloudAIFromSettings(), false);
    assert.deepEqual(warnings, []);
  } finally {
    console.warn = originalWarn;
  }
});

test("operator environment keys never initialize browser AI", () => {
  process.env.NEXT_PUBLIC_AI_MODE = 'personal';
  process.env.NEXT_PUBLIC_OPENAI_API_KEY = 'synthetic-public-key';
  const storedSettings = JSON.parse(JSON.stringify(settings.getSettings())) as Settings;
  storedSettings.aiSettings.cloudAIEnabled = true;
  storedSettings.aiSettings.openaiApiKey = '';
  installSettingsStorage(JSON.stringify(storedSettings));
  assert.equal(initializeCloudAIFromSettings(), false);
});
