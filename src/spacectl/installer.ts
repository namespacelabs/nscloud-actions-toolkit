import { existsSync } from "node:fs";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as core from "@actions/core";
import * as io from "@actions/io";
import * as tc from "@actions/tool-cache";

import { exec } from "./exec";
import { getPlatform, getArch, getBinaryName, type Platform, type Arch } from "./platform";
import { resolveVersion, normalizeVersion } from "./version";

const TOOL_NAME = "spacectl";
const REPO_OWNER = "namespacelabs";
const REPO_NAME = "spacectl";

export interface InstallOptions {
  version?: string;
  githubToken?: string;
  /** System binary resolution strategy. @default "prefer" */
  systemBinary?: "prefer" | "require" | "ignore";
  /** Add binary directory to PATH via core.addPath(). @default true */
  addToPath?: boolean;
}

export interface InstallResult {
  binPath: string;
  version: string;
  /** Whether the binary was downloaded (false if using existing/cached binary) */
  downloaded: boolean;
}

export type SpacectlInstallErrorCode =
  | "UNSUPPORTED_PLATFORM"
  | "UNSUPPORTED_ARCH"
  | "SYSTEM_BINARY_NOT_FOUND"
  | "RESOLVE_VERSION_FAILED"
  | "DOWNLOAD_FAILED"
  | "EXEC_FAILED";

export class SpacectlInstallError extends Error {
  readonly code: SpacectlInstallErrorCode;

  constructor(message: string, code: SpacectlInstallErrorCode, cause?: unknown) {
    super(message, { cause });
    this.name = "SpacectlInstallError";
    this.code = code;
  }
}

async function findExistingBinary(): Promise<string | undefined> {
  const binaryName = getBinaryName();

  const powertoysDir = process.env.NSC_POWERTOYS_DIR;
  core.debug(`powertoys directory: ${powertoysDir}`);

  if (powertoysDir) {
    const powertoysPath = path.join(powertoysDir, binaryName);
    try {
      await fs.access(powertoysPath, fs.constants.X_OK);
      core.debug(`Found existing binary in powertoys: ${powertoysPath}`);
      return powertoysPath;
    } catch {
      core.warning(`Binary at powertoys path is not executable: ${powertoysPath}`);
    }
  }

  const defaultDir = getPlatform() === "darwin" ? "/opt/powertoys" : "/nsc/powertoys";
  const defaultPath = path.join(defaultDir, binaryName);
  core.debug(`Checking default powertoys path: ${defaultPath}`);
  if (existsSync(defaultPath)) {
    try {
      await fs.access(defaultPath, fs.constants.X_OK);
      core.debug(`Found existing binary at default path: ${defaultPath}`);
      return defaultPath;
    } catch {
      core.warning(`Binary at default path is not executable: ${defaultPath}`);
    }
  } else {
    core.debug(`Binary not found at default path: ${defaultPath}`);
  }

  try {
    const systemPath = await io.which(TOOL_NAME, true);
    core.debug(`Found existing binary on PATH: ${systemPath}`);
    return systemPath;
  } catch {
    core.debug("Binary not found on PATH");
  }

  return undefined;
}

async function getInstalledVersion(binPath: string): Promise<string> {
  const result = await exec(["version"], { binPath });

  try {
    const parsed = JSON.parse(result.stdout.trim());
    return normalizeVersion(parsed.version);
  } catch (error) {
    core.debug(`Failed to parse version output: ${error}`);
    throw new SpacectlInstallError(`Failed to validate binary at ${binPath}`, "EXEC_FAILED", error);
  }
}

export function getDownloadUrl(version: string, platform: Platform, arch: Arch): string {
  const filename = `${TOOL_NAME}_${version}_${platform}_${arch}.tar.gz`;
  return `https://github.com/${REPO_OWNER}/${REPO_NAME}/releases/download/v${version}/${filename}`;
}

async function downloadAndCache(
  version: string,
  platform: Platform,
  arch: Arch,
  token?: string
): Promise<string> {
  const url = getDownloadUrl(version, platform, arch);

  core.info(`Downloading spacectl ${version} from ${url}`);

  let archivePath: string;
  try {
    const headers: Record<string, string> = {};
    if (token) {
      headers["Authorization"] = `token ${token}`;
    }
    archivePath = await tc.downloadTool(url, undefined, undefined, headers);
  } catch (error) {
    throw new SpacectlInstallError(
      `Failed to download spacectl ${version} for ${platform}/${arch}`,
      "DOWNLOAD_FAILED",
      error
    );
  }

  const extractedPath = await tc.extractTar(archivePath);
  const cachedPath = await tc.cacheDir(extractedPath, TOOL_NAME, version, arch);

  core.info(`Cached spacectl ${version} to ${cachedPath}`);
  return cachedPath;
}

export async function install(options: InstallOptions = {}): Promise<InstallResult> {
  const versionSpec = options.version ?? "";
  const token = options.githubToken ?? process.env.GITHUB_TOKEN;

  let platform: Platform;
  try {
    platform = getPlatform();
  } catch (error) {
    throw new SpacectlInstallError(
      `Unsupported platform: ${process.platform}`,
      "UNSUPPORTED_PLATFORM",
      error
    );
  }

  let arch: Arch;
  try {
    arch = getArch();
  } catch (error) {
    throw new SpacectlInstallError(
      `Unsupported architecture: ${process.arch}`,
      "UNSUPPORTED_ARCH",
      error
    );
  }

  const binaryName = getBinaryName();
  const systemBinary = options.systemBinary ?? "prefer";

  if (systemBinary === "require" || (systemBinary === "prefer" && versionSpec === "")) {
    const existingPath = await findExistingBinary();
    if (existingPath) {
      const version = await getInstalledVersion(existingPath);
      core.info(`Using existing spacectl ${version} at ${existingPath}`);
      if (options.addToPath !== false) {
        core.addPath(path.dirname(existingPath));
      }
      return {
        binPath: existingPath,
        version,
        downloaded: false,
      };
    }
    if (systemBinary === "require") {
      throw new SpacectlInstallError(
        "No existing spacectl binary found in powertoys or on PATH",
        "SYSTEM_BINARY_NOT_FOUND"
      );
    }
    core.info("No existing spacectl found, downloading latest version");
  }

  let targetVersion: string;
  try {
    targetVersion =
      versionSpec === ""
        ? await resolveVersion("latest", token)
        : await resolveVersion(versionSpec, token);
  } catch (error) {
    throw new SpacectlInstallError(
      `Failed to resolve version "${versionSpec}"`,
      "RESOLVE_VERSION_FAILED",
      error
    );
  }

  const cached = tc.find(TOOL_NAME, targetVersion, arch);
  if (cached) {
    const binPath = path.join(cached, binaryName);
    core.info(`Using cached spacectl ${targetVersion} at ${cached}`);
    if (options.addToPath !== false) {
      core.addPath(cached);
    }
    return {
      binPath,
      version: targetVersion,
      downloaded: false,
    };
  }

  const cachedDir = await downloadAndCache(targetVersion, platform, arch, token);
  const binPath = path.join(cachedDir, binaryName);

  await getInstalledVersion(binPath);

  if (options.addToPath !== false) {
    core.addPath(cachedDir);
  }

  return {
    binPath,
    version: targetVersion,
    downloaded: true,
  };
}
