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
import {getFriendlyErrorMessage} from './functions';

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
