import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import { z } from "zod";
import { cloudAI } from "../src/lib/cloudAI";
import { SettingsService, type AISettings } from "../src/lib/settings";
import { DEFAULT_CHAT_SYSTEM_PROMPT } from "../src/lib/aiPromptDefaults";
import { buildPostureAIPayload, type PostureAIPayload } from "../src/lib/mocap/aiPayload";

const requestSchema = z.object({
  input: z.array(z.object({ role: z.string(), content: z.string() })),
  tools: z.array(z.object({ name: z.string() })),
});

async function captureChatRequest(
  t: TestContext,
  updates: Partial<AISettings>,
  posturePayload?: PostureAIPayload | null,
) {
  const service = SettingsService.getInstance();
  const settings = service.getSettings();
  t.mock.method(service, "getSettings", () => ({
    ...settings,
    aiSettings: { ...settings.aiSettings, userProfileContext: "", ...updates },
  }));
  let body = "";
  t.mock.method(globalThis, "fetch", async (url: unknown, init?: RequestInit) => {
    assert.equal(url, "https://api.openai.com/v1/responses");
    const requestBody = init?.body;
    assert.ok(typeof requestBody === "string");
    body = requestBody;
    return Response.json({
      id: "test-response",
      output: [{ type: "message", content: [{ type: "output_text", text: "reply" }] }],
    });
  });
  const mode = process.env.NEXT_PUBLIC_AI_MODE;
  process.env.NEXT_PUBLIC_AI_MODE = "personal";
  t.after(() => {
    if (mode === undefined) delete process.env.NEXT_PUBLIC_AI_MODE;
    else process.env.NEXT_PUBLIC_AI_MODE = mode;
  });
  cloudAI.initialize("synthetic-test-key");
  const result = await cloudAI.sendChatMessage("hello", [], [], undefined, undefined, undefined, posturePayload);
  assert.equal(result.content, "reply");
  const request = requestSchema.parse(JSON.parse(body));
  const systemMessage = request.input.find(message => message.role === "system");
  assert.ok(systemMessage);
  return { prompt: systemMessage.content, tools: request.tools.map(tool => tool.name), body };
}

test("sendChatMessage sends the configured Chat System Prompt", async (t) => {
  const customPrompt = "CUSTOM_CHAT_PROMPT_SENTINEL_7E91";
  const { prompt } = await captureChatRequest(t, { chatSystemPrompt: customPrompt });
  assert.equal(prompt.includes(customPrompt), true, "Configured chat prompt is absent from the request");
  assert.equal(prompt, customPrompt);
});

for (const chatSystemPrompt of ["", " \n\t "]) {
  test(`${chatSystemPrompt ? "whitespace-only" : "empty"} chat prompts use the canonical default`, async (t) => {
    const { prompt } = await captureChatRequest(t, { chatSystemPrompt });
    assert.equal(prompt, DEFAULT_CHAT_SYSTEM_PROMPT);
  });
}

test("the legacy placeholder resolves to the complete canonical default", async (t) => {
  const { prompt } = await captureChatRequest(t, { chatSystemPrompt: "You are a personal AI rowing coach..." });
  assert.equal(prompt, DEFAULT_CHAT_SYSTEM_PROMPT);
  assert.match(prompt, /TOOLS AVAILABLE/);
  assert.match(prompt, /CRITICAL FORMATTING RULES/);
  assert.match(prompt, /get_mocap_sessions/);
});

test("new settings use the same canonical chat prompt as the settings editor", () => {
  assert.equal(SettingsService.getInstance().getSettings().aiSettings.chatSystemPrompt, DEFAULT_CHAT_SYSTEM_PROMPT);
});

for (const chatSystemPrompt of ["Custom coach instructions", ""]) {
  test(`chat preserves Personal Context, safe posture context and tools with ${chatSystemPrompt ? "custom" : "default"} instructions`, async (t) => {
    const posturePayload = buildPostureAIPayload(
      [{ faultType: "early_back_opening", severity: "warning" }],
      [{
        strokeIndex: 0,
        segmentationSource: "test",
        metricsJson: { backAngleAtCatchDeg: 15, keypoints: "RAW_POSE_SENTINEL" },
      }],
      [],
      0.9,
      { cloudAIEnabled: true, mocapDetailedAIShare: true },
    );
    assert.ok(posturePayload);
    const { prompt, tools, body } = await captureChatRequest(t, {
      chatSystemPrompt,
      userProfileContext: "  PERSONAL_CONTEXT_SENTINEL  ",
    }, posturePayload);

    assert.ok(prompt.startsWith(chatSystemPrompt || DEFAULT_CHAT_SYSTEM_PROMPT));
    assert.match(prompt, /PERSONAL_CONTEXT_SENTINEL/);
    assert.match(prompt, /POSTURE ANALYSIS CONTEXT/);
    assert.match(prompt, /"early_back_opening":\s*1/);
    assert.match(prompt, /"backAngleAtCatchDeg":\s*15/);
    assert.ok(prompt.indexOf("PERSONAL_CONTEXT_SENTINEL") < prompt.indexOf("POSTURE ANALYSIS CONTEXT"));
    assert.doesNotMatch(body, /RAW_POSE_SENTINEL/);
    assert.doesNotMatch(prompt, /"(?:keypoints|landmarks|poseFrames)"\s*:/);
    assert.deepEqual(tools, ["get_sessions", "get_mocap_sessions", "get_memory_documents", "get_achievements"]);
  });
}
