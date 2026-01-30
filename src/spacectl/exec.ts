import * as core from "@actions/core";
import * as actionsExec from "@actions/exec";

export type ExecOptions = Omit<
  actionsExec.ExecOptions,
  "listeners" | "ignoreReturnCode" | "silent"
>;

export type ExecResult = actionsExec.ExecOutput;

export async function exec(
  binPath: string,
  args: string[],
  options?: ExecOptions
): Promise<ExecResult> {
  const execArgs = [...args, "--output=json"];

  let stdout = "";
  let stderr = "";

  const exitCode = await actionsExec.exec(binPath, execArgs, {
    ...options,
    ignoreReturnCode: true,
    silent: true,
    listeners: {
      stdout: (data: Buffer) => {
        stdout += data.toString();
      },
      stderr: (data: Buffer) => {
        stderr += data.toString();
        // Forward stderr to stdout so GitHub Actions can process workflow
        // commands like ::debug::. The space binary outputs these to stderr
        // when --output=json is used to keep stdout clean for JSON.
        process.stdout.write(data);
      },
    },
  });

  if (exitCode !== 0) {
    let errorMessage = `'${binPath} ${execArgs.join(" ")}' failed with exit code ${exitCode}`;
    try {
      const errorJson = JSON.parse(stdout.trim());
      if (errorJson.message) {
        errorMessage = errorJson.message;
      }
    } catch {
      // stdout wasn't valid JSON, use default message
    }
    core.error(errorMessage);
    process.exit(exitCode);
  }

  return { exitCode, stdout, stderr };
}
