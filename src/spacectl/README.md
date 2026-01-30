# spacectl

Install and execute the [spacectl](https://github.com/namespacelabs/space) CLI in GitHub Actions.

## Installation

```typescript
import { install } from "@namespacelabs/actions-toolkit/spacectl";
```

## API

### `install(options?): Promise<InstallResult>`

Installs spacectl and returns the installation result.

```typescript
// Use existing installation or download latest
const result = await install();
console.log(`spacectl ${result.version} at ${result.binPath}`);

// Install specific version
const result = await install({ version: "0.4.0" });

// Install latest
const result = await install({ version: "latest" });

// Install dev version
const result = await install({ version: "dev" });
```

#### Options

| Option        | Type     | Default                    | Description                                     |
| ------------- | -------- | -------------------------- | ----------------------------------------------- |
| `version`     | `string` | `""`                       | Version to install. Empty uses existing/latest. |
| `githubToken` | `string` | `process.env.GITHUB_TOKEN` | GitHub token for API requests.                  |

#### Version Behavior

- `""` (empty): Use existing installation if available, otherwise download latest
- `"latest"`: Always resolve and download the latest stable version
- `"dev"`: Download the latest dev version
- `"X.Y.Z"`: Download a specific version

#### Result

| Property  | Type     | Description                      |
| --------- | -------- | -------------------------------- |
| `binPath` | `string` | Full path to the spacectl binary |
| `version` | `string` | Resolved version                 |

### `exec(binPath, args, options?): Promise<ExecResult>`

Execute the spacectl binary with JSON output.

```typescript
import { install, exec } from "@namespacelabs/actions-toolkit/spacectl";

const { binPath } = await install();
const result = await exec(binPath, ["cache", "modes"]);
console.log(result.stdout);
```

Automatically appends `--output=json` and forwards stderr to stdout for GitHub Actions workflow command processing (e.g., `::debug::`).

On non-zero exit code, parses the JSON error message and exits the process.

#### Options

Accepts all [@actions/exec](https://github.com/actions/toolkit/tree/main/packages/exec) options except `listeners`, `ignoreReturnCode`, and `silent`.

#### Result

| Property   | Type     | Description              |
| ---------- | -------- | ------------------------ |
| `exitCode` | `number` | Process exit code        |
| `stdout`   | `string` | Standard output (JSON)   |
| `stderr`   | `string` | Standard error           |

## Errors

Throws `SpacectlInstallError` on failure with a descriptive `code`:

| Code                     | Description                         |
| ------------------------ | ----------------------------------- |
| `UNSUPPORTED_PLATFORM`   | Platform/architecture not supported |
| `RESOLVE_VERSION_FAILED` | Could not resolve version           |
| `DOWNLOAD_FAILED`        | Failed to download the binary       |
| `EXEC_FAILED`            | Binary execution failed             |

```typescript
import { install, SpacectlInstallError } from "@namespacelabs/actions-toolkit/spacectl";

try {
  await install({ version: "invalid" });
} catch (error) {
  if (error instanceof SpacectlInstallError) {
    console.error(`Install failed: ${error.code}`);
  }
}
```
