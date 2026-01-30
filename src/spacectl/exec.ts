import * as actionsExec from "@actions/exec";

export type ExecOptions = Omit<
  actionsExec.ExecOptions,
  "listeners" | "ignoreReturnCode" | "silent"
>;

export type ExecResult = actionsExec.ExecOutput;

export class SpacectlExecError extends Error {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
  readonly command: string;

  constructor(
    message: string,
    exitCode: number,
    stdout: string,
    stderr: string,
    command: string,
    cause?: unknown
  ) {
    super(message, cause !== undefined ? { cause } : undefined);
    this.name = "SpacectlExecError";
    this.exitCode = exitCode;
    this.stdout = stdout;
    this.stderr = stderr;
    this.command = command;
  }
}

export async function exec(
  args: string[],
  options?: ExecOptions & { binPath?: string }
): Promise<ExecResult> {
  const binPath = options?.binPath ?? "space"; // install() should have added to path by default
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
    const command = `${binPath} ${execArgs.join(" ")}`;
    let errorMessage = `'${command}' failed with exit code ${exitCode}`;
    try {
      const errorJson = JSON.parse(stdout.trim());
      if (errorJson.message) {
        errorMessage = errorJson.message;
      }
    } catch {
      // stdout wasn't valid JSON, use default message
    }
    throw new SpacectlExecError(errorMessage, exitCode, stdout, stderr, command);
  }

  return { exitCode, stdout, stderr };
}
