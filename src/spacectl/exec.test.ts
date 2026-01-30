import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as core from "@actions/core";
import * as actionsExec from "@actions/exec";
import { exec } from "./exec";

vi.mock("@actions/core");
vi.mock("@actions/exec");

describe("exec", () => {
  const mockExec = vi.mocked(actionsExec.exec);
  const mockCoreError = vi.mocked(core.error);
  let stdoutWriteSpy: ReturnType<typeof vi.spyOn>;
  let processExitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.resetAllMocks();
    stdoutWriteSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    processExitSpy = vi.spyOn(process, "exit").mockImplementation(() => undefined as never);
  });

  afterEach(() => {
    stdoutWriteSpy.mockRestore();
    processExitSpy.mockRestore();
  });

  it("executes binary and captures stdout", async () => {
    mockExec.mockImplementation(async (_cmd, _args, options) => {
      options?.listeners?.stdout?.(Buffer.from('{"version":"1.0.0"}'));
      return 0;
    });

    const result = await exec("/path/to/space", ["version"]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe('{"version":"1.0.0"}');
    expect(result.stderr).toBe("");
  });

  it("appends --output=json to args", async () => {
    mockExec.mockResolvedValue(0);

    await exec("/path/to/space", ["version"]);

    expect(mockExec).toHaveBeenCalledWith(
      "/path/to/space",
      ["version", "--output=json"],
      expect.any(Object)
    );
  });

  it("captures stderr and forwards to process.stdout", async () => {
    mockExec.mockImplementation(async (_cmd, _args, options) => {
      options?.listeners?.stderr?.(Buffer.from("::debug::Some debug info"));
      options?.listeners?.stdout?.(Buffer.from('{"version":"1.0.0"}'));
      return 0;
    });

    const result = await exec("/path/to/space", ["version"]);

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("::debug::Some debug info");
    expect(stdoutWriteSpy).toHaveBeenCalledWith(Buffer.from("::debug::Some debug info"));
  });

  it("exits process on non-zero exit code", async () => {
    mockExec.mockImplementation(async (_cmd, _args, options) => {
      options?.listeners?.stdout?.(Buffer.from('{"message":"error"}'));
      return 1;
    });

    await exec("/path/to/space", ["cache", "mount"]);

    expect(mockCoreError).toHaveBeenCalledWith("error");
    expect(processExitSpy).toHaveBeenCalledWith(1);
  });

  it("uses default error message when stdout is not valid JSON", async () => {
    mockExec.mockImplementation(async () => {
      return 1;
    });

    await exec("/path/to/space", ["cache", "mount"]);

    expect(mockCoreError).toHaveBeenCalledWith(
      "'/path/to/space cache mount --output=json' failed with exit code 1"
    );
    expect(processExitSpy).toHaveBeenCalledWith(1);
  });

  it("passes cwd option to underlying exec", async () => {
    mockExec.mockResolvedValue(0);

    await exec("/path/to/space", ["version"], { cwd: "/some/dir" });

    expect(mockExec).toHaveBeenCalledWith(
      "/path/to/space",
      ["version", "--output=json"],
      expect.objectContaining({ cwd: "/some/dir" })
    );
  });

  it("passes env option to underlying exec", async () => {
    mockExec.mockResolvedValue(0);
    const customEnv = { MY_VAR: "value" };

    await exec("/path/to/space", ["version"], { env: customEnv });

    expect(mockExec).toHaveBeenCalledWith(
      "/path/to/space",
      ["version", "--output=json"],
      expect.objectContaining({ env: customEnv })
    );
  });

  it("uses silent and ignoreReturnCode options", async () => {
    mockExec.mockResolvedValue(0);

    await exec("/path/to/space", ["version"]);

    expect(mockExec).toHaveBeenCalledWith(
      "/path/to/space",
      ["version", "--output=json"],
      expect.objectContaining({
        silent: true,
        ignoreReturnCode: true,
      })
    );
  });
});
