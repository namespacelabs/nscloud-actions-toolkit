# @namespacelabs/actions-toolkit

GitHub Actions toolkit for Namespace.

## Installation

```bash
pnpm add @namespacelabs/actions-toolkit
```

## Usage

### Installing spacectl

```typescript
import { install } from "@namespacelabs/actions-toolkit/spacectl";

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

### API

#### `install(options?: InstallOptions): Promise<InstallResult>`

Installs spacectl and returns the installation result.

**Options:**

| Option        | Type     | Default                         | Description                                      |
| ------------- | -------- | ------------------------------- | ------------------------------------------------ |
| `version`     | `string` | `""`                            | Version to install. Empty uses existing/latest.  |
| `githubToken` | `string` | `process.env.GITHUB_TOKEN`      | GitHub token for API requests.                   |

**Version options:**

- `""` (empty): Use existing installation if available, otherwise download latest
- `"latest"`: Always resolve and download the latest stable version
- `"dev"`: Download the latest dev version
- `"X.Y.Z"`: Download a specific version

**Result:**

| Property  | Type     | Description                           |
| --------- | -------- | ------------------------------------- |
| `binDir`  | `string` | Directory containing the binary       |
| `binPath` | `string` | Full path to the spacectl binary      |
| `version` | `string` | Resolved version                      |

**Errors:**

Throws `SpacectlInstallError` on failure with a descriptive `code`:

- `UNSUPPORTED_PLATFORM`: Platform/architecture not supported
- `RESOLVE_VERSION_FAILED`: Could not resolve version from GitHub
- `DOWNLOAD_FAILED`: Failed to download the binary
- `VALIDATION_FAILED`: Downloaded binary failed validation

## License

Apache-2.0
