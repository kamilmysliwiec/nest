import * as childProcess from 'child_process';
import * as clc from 'cli-color';
import * as log from 'fancy-log';
import { task } from 'gulp';
import { resolve } from 'path';
import { promisify } from 'util';
import { samplePath } from '../config';
import { containsPackageJson, getDirs } from '../util/task-helpers';

const exec = promisify(childProcess.exec);

async function executeNpmScriptInSamples(
  script: string,
  appendScript?: string,
) {
  const directories = getDirs(samplePath);

  for await (const dir of directories) {
    // Check if the sample is a multi-application sample
    const isSingleApplicationSample = containsPackageJson(dir);
    if (!isSingleApplicationSample) {
      // Application is a multi-application sample
      // Go down into the sub-directories
      const subDirs = getDirs(dir);
      for (const subDir of subDirs) {
        await executeNPMScriptInDirectory(subDir, script, appendScript);
      }
    } else {
      await executeNPMScriptInDirectory(dir, script, appendScript);
    }
  }
}

/**
 * Executes the provided NPM script in the specified directory
 * @param dir directory of the application
 * @param script script to execute
 * @param appendScript additional params appended to the script
 */
async function executeNPMScriptInDirectory(
  dir: string,
  script: string,
  appendScript?: string,
) {
  const dirName = dir.replace(resolve(__dirname, '../../../'), '');
  log.info(`Running ${clc.blue(script)} in ${clc.magenta(dirName)}`);
  try {
    const result = await exec(
      `${script} --prefix ${dir} ${appendScript ? '-- ' + appendScript : ''}`,
    );
    log.info(`Finished running ${clc.blue(script)} in ${clc.magenta(dirName)}`);
    if (result.stderr) {
      log.error(result.stderr);
    }
    if (result.stdout) {
      log.error(result.stdout);
    }
  } catch (err) {
    log.error(`Failed running ${clc.blue(script)} in ${clc.magenta(dirName)}`);
    if (err.stderr) {
      log.error(err.stderr);
    }
    if (err.stdout) {
      log.error(err.stdout);
    }
    process.exit(1);
  }
}

task('install:samples', async () =>
  executeNpmScriptInSamples(
    // 'npm ci --no-audit --no-shrinkwrap --no-optional',
    'npm install',
  ),
);
task('build:samples', async () => executeNpmScriptInSamples('npm run build'));
task('test:samples', async () =>
  executeNpmScriptInSamples('npm run test', '--passWithNoTests'),
);
task('test:e2e:samples', async () =>
  executeNpmScriptInSamples('npm run test:e2e', '--passWithNoTests'),
);
