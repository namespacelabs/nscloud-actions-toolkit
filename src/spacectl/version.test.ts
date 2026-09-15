import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";
import { getLatestDevVersion, getLatestVersion, normalizeVersion } from "./version";

function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

describe("version", () => {
  let fetchSpy: MockInstance<typeof fetch>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, "fetch");
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

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

  describe("release API", () => {
    it("gets the latest public GitHub release with the explicit token", async () => {
      vi.stubEnv("GITHUB_API_URL", "https://github.example.com/api/v3");
      vi.stubEnv("GITHUB_TOKEN", "environment-token");
      fetchSpy.mockResolvedValueOnce(jsonResponse({ tag_name: "v2.3.4" }));

      await expect(getLatestVersion("explicit-token")).resolves.toBe("2.3.4");

      expect(fetchSpy).toHaveBeenCalledOnce();
      expect(String(fetchSpy.mock.calls[0][0])).toBe(
        "https://api.github.com/repos/namespacelabs/spacectl/releases/latest"
      );
      expect(new Headers(fetchSpy.mock.calls[0][1]?.headers).get("authorization")).toBe(
        "token explicit-token"
      );
    });

    it("uses the environment token", async () => {
      vi.stubEnv("GITHUB_TOKEN", "environment-token");
      fetchSpy.mockResolvedValueOnce(jsonResponse({ tag_name: "v2.3.4" }));

      await getLatestVersion();

      expect(new Headers(fetchSpy.mock.calls[0][1]?.headers).get("authorization")).toBe(
        "token environment-token"
      );
    });

    it("allows anonymous requests", async () => {
      vi.stubEnv("GITHUB_TOKEN", "");
      fetchSpy.mockResolvedValueOnce(jsonResponse({ tag_name: "v2.3.4" }));

      await expect(getLatestVersion()).resolves.toBe("2.3.4");

      expect(new Headers(fetchSpy.mock.calls[0][1]?.headers).has("authorization")).toBe(false);
    });

    it("paginates until it finds a dev release", async () => {
      fetchSpy
        .mockResolvedValueOnce(
          jsonResponse([{ tag_name: "v3.0.0" }], 200, {
            link: '<https://api.github.com/repositories/123/releases?per_page=100&page=2>; rel="next"',
          })
        )
        .mockResolvedValueOnce(jsonResponse([{ tag_name: "v2.1.0-dev.4" }]));

      await expect(getLatestDevVersion()).resolves.toBe("2.1.0-dev.4");
      expect(fetchSpy.mock.calls.map(([url]) => String(url))).toEqual([
        "https://api.github.com/repos/namespacelabs/spacectl/releases?per_page=100",
        "https://api.github.com/repositories/123/releases?per_page=100&page=2",
      ]);
    });

    it("retries a transient API failure", async () => {
      fetchSpy
        .mockResolvedValueOnce(jsonResponse({ message: "Temporarily unavailable" }, 503))
        .mockResolvedValueOnce(jsonResponse({ tag_name: "v2.3.5" }));

      await expect(getLatestVersion()).resolves.toBe("2.3.5");
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });

    it("includes the API failure as the cause", async () => {
      fetchSpy.mockResolvedValueOnce(jsonResponse({ message: "Invalid request" }, 400));

      await expect(getLatestVersion()).rejects.toMatchObject({
        message: expect.stringContaining("Failed to resolve latest version"),
        cause: { status: 400 },
      });
    });

    it("includes the missing dev release as the cause", async () => {
      fetchSpy.mockResolvedValueOnce(jsonResponse([{ tag_name: "v3.0.0" }]));

      await expect(getLatestDevVersion()).rejects.toMatchObject({
        message: expect.stringContaining("Failed to resolve dev version"),
        cause: { message: "No dev release found" },
      });
    });
  });
});
