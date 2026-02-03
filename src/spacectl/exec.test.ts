import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as actionsExec from "@actions/exec";
import { exec, SpacectlExecError } from "./exec";

vi.mock("@actions/exec");

describe("exec", () => {
  const mockExec = vi.mocked(actionsExec.exec);
  let stdoutWriteSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.resetAllMocks();
    stdoutWriteSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
  });

  afterEach(() => {
    stdoutWriteSpy.mockRestore();
  });

  it("executes binary and captures stdout", async () => {
    mockExec.mockImplementation(async (_cmd, _args, options) => {
      options?.listeners?.stdout?.(Buffer.from('{"version":"1.0.0"}'));
      return 0;
    });

    const result = await exec(["version"], { binPath: "/path/to/spacectl" });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe('{"version":"1.0.0"}');
    expect(result.stderr).toBe("");
  });

  it("appends --output=json to args", async () => {
    mockExec.mockResolvedValue(0);

    await exec(["version"], { binPath: "/path/to/spacectl" });

    expect(mockExec).toHaveBeenCalledWith(
      "/path/to/spacectl",
      ["version", "--output=json"],
      expect.any(Object)
    );
  });

  it("uses default binPath when not provided", async () => {
    mockExec.mockResolvedValue(0);

    await exec(["version"]);

    expect(mockExec).toHaveBeenCalledWith(
      "spacectl",
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

    const result = await exec(["version"], { binPath: "/path/to/spacectl" });

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("::debug::Some debug info");
    expect(stdoutWriteSpy).toHaveBeenCalledWith(Buffer.from("::debug::Some debug info"));
  });

  it("throws SpacectlExecError on non-zero exit code", async () => {
    mockExec.mockImplementation(async (_cmd, _args, options) => {
      options?.listeners?.stdout?.(Buffer.from('{"message":"error"}'));
      return 1;
    });

    await expect(exec(["cache", "mount"], { binPath: "/path/to/spacectl" })).rejects.toThrow(
      SpacectlExecError
    );

    try {
      await exec(["cache", "mount"], { binPath: "/path/to/spacectl" });
    } catch (e) {
      expect(e).toBeInstanceOf(SpacectlExecError);
      const error = e as SpacectlExecError;
      expect(error.message).toBe("error");
      expect(error.exitCode).toBe(1);
      expect(error.command).toBe("/path/to/spacectl cache mount --output=json");
    }
  });

  it("uses default error message when stdout is not valid JSON", async () => {
    mockExec.mockImplementation(async () => {
      return 1;
    });

    await expect(exec(["cache", "mount"], { binPath: "/path/to/spacectl" })).rejects.toThrow(
      SpacectlExecError
    );

    try {
      await exec(["cache", "mount"], { binPath: "/path/to/spacectl" });
    } catch (e) {
      expect(e).toBeInstanceOf(SpacectlExecError);
      const error = e as SpacectlExecError;
      expect(error.message).toBe(
        "'/path/to/spacectl cache mount --output=json' failed with exit code 1"
      );
    }
  });

  it("passes cwd option to underlying exec", async () => {
    mockExec.mockResolvedValue(0);

    await exec(["version"], { binPath: "/path/to/spacectl", cwd: "/some/dir" });

    expect(mockExec).toHaveBeenCalledWith(
      "/path/to/spacectl",
      ["version", "--output=json"],
      expect.objectContaining({ cwd: "/some/dir" })
    );
  });

  it("passes env option to underlying exec", async () => {
    mockExec.mockResolvedValue(0);
    const customEnv = { MY_VAR: "value" };

    await exec(["version"], { binPath: "/path/to/spacectl", env: customEnv });

    expect(mockExec).toHaveBeenCalledWith(
      "/path/to/spacectl",
      ["version", "--output=json"],
      expect.objectContaining({ env: customEnv })
    );
  });

  it("uses silent and ignoreReturnCode options", async () => {
    mockExec.mockResolvedValue(0);

    await exec(["version"], { binPath: "/path/to/spacectl" });

    expect(mockExec).toHaveBeenCalledWith(
      "/path/to/spacectl",
      ["version", "--output=json"],
      expect.objectContaining({
        silent: true,
        ignoreReturnCode: true,
      })
    );
  });
});
