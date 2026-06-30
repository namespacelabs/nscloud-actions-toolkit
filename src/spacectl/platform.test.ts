import { describe, it, expect } from "vitest";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import {
  getPlatform,
  getArch,
  getBinaryName,
  getDefaultPowertoysDir,
  isExecutable,
  type Platform,
  type Arch,
} from "./platform";

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

  describe("getDefaultPowertoysDir", () => {
    it("returns the platform-specific default powertoys directory", () => {
      const platform = getPlatform();
      const dir = getDefaultPowertoysDir();

      switch (platform) {
        case "darwin":
          expect(dir).toBe("/opt/powertoys");
          break;
        case "linux":
          expect(dir).toBe("/nsc/powertoys");
          break;
        case "windows":
          expect(dir).toBe("C:\\namespace\\powertoys");
          break;
      }
    });
  });

  describe("isExecutable", () => {
    it("returns false for a non-existent file", async () => {
      const missing = path.join(os.tmpdir(), "spacectl-does-not-exist-xyz");
      expect(await isExecutable(missing)).toBe(false);
    });

    it("returns true for an existing executable file", async () => {
      const dir = await fs.mkdtemp(path.join(os.tmpdir(), "spacectl-"));
      const file = path.join(dir, "bin");
      await fs.writeFile(file, "");

      if (getPlatform() !== "windows") {
        await fs.chmod(file, 0o755);
      }

      expect(await isExecutable(file)).toBe(true);
    });

    it("returns false for a non-executable file on POSIX", async () => {
      // Windows has no executable bit, so existence alone counts there.
      if (getPlatform() === "windows") return;

      const dir = await fs.mkdtemp(path.join(os.tmpdir(), "spacectl-"));
      const file = path.join(dir, "data");
      await fs.writeFile(file, "");
      await fs.chmod(file, 0o644);

      expect(await isExecutable(file)).toBe(false);
    });
  });
});
