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

    // Only start services when the workflow is triggered manually, to avoid
    // starting services during pull request or push events
    if (ctx.eventName === "workflow_dispatch") {
      args.push('--start-services')
      args.push('true')

      args.push('--start-terminal')
      args.push('true')
    }

    await startAgent(ctx, args, dryRun, false)
    process.exit(0);
  } catch (error) {
    // Fail the workflow run if an error occurs
    if (error instanceof Error) core.setFailed(error.message)
    else core.setFailed(String(error))
  }
}
