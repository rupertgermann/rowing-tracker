import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { shouldPersistCurrentInsights } from "../src/lib/insightsPersistence";

describe("shouldPersistCurrentInsights", () => {
  test("does not mark an empty analysis result as current", () => {
    assert.equal(shouldPersistCurrentInsights({ insights: [] }), false);
  });

  test("persists generated insights as the current result", () => {
    assert.equal(
      shouldPersistCurrentInsights({
        insights: [{ id: "insight-1", title: "Generated insight" }],
      }),
      true,
    );
  });
});
