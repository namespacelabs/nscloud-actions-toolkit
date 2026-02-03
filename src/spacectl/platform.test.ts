import { describe, it, expect } from "vitest";
import { getPlatform, getArch, getBinaryName, type Platform, type Arch } from "./platform";

describe("platform", () => {
  describe("getPlatform", () => {
    it("returns a valid platform for the current system", () => {
      const platform = getPlatform();
      expect(["darwin", "linux", "windows"]).toContain(platform);
    });

    it("returns correct type", () => {
      const platform: Platform = getPlatform();
      expect(typeof platform).toBe("string");
    });
  });

  describe("getArch", () => {
    it("returns a valid architecture for the current system", () => {
      const arch = getArch();
      expect(["amd64", "arm64"]).toContain(arch);
    });

    it("returns correct type", () => {
      const arch: Arch = getArch();
      expect(typeof arch).toBe("string");
    });
  });

  describe("getBinaryName", () => {
    it("returns a valid binary name for the current platform", () => {
      const binaryName = getBinaryName();
      expect(["spacectl", "spacectl.exe"]).toContain(binaryName);
    });

    it("returns spacectl.exe only on windows", () => {
      const platform = getPlatform();
      const binaryName = getBinaryName();

      if (platform === "windows") {
        expect(binaryName).toBe("spacectl.exe");
      } else {
        expect(binaryName).toBe("spacectl");
      }
    });
  });
});
