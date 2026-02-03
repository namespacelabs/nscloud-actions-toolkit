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
