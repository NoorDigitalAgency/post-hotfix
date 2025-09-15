import {
  getInput,
  debug,
  info,
  startGroup,
  endGroup,
  summary, warning
} from '@actions/core';
import {getOctokit, context} from '@actions/github';
import {inspect as stringify} from 'util';
import {wait} from "./functions";
import {exec} from "@actions/exec";

async function run(): Promise<void> {

  try {

    const token = getInput('token', { required: true });

    debug(`Token: '${token}'`);

    const branchName = getInput('branch_name', { required: true });

    debug(`Branch name: '${branchName}'`);

    const version = getInput('release_version', { required: true });

    info(`Release version: ${version}`);

    const octokit = getOctokit(token);

    const title = `Generated PR for hotfix/${ version } into develop`;

    debug(`Title: '${title}'`);

    const body = `**Merge Back** pull request **(develop🠔${ branchName })** for **hotfix** version **${ version }**.`;

    debug(`Body: '${body}'`);

    const existingPr = (await octokit.rest.pulls.list({ owner: context.repo.owner, repo: context.repo.repo, base: 'develop', head: `${ branchName }` })).data.pop();

    debug(`Existing PR: ${stringify(existingPr, { depth: 5 })}`);

    let pullNumber = (existingPr ?? (await octokit.rest.pulls.create({ owner: context.repo.owner, repo: context.repo.repo, base: 'develop', head: `${ branchName }`, title, body })).data).number;

    debug(`Pull number: '${pullNumber}'`);

    let pull = (await octokit.rest.pulls.get({ owner: context.repo.owner, repo: context.repo.repo, pull_number: pullNumber })).data;

    while (pull.mergeable == null) {

      await wait(5000);

      pull = (await octokit.rest.pulls.get({ owner: context.repo.owner, repo: context.repo.repo, pull_number: pullNumber })).data;
    }

    debug(`Pull: ${stringify(pull, { depth: 5 })}`);

    if (!pull.mergeable) {

      debug(`Pull request is not mergeable`);

      const url = new URL(context.payload.repository!.html_url!);

      const actor = context.actor;

      const githubUrl = `${url.protocol}//${actor}:${token}@${url.hostname}${url.pathname}.git`;

      debug(`GitHub URL: '${githubUrl}'`);

      await exec('git', ['config', '--global', 'user.email', 'github@noor.se']);

      await exec('git', ['config', '--global', 'user.name', '"Noor’s GitHub Bot"']);

      await exec('git', ['clone', githubUrl, '.']);

      // Checkout the hotfix branch
      await exec('git', ['checkout', branchName]);
      
      // Make sure we have the latest hotfix branch
      await exec('git', ['pull', 'origin', branchName]);
      
      // Merge develop into the hotfix branch to resolve conflicts
      // This ensures the PR will be mergeable without conflicts
      await exec('git', ['merge', 'origin/develop', '--no-ff', '--no-commit', '--strategy-option', 'theirs']);
      
      // If there are any conflicts, they are now resolved with 'theirs' strategy
      // Add all changes and create a merge commit
      await exec('git', ['add', '.']);
      await exec('git', ['commit', '--no-edit']);
      
      // Push the updated hotfix branch
      await exec('git', ['push', 'origin', branchName]);

      debug(`Updated ${branchName} branch to be mergeable with develop`);
    }

    await summary.addRaw(`Merge-Back Pull Request for **develop**: [${title}](${pull.html_url})`, true).write();

  } catch (error) {

    startGroup('Error');

    debug(`${stringify(error, { depth: 5 })}`);

    endGroup();

    warning(`Failed to create the merge-back pull request with error${ error instanceof Error ? `: ${error.message}` : '.' }`);
  }
}

run();
