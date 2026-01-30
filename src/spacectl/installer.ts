import * as path from "node:path";
import * as core from "@actions/core";
import * as io from "@actions/io";
import * as tc from "@actions/tool-cache";

import { exec } from "./exec";
import { getPlatform, getArch, getBinaryName } from "./platform";
import { resolveVersion, normalizeVersion } from "./version";

const TOOL_NAME = "space";
const REPO_OWNER = "namespacelabs";
const REPO_NAME = "space";

export interface InstallOptions {
  version?: string;
  githubToken?: string;
}

export interface InstallResult {
  binPath: string;
  version: string;
}

export type SpacectlInstallErrorCode =
  | "UNSUPPORTED_PLATFORM"
  | "RESOLVE_VERSION_FAILED"
  | "DOWNLOAD_FAILED"
  | "EXEC_FAILED";

export class SpacectlInstallError extends Error {
  readonly code: SpacectlInstallErrorCode;
  readonly cause?: unknown;

  constructor(message: string, code: SpacectlInstallErrorCode, cause?: unknown) {
    super(message);
    this.name = "SpacectlInstallError";
    this.code = code;
    this.cause = cause;
  }
}

async function findExistingBinary(): Promise<string | undefined> {
  const binaryName = getBinaryName();

  const powertoysDir = process.env.NSC_POWERTOYS_DIR;
  if (powertoysDir) {
    const powertoysPath = path.join(powertoysDir, binaryName);
    try {
      await io.which(powertoysPath, true);
      core.debug(`Found existing binary in powertoys: ${powertoysPath}`);
      return powertoysPath;
    } catch {
      core.debug(`Binary not found in powertoys dir: ${powertoysPath}`);
    }
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
  const result = await exec(binPath, ["version"]);

  try {
    const parsed = JSON.parse(result.stdout.trim());
    return normalizeVersion(parsed.version);
  } catch (error) {
    core.debug(`Failed to parse version output: ${error}`);
    throw new SpacectlInstallError(`Failed to validate binary at ${binPath}`, "EXEC_FAILED", error);
  }
}

function getDownloadUrl(version: string): string {
  const platform = getPlatform();
  const arch = getArch();
  const filename = `${TOOL_NAME}_${version}_${platform}_${arch}.tar.gz`;
  return `https://github.com/${REPO_OWNER}/${REPO_NAME}/releases/download/v${version}/${filename}`;
}

async function downloadAndCache(version: string, token?: string): Promise<string> {
  const platform = getPlatform();
  const arch = getArch();
  const url = getDownloadUrl(version);

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

  try {
    getPlatform();
  } catch (error) {
    throw new SpacectlInstallError(
      `Unsupported platform: ${process.platform}`,
      "UNSUPPORTED_PLATFORM",
      error
    );
  }

  const arch = getArch();
  const binaryName = getBinaryName();

  if (versionSpec === "") {
    const existingPath = await findExistingBinary();
    if (existingPath) {
      const version = await getInstalledVersion(existingPath);
      core.info(`Using existing spacectl ${version} at ${existingPath}`);
      return {
        binPath: existingPath,
        version,
      };
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
    return {
      binPath,
      version: targetVersion,
    };
  }

  const cachedDir = await downloadAndCache(targetVersion, token);
  const binPath = path.join(cachedDir, binaryName);

  await getInstalledVersion(binPath);

  return {
    binPath,
    version: targetVersion,
  };
}
