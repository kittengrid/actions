import * as core from '@actions/core'
import * as github from '@actions/github'
import * as exec from '@actions/exec'
import * as fs from 'fs'
import * as tmp from 'tmp-promise'

import {
  downloadAgent,
  showContextInfo,
  populateEnv
} from '@kittengrid-actions/shared'

async function setupConfig(): Promise<string | void> {
  const config = core.getInput('config')
  if (config !== null && config.trim() !== '') {
    const tempFile = await tmp.file({ postfix: '.yml' })
    fs.writeFileSync(tempFile.path, config)
    core.exportVariable('KITTENGRID_CONFIG', tempFile.path)
    core.info('Using config from action input.')
    return tempFile.path
  }
}

/**
 * The main function for the action.
 *
 * @returns Resolves when the action is complete.
 */
export async function run(): Promise<void> {
  try {
    console.log(core.info)

    const ctx = github.context

    core.info('Kittengrid Preview Action is starting...')
    await showContextInfo()

    core.startGroup('Downloading and extracting Kittengrid agent...')
    const agentPath = await downloadAgent()
    core.info(`Kittengrid agent downloaded to: ${agentPath}`)
    core.info('Kittengrid agent extraction complete.')
    core.endGroup()

    core.startGroup('Starting Kittengrid Agent')
    await populateEnv(ctx)

    const configFile = await setupConfig()

    let args: string[] = []
    if (configFile) {
      args = ['--config', configFile]
    }

    // If the actor contains bot
    if (ctx.actor.toLowerCase().includes('bot')) {
      core.info(ctx.actor)
      args.push('--start-services')
      args.push('true')
    }

    // We start terminal by default
    args.push('--start-terminal')
    args.push('true')

    // Sanity check for dry-run variable setting, it has to be 'true' or 'false'
    const dryRunInput = core.getInput('dry-run').toLowerCase()
    if (
      dryRunInput !== 'true' &&
      dryRunInput !== 'false' &&
      dryRunInput !== ''
    ) {
      core.setFailed(
        `Invalid value for dry-run input: ${core.getInput(
          'dry-run'
        )}. It must be either 'true' or 'false'.`
      )
      return
    }

    if (dryRunInput === 'true') {
      core.info('Dry run mode enabled, not executing the agent')
      core.info('I would have run:')
      core.info(`${agentPath} ${args.join(' ')}`)
      return
    }

    await exec.exec('bash', ['-c', 'env | grep KITTENGRID_ > /tmp/vars'])
    await exec.exec('bash', ['-c', 'env | grep PATH > /tmp/vars'])
    await exec.exec('sudo', [
      '-E',
      'bash',
      '-c',
      `source /tmp/vars && ${agentPath} ${args.join(' ')}`
    ])
  } catch (error) {
    // Fail the workflow run if an error occurs
    if (error instanceof Error) core.setFailed(error.message)
  }
}
