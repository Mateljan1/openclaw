import type { AgentMessage } from "@mariozechner/pi-agent-core";
import { describe, expect, it } from "vitest";
import { stripErrorStateAssistantMessages } from "./google.js";

function asMessages(raw: unknown[]): AgentMessage[] {
  return raw as AgentMessage[];
}

describe("stripErrorStateAssistantMessages", () => {
  it("removes assistant messages with stopReason error", () => {
    const messages = asMessages([
      { role: "user", content: [{ type: "text", text: "hello" }] },
      {
        role: "assistant",
        content: [{ type: "text", text: "response" }],
        stopReason: "stop",
      },
      { role: "user", content: [{ type: "text", text: "retry" }] },
      {
        role: "assistant",
        content: [{ type: "text", text: "" }],
        stopReason: "error",
        errorMessage: "LLM request rejected",
      },
      { role: "user", content: [{ type: "text", text: "try again" }] },
    ]);

    const result = stripErrorStateAssistantMessages(messages);

    expect(result).toHaveLength(4);
    expect(result.map((m) => (m as { role: string }).role)).toEqual([
      "user",
      "assistant",
      "user",
      "user",
    ]);
    // The remaining assistant should be the good one
    expect((result[1] as { stopReason?: string }).stopReason).toBe("stop");
  });

  it("removes multiple consecutive error-state assistant messages", () => {
    const messages = asMessages([
      { role: "user", content: [{ type: "text", text: "ask" }] },
      {
        role: "assistant",
        content: [
          { type: "thinking", thinking: "..." },
          { type: "text", text: "good" },
        ],
        stopReason: "stop",
      },
      { role: "user", content: [{ type: "text", text: "follow up" }] },
      {
        role: "assistant",
        content: [],
        stopReason: "error",
        errorMessage: "overloaded",
      },
      { role: "user", content: [{ type: "text", text: "retry 1" }] },
      {
        role: "assistant",
        content: [{ type: "text", text: "" }],
        stopReason: "error",
        errorMessage: "overloaded",
      },
      { role: "user", content: [{ type: "text", text: "retry 2" }] },
    ]);

    const result = stripErrorStateAssistantMessages(messages);

    expect(result).toHaveLength(5);
    const roles = result.map((m) => (m as { role: string }).role);
    expect(roles).toEqual(["user", "assistant", "user", "user", "user"]);
  });

  it("returns the same array reference when no error-state messages exist", () => {
    const messages = asMessages([
      { role: "user", content: [{ type: "text", text: "hello" }] },
      {
        role: "assistant",
        content: [{ type: "text", text: "hi" }],
        stopReason: "stop",
      },
    ]);

    const result = stripErrorStateAssistantMessages(messages);

    expect(result).toBe(messages);
  });

  it("preserves assistant messages with stopReason aborted", () => {
    // "aborted" is a different stop reason, handled elsewhere; only "error" should be stripped
    const messages = asMessages([
      { role: "user", content: [{ type: "text", text: "do something" }] },
      {
        role: "assistant",
        content: [{ type: "toolCall", id: "tc-1", name: "exec" }],
        stopReason: "aborted",
      },
    ]);

    const result = stripErrorStateAssistantMessages(messages);

    expect(result).toBe(messages);
    expect(result).toHaveLength(2);
  });

  it("preserves toolResult messages unaffected", () => {
    const messages = asMessages([
      { role: "user", content: [{ type: "text", text: "run" }] },
      {
        role: "assistant",
        content: [{ type: "toolCall", id: "tc-1", name: "exec" }],
        stopReason: "toolUse",
      },
      {
        role: "toolResult",
        toolCallId: "tc-1",
        content: [{ type: "text", text: "done" }],
      },
      {
        role: "assistant",
        content: [],
        stopReason: "error",
        errorMessage: "failed",
      },
    ]);

    const result = stripErrorStateAssistantMessages(messages);

    expect(result).toHaveLength(3);
    expect(result.map((m) => (m as { role: string }).role)).toEqual([
      "user",
      "assistant",
      "toolResult",
    ]);
  });

  it("handles empty message array", () => {
    const result = stripErrorStateAssistantMessages([]);

    expect(result).toEqual([]);
  });
});
