import * as core from "@actions/core";
import { Octokit } from "@octokit/core";
import { paginateRest } from "@octokit/plugin-paginate-rest";
import { retry } from "@octokit/plugin-retry";

const REPO_OWNER = "namespacelabs";
const REPO_NAME = "spacectl";
const RETRY_OPTIONS = { retries: 3, retryAfter: 0.1 };
const GitHub = Octokit.plugin(paginateRest, retry);

function createGitHubClient(token?: string) {
  const auth = token || process.env.GITHUB_TOKEN;
  return new GitHub({
    ...(auth ? { auth } : {}),
    retry: RETRY_OPTIONS,
  });
}

export function normalizeVersion(version: string): string {
  return version.trim().replace(/^[vV]/, "");
}

export async function getLatestVersion(token?: string): Promise<string> {
  const github = createGitHubClient(token);

  try {
    const { data: release } = await github.request("GET /repos/{owner}/{repo}/releases/latest", {
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
  const github = createGitHubClient(token);

  try {
    const iterator = github.paginate.iterator("GET /repos/{owner}/{repo}/releases", {
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
