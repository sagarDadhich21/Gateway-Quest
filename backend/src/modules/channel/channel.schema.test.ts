import { describe, expect, it } from "vitest";
import { channelIdParamSchema, channelMappingIdParamSchema, generateConnectionTokenSchema } from "./channel.schema";

describe("channelIdParamSchema", () => {
  it("accepts a valid uuid", () => {
    expect(() => channelIdParamSchema.parse({ channelId: "11111111-1111-1111-1111-111111111111" })).not.toThrow();
  });

  it("rejects a non-uuid", () => {
    expect(() => channelIdParamSchema.parse({ channelId: "not-a-uuid" })).toThrow();
  });
});

describe("channelMappingIdParamSchema", () => {
  it("accepts two valid uuids", () => {
    expect(() =>
      channelMappingIdParamSchema.parse({
        channelId: "11111111-1111-1111-1111-111111111111",
        mappingId: "22222222-2222-2222-2222-222222222222",
      })
    ).not.toThrow();
  });

  it("rejects an invalid mappingId even when channelId is valid", () => {
    expect(() =>
      channelMappingIdParamSchema.parse({
        channelId: "11111111-1111-1111-1111-111111111111",
        mappingId: "not-a-uuid",
      })
    ).toThrow();
  });
});

describe("generateConnectionTokenSchema", () => {
  it("allows an omitted username", () => {
    expect(() => generateConnectionTokenSchema.parse({})).not.toThrow();
  });

  it("rejects an empty-string username", () => {
    expect(() => generateConnectionTokenSchema.parse({ username: "" })).toThrow();
  });

  it("accepts a real username", () => {
    expect(generateConnectionTokenSchema.parse({ username: "front-desk" }).username).toBe("front-desk");
  });
});
