import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { SpacectlInstallError } from "./installer";

describe("installer", () => {
  beforeEach(() => {
    vi.resetModules();
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
});
