import { describe, it, expect, vi } from "vitest";
import { normalizeVersion, getLatestVersion, getLatestDevVersion } from "./version";

vi.mock("@actions/core", () => ({
  debug: vi.fn(),
}));

const mockGetLatestRelease = vi.fn();
const mockListReleases = vi.fn();

vi.mock("@actions/github", () => ({
  getOctokit: () => ({
    rest: {
      repos: {
        getLatestRelease: mockGetLatestRelease,
        listReleases: mockListReleases,
      },
    },
    paginate: {
      iterator: () => ({
        async *[Symbol.asyncIterator]() {
          yield { data: [] };
        },
      }),
    },
  }),
}));

describe("version", () => {
  describe("normalizeVersion", () => {
    it("removes v prefix", () => {
      expect(normalizeVersion("v1.2.3")).toBe("1.2.3");
    });

    it("removes uppercase V prefix", () => {
      expect(normalizeVersion("V1.2.3")).toBe("1.2.3");
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

  describe("getLatestVersion", () => {
    it("includes cause when API call fails", async () => {
      const apiError = new Error("API rate limit exceeded");
      mockGetLatestRelease.mockRejectedValueOnce(apiError);

      const error = await getLatestVersion("token").catch((e) => e);
      expect(error).toBeInstanceOf(Error);
      expect(error.message).toContain("Failed to resolve latest version");
      expect(error.cause).toBe(apiError);
    });
  });

  describe("getLatestDevVersion", () => {
    it("includes cause when no dev release found", async () => {
      const error = await getLatestDevVersion("token").catch((e) => e);
      expect(error).toBeInstanceOf(Error);
      expect(error.message).toContain("Failed to resolve dev version");
      expect(error.cause).toBeInstanceOf(Error);
      expect((error.cause as Error).message).toBe("No dev release found");
    });
  });
});
