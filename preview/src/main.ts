import * as core from '@actions/core'
import * as github from '@actions/github'
import * as fs from 'fs'
import * as tmp from 'tmp-promise'

import { validateDryRunInput, startAgent } from '@kittengrid-actions/shared'

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
    const ctx = github.context
    const dryRun = await validateDryRunInput(core.getInput('dry-run'))

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

    startAgent(ctx, args, dryRun)
  } catch (error) {
    // Fail the workflow run if an error occurs
    if (error instanceof Error) core.setFailed(error.message)
  }
}
