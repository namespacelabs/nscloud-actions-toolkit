import * as core from "@actions/core";
import * as github from "@actions/github";
import { retry } from "@octokit/plugin-retry";

const REPO_OWNER = "namespacelabs";
const REPO_NAME = "spacectl";
const RETRY_OPTIONS = { retries: 3, retryAfter: 0.1 };

export function normalizeVersion(version: string): string {
  return version.trim().replace(/^[vV]/, "");
}

export async function getLatestVersion(token?: string): Promise<string> {
  const octokit = github.getOctokit(
    token || process.env.GITHUB_TOKEN || "",
    { retry: RETRY_OPTIONS },
    retry
  );

  try {
    const { data: release } = await octokit.rest.repos.getLatestRelease({
      owner: REPO_OWNER,
      repo: REPO_NAME,
    });
    return normalizeVersion(release.tag_name);
  } catch (error) {
    core.debug(`Failed to get latest release: ${error}`);
    throw new Error(
      `Failed to resolve latest version. ` +
        `If hitting rate limits, provide a GitHub token via options.githubToken or GITHUB_TOKEN env var.`,
      { cause: error }
    );
  }
}

export async function getLatestDevVersion(token?: string): Promise<string> {
  const octokit = github.getOctokit(
    token || process.env.GITHUB_TOKEN || "",
    { retry: RETRY_OPTIONS },
    retry
  );

  try {
    const iterator = octokit.paginate.iterator(octokit.rest.repos.listReleases, {
      owner: REPO_OWNER,
      repo: REPO_NAME,
      per_page: 100,
    });

    for await (const { data: releases } of iterator) {
      for (const release of releases) {
        if (release.tag_name.includes("-dev")) {
          return normalizeVersion(release.tag_name);
        }
      }
    }

    throw new Error("No dev release found");
  } catch (error) {
    core.debug(`Failed to get dev release: ${error}`);
    throw new Error(
      `Failed to resolve dev version. ` +
        `If hitting rate limits, provide a GitHub token via options.githubToken or GITHUB_TOKEN env var.`,
      { cause: error }
    );
  }
}

export async function resolveVersion(versionSpec: string, token?: string): Promise<string> {
  const spec = versionSpec.trim().toLowerCase();

  if (spec === "" || spec === "latest") {
    return getLatestVersion(token);
  }

  if (spec === "dev") {
    return getLatestDevVersion(token);
  }

  return normalizeVersion(versionSpec);
}
