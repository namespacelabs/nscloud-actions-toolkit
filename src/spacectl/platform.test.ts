import { describe, it, expect, vi, afterEach } from "vitest";
import * as os from "node:os";
import { getPlatform, getArch, getBinaryName } from "./platform";

vi.mock("node:os");

describe("platform", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("getPlatform", () => {
    it("returns darwin for macOS", () => {
      vi.mocked(os.platform).mockReturnValue("darwin");
      expect(getPlatform()).toBe("darwin");
    });

    it("returns linux for Linux", () => {
      vi.mocked(os.platform).mockReturnValue("linux");
      expect(getPlatform()).toBe("linux");
    });

    it("returns windows for Windows", () => {
      vi.mocked(os.platform).mockReturnValue("win32");
      expect(getPlatform()).toBe("windows");
    });

    it("throws for unsupported platform", () => {
      vi.mocked(os.platform).mockReturnValue("freebsd");
      expect(() => getPlatform()).toThrow("Unsupported platform: freebsd");
    });
  });

  describe("getArch", () => {
    it("returns arm64 for arm64", () => {
      vi.mocked(os.arch).mockReturnValue("arm64");
      expect(getArch()).toBe("arm64");
    });

    it("returns amd64 for x64", () => {
      vi.mocked(os.arch).mockReturnValue("x64");
      expect(getArch()).toBe("amd64");
    });

    it("defaults to amd64 for unknown architectures", () => {
      vi.mocked(os.arch).mockReturnValue("ia32");
      expect(getArch()).toBe("amd64");
    });
  });

  describe("getBinaryName", () => {
    it("returns space.exe on Windows", () => {
      vi.mocked(os.platform).mockReturnValue("win32");
      expect(getBinaryName()).toBe("space.exe");
    });

    it("returns space on macOS", () => {
      vi.mocked(os.platform).mockReturnValue("darwin");
      expect(getBinaryName()).toBe("space");
    });

    it("returns space on Linux", () => {
      vi.mocked(os.platform).mockReturnValue("linux");
      expect(getBinaryName()).toBe("space");
    });
  });
});
