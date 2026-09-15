import * as core from "@actions/core";
import { HttpClient } from "@actions/http-client";
import { Octokit } from "@octokit/core";
import { paginateRest } from "@octokit/plugin-paginate-rest";
import { restEndpointMethods } from "@octokit/plugin-rest-endpoint-methods";
import { retry } from "@octokit/plugin-retry";
import { fetch } from "undici";

const REPO_OWNER = "namespacelabs";
const REPO_NAME = "spacectl";
const RETRY_OPTIONS = { retries: 3, retryAfter: 0.1 };

// @actions/github eagerly parses GITHUB_EVENT_PATH, which concurrent steps can rewrite.
const GitHub = Octokit.plugin(restEndpointMethods, paginateRest, retry);

function createOctokit(token?: string) {
  const auth = token || process.env.GITHUB_TOKEN;
  if (!auth) {
    throw new Error("Parameter token or opts.auth is required");
  }

  const baseUrl = process.env.GITHUB_API_URL || "https://api.github.com";
  const httpClient = new HttpClient();
  const dispatcher = httpClient.getAgentDispatcher(baseUrl);
  const proxyFetch: typeof fetch = (url, options) => fetch(url, { ...options, dispatcher });
  const orchestrationId = process.env.ACTIONS_ORCHESTRATION_ID?.trim();

  return new GitHub({
    auth: `token ${auth}`,
    baseUrl,
    userAgent: orchestrationId
      ? `actions_orchestration_id/${orchestrationId.replace(/[^a-z0-9_.-]/gi, "_")}`
      : undefined,
    retry: RETRY_OPTIONS,
    request: {
      agent: httpClient.getAgent(baseUrl),
      fetch: proxyFetch,
    },
  });
}

export function normalizeVersion(version: string): string {
  return version.trim().replace(/^[vV]/, "");
}

export async function getLatestVersion(token?: string): Promise<string> {
  const octokit = createOctokit(token);

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
  const octokit = createOctokit(token);

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
