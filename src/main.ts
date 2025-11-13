import {
  getInput,
  debug,
  info,
  startGroup,
  endGroup,
  summary,
  warning
} from '@actions/core';
import {getOctokit, context} from '@actions/github';
import {inspect as stringify} from 'util';

type RequestErrorLike = {
  status?: number;
  response?: {
    data?: {
      message?: string;
      errors?: Array<{message?: string}>;
    };
  };
};

const NO_COMMITS_REGEX = /No commits between (\S+) and (\S+)/i;

function collectErrorMessages(error: unknown): string[] {
  const messages: string[] = [];

  if (error instanceof Error && error.message) {
    messages.push(error.message);
  }

  if (typeof error === 'object' && error !== null) {
    const candidate = error as RequestErrorLike;
    const data = candidate.response?.data;

    if (data?.message) {
      messages.push(data.message);
    }

    const nestedErrors = data?.errors;

    if (Array.isArray(nestedErrors)) {
      for (const entry of nestedErrors) {
        if (entry?.message) {
          messages.push(entry.message);
        }
      }
    }
  }

  return messages;
}

function extractNoDiffDetails(error: unknown): {base: string; head: string} | undefined {
  const messages = collectErrorMessages(error);

  for (const message of messages) {
    const match = message.match(NO_COMMITS_REGEX);

    if (match?.[1] && match?.[2]) {
      const [, base, head] = match;

      return {base, head};
    }
  }

  return undefined;
}

function getFriendlyErrorMessage(error: unknown): string {
  const noDiff = extractNoDiffDetails(error);

  if (noDiff) {
    const {base, head} = noDiff;

    return `Unable to create a merge-back pull request because '${head}' has no new commits compared to '${base}'. If the branches already match, you can skip rerunning this action or push new changes before retrying.`;
  }

  const defaultMessage = 'Failed to create the merge-back pull request.';
  const detail = error instanceof Error ? error.message : stringify(error, {depth: 2});

  return detail ? `${defaultMessage} ${detail}` : defaultMessage;
}

async function run(): Promise<void> {

  try {

    const token = getInput('token', { required: true });

    debug(`Token: '${token}'`);

    const branchName = getInput('branch_name', { required: true });

    debug(`Branch name: '${branchName}'`);

    const version = getInput('release_version', { required: true });

    info(`Release version: ${version}`);

    const stage = getInput('stage', { required: true });

    info(`Stage: ${stage}`);

    const octokit = getOctokit(token);

    type PullRequestConfig = {
      head: string;
      base: string;
    };

    const stageLower = stage.toLowerCase();

    const pullRequestMatrix: Record<string, PullRequestConfig[]> = {
      production: [
        { head: branchName, base: 'release' },
        { head: branchName, base: 'develop' }
      ],
      beta: [
        { head: branchName, base: 'develop' }
      ]
    };

    const configs = pullRequestMatrix[stageLower];

    if (!configs) {
      throw new Error(`Unsupported stage '${stage}'. Supported values: production, beta.`);
    }

    const createTitle = (head: string, base: string): string =>
      `Generated PR for hotfix/${ version } (${ head }🠖${ base })`;

    const createBody = (head: string, base: string): string =>
      `**Merge Back** pull request **(${ base }🠔${ head })** for **hotfix** version **${ version }** in **${ stage }** stage.`;

    const pulls = [];

    for (const {head, base} of configs) {
      const title = createTitle(head, base);
      const body = createBody(head, base);

      debug(`Processing PR | base: '${base}' | head: '${head}' | title: '${title}'`);

      const existingPrs = (await octokit.rest.pulls.list({
        owner: context.repo.owner,
        repo: context.repo.repo,
        state: 'open',
        base,
        head: `${context.repo.owner}:${head}`
      })).data;

      const existingPr = existingPrs.find(pr =>
        pr.head.ref === head &&
        pr.base.ref === base &&
        pr.state === 'open'
      );

      debug(`Existing PR for ${head}->${base}: ${stringify(existingPr, { depth: 5 })}`);

      const pull = existingPr ?? (await octokit.rest.pulls.create({
        owner: context.repo.owner,
        repo: context.repo.repo,
        base,
        head,
        title,
        body
      })).data;

      debug(`Pull created/found for ${head}->${base}: ${stringify(pull, { depth: 3 })}`);

      pulls.push(pull);
    }

    for (const pull of pulls) {
      summary.addRaw(
        `Merge-Back Pull Request for **${pull.base.ref}**: [${pull.title}](${pull.html_url})`,
        true
      );
    }

    await summary.write();

  } catch (error) {

    startGroup('Error');

    debug(`${stringify(error, { depth: 5 })}`);

    endGroup();

    warning(getFriendlyErrorMessage(error));
  }
}

run();
