import { createServer, type IncomingMessage, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import { normalizeVersion, getLatestVersion, getLatestDevVersion } from "./version";

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

  describe("release API", () => {
    let server: Server;
    let baseUrl: string;
    let requests: IncomingMessage[];

    beforeEach(async () => {
      requests = [];
      server = createServer((request, response) => {
        requests.push(request);
        response.setHeader("content-type", "application/json");
      });
      await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
      baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
      vi.stubEnv("GITHUB_API_URL", `${baseUrl}/api/v3`);
      vi.stubEnv("GITHUB_TOKEN", "environment-token");
      vi.stubEnv("NO_PROXY", "127.0.0.1");
      vi.stubEnv("no_proxy", "127.0.0.1");
    });

    afterEach(async () => {
      vi.unstubAllEnvs();
      server.closeAllConnections();
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    });

    it("uses the API URL, explicit token, and orchestration user agent", async () => {
      vi.stubEnv("ACTIONS_ORCHESTRATION_ID", " run/123 ");
      server.on("request", (_request, response) => {
        response.end(JSON.stringify({ tag_name: "v2.3.4" }));
      });

      expect(await getLatestVersion("explicit-token")).toBe("2.3.4");
      expect(requests).toHaveLength(1);
      expect(requests[0].url).toBe("/api/v3/repos/namespacelabs/spacectl/releases/latest");
      expect(requests[0].headers.authorization).toBe("token explicit-token");
      expect(requests[0].headers["user-agent"]).toContain("actions_orchestration_id/run_123");
    });

    it("paginates past stable releases and uses the environment token", async () => {
      server.on("request", (request, response) => {
        if (request.url?.includes("page=2")) {
          response.end(JSON.stringify([{ tag_name: "v2.1.0-dev.4" }]));
        } else {
          response.setHeader(
            "link",
            `<${baseUrl}/api/v3/repos/namespacelabs/spacectl/releases?per_page=100&page=2>; rel="next"`
          );
          response.end(JSON.stringify([{ tag_name: "v3.0.0" }]));
        }
      });

      expect(await getLatestDevVersion()).toBe("2.1.0-dev.4");
      expect(requests.map((request) => request.url)).toEqual([
        "/api/v3/repos/namespacelabs/spacectl/releases?per_page=100",
        "/api/v3/repos/namespacelabs/spacectl/releases?per_page=100&page=2",
      ]);
      expect(
        requests.every((request) => request.headers.authorization === "token environment-token")
      ).toBe(true);
    });

    it("retries a transient API failure", async () => {
      server.on("request", (_request, response) => {
        if (requests.length === 1) {
          response.statusCode = 503;
          response.end(JSON.stringify({ message: "Temporarily unavailable" }));
        } else {
          response.end(JSON.stringify({ tag_name: "v2.3.5" }));
        }
      });

      expect(await getLatestVersion("token")).toBe("2.3.5");
      expect(requests).toHaveLength(2);
    });

    it("includes cause when API call fails", async () => {
      server.on("request", (_request, response) => {
        response.statusCode = 400;
        response.end(JSON.stringify({ message: "Invalid request" }));
      });

      await expect(getLatestVersion("token")).rejects.toMatchObject({
        message: expect.stringContaining("Failed to resolve latest version"),
        cause: { status: 400, message: "Invalid request" },
      });
    });

    it("includes cause when no dev release found", async () => {
      server.on("request", (_request, response) => {
        response.end(JSON.stringify([{ tag_name: "v3.0.0" }]));
      });

      const error = await getLatestDevVersion("token").catch((e) => e);
      expect(error).toBeInstanceOf(Error);
      expect(error.message).toContain("Failed to resolve dev version");
      expect(error.cause).toBeInstanceOf(Error);
      expect((error.cause as Error).message).toBe("No dev release found");
    });
  });
});
