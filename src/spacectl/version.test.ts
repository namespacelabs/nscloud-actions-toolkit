import { describe, it, expect } from "vitest";
import { normalizeVersion } from "./version";

describe("version", () => {
  describe("normalizeVersion", () => {
    it("removes v prefix", () => {
      expect(normalizeVersion("v1.2.3")).toBe("1.2.3");
    });

    it("handles version without prefix", () => {
      expect(normalizeVersion("1.2.3")).toBe("1.2.3");
    });

    it("trims whitespace", () => {
      expect(normalizeVersion("  v1.2.3  ")).toBe("1.2.3");
    });

    it("handles dev versions", () => {
      expect(normalizeVersion("v1.2.3-dev")).toBe("1.2.3-dev");
    });
  });
});
