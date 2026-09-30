import { describe, expect, it } from "vitest";
import { toSearchText } from "./sources/fanatics";

describe("Fanatics search text", () => {
  it("keeps required words and phrases, drops exclusions and wildcards", () => {
    expect(toSearchText('kucherov shield -reprint "logo patch" kuch*')).toBe("kucherov shield logo patch");
  });
  it("returns null when nothing is required", () => {
    expect(toSearchText("-reprint")).toBeNull();
  });
});
