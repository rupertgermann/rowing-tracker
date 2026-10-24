import assert from "node:assert/strict";
import { test } from "node:test";
import { loadModule } from "./helpers/loadModule";
import type { ChatSession } from "../src/lib/cloudAI";
import { cloudAI } from "../src/lib/cloudAI";
import type { ChatState, useChat } from "../src/hooks/useChat";

test("reopening a chat loads messages after the first 200", async () => {
  const timestamp = "2026-10-24T12:00:00Z";
  const calls: string[] = [];
  const { chatStorage } = loadModule<{
    chatStorage: { getSession(id: string): Promise<ChatSession> };
  }>("src/lib/chatStorage.ts", {
    "@/lib/dateTimeUtils": { formatSessionDate: () => "today" },
  }, {
    fetch: async (input: string) => {
      calls.push(input);
      if (!input.includes("sessionId=")) {
        return Response.json({ chatSessions: [{ id: "chat", title: "Chat", createdAt: timestamp, updatedAt: timestamp }] });
      }
      const cursor = new URL(input, "http://localhost").searchParams.get("cursor");
      const ids = cursor ? [200] : Array.from({ length: 200 }, (_, i) => i);
      return Response.json({
        messages: ids.map(id => ({ id: String(id), role: "user", content: `message ${id}`, timestamp })),
        nextCursor: cursor ? null : "199",
      });
    },
  });

  const session = await chatStorage.getSession("chat");
  assert.equal(session.messages.length, 201);
  assert.equal(session.messages.at(-1)?.content, "message 200");
  assert.equal(calls.filter(url => url.includes("sessionId=")).length, 2);
});

test("an interrupted coaching stream is rejected instead of saved as complete", async (t) => {
  cloudAI.initialize("synthetic-test-key");
  const partial = { type: "message", content: [{ type: "output_text", text: "Partial answer" }] };
  const stream = `data: ${JSON.stringify({ type: "response.output_item.done", output_index: 0, item: partial })}\n\n`;
  t.mock.method(globalThis, "fetch", async () => new Response(stream, { status: 200 }));

  await assert.rejects(
    cloudAI.sendChatMessage("test", [], [], undefined, () => {}),
    /interrupted|incomplete/i,
  );
});

test("a completed coaching stream returns the final answer", async (t) => {
  cloudAI.initialize("synthetic-test-key");
  const answer = { id: "response-1", output: [{ type: "message", content: [{ type: "output_text", text: "Complete answer" }] }] };
  const stream = `data: ${JSON.stringify({ type: "response.completed", response: answer })}\n\n`;
  t.mock.method(globalThis, "fetch", async () => new Response(stream, { status: 200 }));

  const result = await cloudAI.sendChatMessage("test", [], [], undefined, () => {});
  assert.equal(result.content, "Complete answer");
  assert.equal(result.responseId, "response-1");
});

test("chat page loads and switches conversations through the paginated loader", async () => {
  let state: ChatState;
  const loaded: string[] = [];
  const timestamp = "2026-10-24T12:00:00Z";
  const hook = loadModule<{ useChat: typeof useChat }>("src/hooks/useChat.ts", {
    "react": {
      useState: (initial: ChatState) => {
        state ??= initial;
        return [state, (update: (previous: ChatState) => ChatState) => { state = update(state); }];
      },
      useCallback: (callback: unknown) => callback,
      useEffect: () => {},
    },
    "@/lib/store": { useRowingStore: () => ({}) },
    "@/lib/cloudAI": { cloudAI: {} },
    "@/lib/aiConfig": { isAIAvailable: () => true },
    "@/lib/chatStorage": { loadChatMessages: async (id: string) => {
      loaded.push(id);
      return Array.from({ length: 201 }, (_, i) => ({ id: String(i), sessionId: id, role: "user", content: String(i), timestamp: new Date(timestamp) }));
    } },
  }, {
    window: {},
    localStorage: { getItem: () => "chat", setItem() {} },
    fetch: async () => Response.json({ chatSessions: [{ id: "chat", title: "Chat", createdAt: timestamp, updatedAt: timestamp }] }),
  });

  await hook.useChat().loadSessions();
  assert.equal(hook.useChat().currentSessionMessages.length, 201);
  await hook.useChat().switchSession("chat");
  assert.equal(hook.useChat().currentSessionMessages.length, 201);
  assert.deepEqual(loaded, ["chat", "chat"]);
});
