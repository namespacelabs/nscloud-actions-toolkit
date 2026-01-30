import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as path from "node:path";
import * as core from "@actions/core";
import * as io from "@actions/io";
import * as tc from "@actions/tool-cache";

import { install, SpacectlInstallError } from "./installer";
import * as execModule from "./exec";
import * as versionModule from "./version";
import * as platformModule from "./platform";

vi.mock("@actions/core");
vi.mock("@actions/io");
vi.mock("@actions/tool-cache");
vi.mock("./exec");
vi.mock("./version");
vi.mock("./platform");

describe("installer", () => {
  const mockGetPlatform = vi.mocked(platformModule.getPlatform);
  const mockGetArch = vi.mocked(platformModule.getArch);
  const mockGetBinaryName = vi.mocked(platformModule.getBinaryName);
  const mockResolveVersion = vi.mocked(versionModule.resolveVersion);
  const mockNormalizeVersion = vi.mocked(versionModule.normalizeVersion);
  const mockExec = vi.mocked(execModule.exec);
  const mockWhich = vi.mocked(io.which);
  const mockTcFind = vi.mocked(tc.find);
  const mockTcDownloadTool = vi.mocked(tc.downloadTool);
  const mockTcExtractTar = vi.mocked(tc.extractTar);
  const mockTcCacheDir = vi.mocked(tc.cacheDir);
  const mockCoreAddPath = vi.mocked(core.addPath);

  beforeEach(() => {
    vi.resetAllMocks();

    mockGetPlatform.mockReturnValue("linux");
    mockGetArch.mockReturnValue("amd64");
    mockGetBinaryName.mockReturnValue("space");
    mockNormalizeVersion.mockImplementation((v) => v.replace(/^v/, ""));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("SpacectlInstallError", () => {
    it("creates error with code", () => {
      const error = new SpacectlInstallError("test message", "DOWNLOAD_FAILED");
      expect(error.message).toBe("test message");
      expect(error.code).toBe("DOWNLOAD_FAILED");
      expect(error.name).toBe("SpacectlInstallError");
    });

    it("creates error with cause", () => {
      const cause = new Error("root cause");
      const error = new SpacectlInstallError("test message", "EXEC_FAILED", cause);
      expect(error.cause).toBe(cause);
    });
  });

  describe("install", () => {
    describe("uses system binary", () => {
      it("uses existing binary from PATH when version is empty", async () => {
        mockWhich.mockResolvedValue("/usr/local/bin/space");
        mockExec.mockResolvedValue({
          exitCode: 0,
          stdout: '{"version":"1.2.3"}',
          stderr: "",
        });

        const result = await install();

        expect(result.binPath).toBe("/usr/local/bin/space");
        expect(result.version).toBe("1.2.3");
        expect(mockCoreAddPath).toHaveBeenCalledWith("/usr/local/bin");
        expect(mockTcDownloadTool).not.toHaveBeenCalled();
      });

      it("uses existing binary from NSC_POWERTOYS_DIR", async () => {
        const originalEnv = process.env.NSC_POWERTOYS_DIR;
        process.env.NSC_POWERTOYS_DIR = "/powertoys";

        mockWhich.mockImplementation(async (tool) => {
          if (tool === "/powertoys/space") return "/powertoys/space";
          throw new Error("not found");
        });
        mockExec.mockResolvedValue({
          exitCode: 0,
          stdout: '{"version":"2.0.0"}',
          stderr: "",
        });

        const result = await install();

        expect(result.binPath).toBe("/powertoys/space");
        expect(result.version).toBe("2.0.0");

        process.env.NSC_POWERTOYS_DIR = originalEnv;
      });

      it("skips system binary when useSystemBinary is false", async () => {
        mockWhich.mockResolvedValue("/usr/local/bin/space");
        mockResolveVersion.mockResolvedValue("1.0.0");
        mockTcFind.mockReturnValue("/cache/space/1.0.0");
        mockExec.mockResolvedValue({
          exitCode: 0,
          stdout: '{"version":"1.0.0"}',
          stderr: "",
        });

        const result = await install({ useSystemBinary: false });

        expect(mockWhich).not.toHaveBeenCalled();
        expect(result.version).toBe("1.0.0");
      });

      it("does not add to PATH when addToPath is false", async () => {
        mockWhich.mockResolvedValue("/usr/local/bin/space");
        mockExec.mockResolvedValue({
          exitCode: 0,
          stdout: '{"version":"1.2.3"}',
          stderr: "",
        });

        await install({ addToPath: false });

        expect(mockCoreAddPath).not.toHaveBeenCalled();
      });
    });

    describe("uses cached binary", () => {
      it("uses cached version when available", async () => {
        mockWhich.mockRejectedValue(new Error("not found"));
        mockResolveVersion.mockResolvedValue("1.5.0");
        mockTcFind.mockReturnValue("/cache/space/1.5.0");
        mockExec.mockResolvedValue({
          exitCode: 0,
          stdout: '{"version":"1.5.0"}',
          stderr: "",
        });

        const result = await install();

        expect(result.binPath).toBe(path.join("/cache/space/1.5.0", "space"));
        expect(result.version).toBe("1.5.0");
        expect(mockCoreAddPath).toHaveBeenCalledWith("/cache/space/1.5.0");
        expect(mockTcDownloadTool).not.toHaveBeenCalled();
      });

      it("uses cached version for specific version request", async () => {
        mockResolveVersion.mockResolvedValue("2.0.0");
        mockTcFind.mockReturnValue("/cache/space/2.0.0");
        mockExec.mockResolvedValue({
          exitCode: 0,
          stdout: '{"version":"2.0.0"}',
          stderr: "",
        });

        const result = await install({ version: "2.0.0" });

        expect(result.version).toBe("2.0.0");
        expect(mockTcDownloadTool).not.toHaveBeenCalled();
      });
    });

    describe("downloads binary", () => {
      it("downloads and caches when not found", async () => {
        mockWhich.mockRejectedValue(new Error("not found"));
        mockResolveVersion.mockResolvedValue("3.0.0");
        mockTcFind.mockReturnValue("");
        mockTcDownloadTool.mockResolvedValue("/tmp/archive.tar.gz");
        mockTcExtractTar.mockResolvedValue("/tmp/extracted");
        mockTcCacheDir.mockResolvedValue("/cache/space/3.0.0");
        mockExec.mockResolvedValue({
          exitCode: 0,
          stdout: '{"version":"3.0.0"}',
          stderr: "",
        });

        const result = await install();

        expect(result.binPath).toBe(path.join("/cache/space/3.0.0", "space"));
        expect(result.version).toBe("3.0.0");
        expect(mockTcDownloadTool).toHaveBeenCalledWith(
          expect.stringContaining("space_3.0.0_linux_amd64.tar.gz"),
          undefined,
          undefined,
          expect.any(Object)
        );
        expect(mockCoreAddPath).toHaveBeenCalledWith("/cache/space/3.0.0");
      });

      it("includes auth header when token provided", async () => {
        mockWhich.mockRejectedValue(new Error("not found"));
        mockResolveVersion.mockResolvedValue("1.0.0");
        mockTcFind.mockReturnValue("");
        mockTcDownloadTool.mockResolvedValue("/tmp/archive.tar.gz");
        mockTcExtractTar.mockResolvedValue("/tmp/extracted");
        mockTcCacheDir.mockResolvedValue("/cache/space/1.0.0");
        mockExec.mockResolvedValue({
          exitCode: 0,
          stdout: '{"version":"1.0.0"}',
          stderr: "",
        });

        await install({ githubToken: "my-token" });

        expect(mockTcDownloadTool).toHaveBeenCalledWith(
          expect.any(String),
          undefined,
          undefined,
          { Authorization: "token my-token" }
        );
      });
    });

    describe("error handling", () => {
      it("throws UNSUPPORTED_PLATFORM for unsupported platform", async () => {
        mockGetPlatform.mockImplementation(() => {
          throw new Error("Unsupported platform: freebsd");
        });

        await expect(install()).rejects.toThrow(SpacectlInstallError);
        await expect(install()).rejects.toMatchObject({
          code: "UNSUPPORTED_PLATFORM",
        });
      });

      it("throws UNSUPPORTED_ARCH for unsupported architecture", async () => {
        mockGetArch.mockImplementation(() => {
          throw new Error("Unsupported architecture: mips");
        });

        await expect(install()).rejects.toThrow(SpacectlInstallError);
        await expect(install()).rejects.toMatchObject({
          code: "UNSUPPORTED_ARCH",
        });
      });

      it("throws RESOLVE_VERSION_FAILED when version resolution fails", async () => {
        mockWhich.mockRejectedValue(new Error("not found"));
        mockResolveVersion.mockRejectedValue(new Error("API error"));

        await expect(install()).rejects.toThrow(SpacectlInstallError);
        await expect(install()).rejects.toMatchObject({
          code: "RESOLVE_VERSION_FAILED",
        });
      });

      it("throws DOWNLOAD_FAILED when download fails", async () => {
        mockWhich.mockRejectedValue(new Error("not found"));
        mockResolveVersion.mockResolvedValue("1.0.0");
        mockTcFind.mockReturnValue("");
        mockTcDownloadTool.mockRejectedValue(new Error("Network error"));

        await expect(install()).rejects.toThrow(SpacectlInstallError);
        await expect(install()).rejects.toMatchObject({
          code: "DOWNLOAD_FAILED",
        });
      });

      it("throws EXEC_FAILED when binary validation fails", async () => {
        mockWhich.mockResolvedValue("/usr/local/bin/space");
        mockExec.mockResolvedValue({
          exitCode: 0,
          stdout: "not valid json",
          stderr: "",
        });

        await expect(install()).rejects.toThrow(SpacectlInstallError);
        await expect(install()).rejects.toMatchObject({
          code: "EXEC_FAILED",
        });
      });
    });
  });
});
