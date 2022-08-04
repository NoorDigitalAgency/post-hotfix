import * as core from '@actions/core';
import { create } from '@actions/artifact';
import { rmRF } from '@actions/io';
import { inspect as stringify } from 'util';
import { readFileSync, existsSync } from 'fs';

async function run(): Promise<void> {

  try {

    const token = core.getInput('token', { required: true });

    core.debug(`Token: '${token}'`);

    const artifactName = core.getInput('artifact_name');

    core.debug(`Artifact name: '${artifactName}'`);

    const exports = core.getBooleanInput('exports');

    core.info(`Exports is: ${exports}`);

    const client = create();

    try {

      await client.downloadArtifact(artifactName);

    } catch (error) {

      throw new Error(`Failed to download artifact '${artifactName}'. Make sure the 'release-startup' action is already run with the same artifact name.`);
    }

    const file = `${artifactName}.json`;

    if (!existsSync(file)) {

      throw new Error(`Artifact file '${file}' doesn't exist.`);
    }

    core.debug(`Artifact file name: '${file}'`);

    const {version, plainVersion, previousVersion, reference} = JSON.parse(readFileSync(file).toString()) as {version: string; plainVersion: string; previousVersion: string; reference: string};

    core.debug(`Version is: ${version}`);

    core.debug(`Previous version is: ${previousVersion}`);

    core.debug(`Reference is: ${reference}`);

    rmRF(file).catch((error) => {

      core.warning(`File '${file} could not be removed.'`);

      core.startGroup('Artifact removal error');

      core.debug(`${stringify(error, { depth: 5 })}`);

      core.endGroup();
    });

    if (exports) {

      core.debug('Attempting to export the environment varibales.');

      core.exportVariable('RELEASE_VERSION', version);

      core.exportVariable('RELEASE_PLAIN_VERSION', plainVersion);

      core.exportVariable('RELEASE_PREVIOUS_VERSION', previousVersion);

      core.exportVariable('RELEASE_REFERENCE', reference);

      core.debug('Exported the environment varibales.');
    }

    core.setOutput('version', version);

    core.setOutput('plain_version', plainVersion);

    core.setOutput('previous_version', previousVersion);

    core.setOutput('reference', reference);

  } catch (error) {

    core.startGroup('Error');

    core.debug(`${stringify(error, { depth: 5 })}`);

    core.endGroup();

    if (error instanceof Error) core.setFailed(error.message)
  }
}

run();
