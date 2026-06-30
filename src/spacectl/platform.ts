import * as fs from "node:fs/promises";
import * as os from "node:os";

export type Platform = "darwin" | "linux" | "windows";
export type Arch = "amd64" | "arm64";

export function getPlatform(): Platform {
  const platform = os.platform();
  switch (platform) {
    case "darwin":
      return "darwin";
    case "linux":
      return "linux";
    case "win32":
      return "windows";
    default:
      throw new Error(`Unsupported platform: ${platform}`);
  }
}

export function getArch(): Arch {
  const arch = os.arch();
  switch (arch) {
    case "arm64":
      return "arm64";
    case "x64":
      return "amd64";
    default:
      throw new Error(`Unsupported architecture: ${arch}`);
  }
}

export function getBinaryName(): string {
  return getPlatform() === "windows" ? "spacectl.exe" : "spacectl";
}

export function getDefaultPowertoysDir(): string {
  switch (getPlatform()) {
    case "darwin":
      return "/opt/powertoys";
    case "linux":
      return "/nsc/powertoys";
    case "windows":
      return "C:\\namespace\\powertoys";
  }
}

export async function isExecutable(filePath: string): Promise<boolean> {
  // Windows has no executable bit, so check existence rather than X_OK there.
  const mode = getPlatform() === "windows" ? fs.constants.F_OK : fs.constants.X_OK;
  try {
    await fs.access(filePath, mode);
    return true;
  } catch {
    return false;
  }
}
