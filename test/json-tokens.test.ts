import { describe, expect, it } from "vitest";
import { tokenizeJson } from "../src/report/json-tokens.ts";

describe("tokenizeJson", () => {
  it("labels keys, strings, numbers and literals", () => {
    const json = JSON.stringify({ a: "x", b: -1.5e3, c: [true, null] }, null, 2);
    const kinds = tokenizeJson(json)
      .filter((t) => t.kind)
      .map((t) => [t.kind, t.text]);
    expect(kinds).toEqual([
      ["key", '"a"'],
      ["string", '"x"'],
      ["key", '"b"'],
      ["number", "-1500"],
      ["key", '"c"'],
      ["literal", "true"],
      ["literal", "null"],
    ]);
  });

  it("keeps every character, in order", () => {
    const json = JSON.stringify({ 'say "hi": 1': "a\\b", n: 0 }, null, 2);
    expect(
      tokenizeJson(json)
        .map((t) => t.text)
        .join(""),
    ).toBe(json);
  });

  it("does not colour numbers or literals inside strings", () => {
    const tokens = tokenizeJson('{"k": "true 42"}');
    expect(tokens.filter((t) => t.kind).map((t) => t.kind)).toEqual(["key", "string"]);
  });

  it("leaves a string cut off by truncation as plain text", () => {
    const json = '{\n  "stack": "Error at line 1…';
    const tokens = tokenizeJson(json);
    expect(tokens.map((t) => t.text).join("")).toBe(json);
    expect(tokens.find((t) => t.text.includes("Error"))?.kind).toBeUndefined();
  });
});
