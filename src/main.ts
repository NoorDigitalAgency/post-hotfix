import {
  getInput,
  debug,
  info,
  getBooleanInput,
  startGroup,
  endGroup,
  setFailed,
  summary
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

    const version = getBooleanInput('release_version', { required: true });

    info(`Release version: ${version}`);

    const octokit = getOctokit(token);

    const title = `Generated PR for hotfix/${ version } into develop`;

    const body = `**Merge Back** pull request **(develop🠔${ branchName })** for **hotfix** version **${ version }**.`;

    let pull = (await octokit.rest.pulls.create({ owner: context.repo.owner, repo: context.repo.repo, base: 'develop', head: `${ branchName }`, title, body })).data;

    while (pull.mergeable == null) {

      await wait(5000);

      pull = (await octokit.rest.pulls.get({ owner: context.repo.owner, repo: context.repo.repo, pull_number: pull.number })).data;
    }

    if (!pull.mergeable) {

      const url = new URL(context.payload.repository!.html_url!);

      const actor = context.actor;

      const githubUrl = `${url.protocol}//${actor}:${token}@${url.hostname}${url.pathname}.git`;

      await exec('git', ['config', '--global', 'user.email', 'github@noor.se']);

      await exec('git', ['config', '--global', 'user.name', '"Noor’s GitHub Bot"']);

      await exec('git', ['clone', githubUrl, '.']);

      await exec('git', ['checkout', '-b', branchName]);

      await exec('git', ['pull', 'origin', branchName, '--ff']);

      await exec('git', ['merge', 'origin/develop', '--ff', '-X', 'ours']);

      await exec('git', ['push', '--set-upstream', 'origin', branchName]);
    }

    await summary.addRaw(`Merge-Back Pull Request for **develop**: [${title}](${pull.html_url})`, true).write();

  } catch (error) {

    startGroup('Error');

    debug(`${stringify(error, { depth: 5 })}`);

    endGroup();

    if (error instanceof Error) setFailed(error.message);
  }
}

run();
