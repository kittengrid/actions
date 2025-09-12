import * as core from '@actions/core'
import * as github from '@actions/github'
import * as fs from 'fs'
import * as tmp from 'tmp-promise'
import yaml from 'js-yaml'

import { validateDryRunInput, startAgent } from '@kittengrid-actions/shared'

async function setupConfig(config: Object): Promise<string | void> {
  if (config !== null) {
    const tempFile = await tmp.file({ postfix: '.yml' })
    fs.writeFileSync(tempFile.path, yaml.dump(config))
    core.exportVariable('KITTENGRID_CONFIG', tempFile.path)
    core.info('Using config from action input.')
    return tempFile.path
  }
}

/**
 * Processes the healthcheck input.
 *
 * @param healthcheck - The healthcheck input string, a comma separated list of properties in the form key=value
 * @returns The processed healthcheck as an object, or undefined if the input is empty
 */

function processHealthCheck(healthcheck: string): Object | undefined {
  const defaults = {
    interval: '30',
    timeout: '10',
    retries: '3',
    path: '/'
  }

  if (healthcheck && healthcheck.trim() !== '') {
    const healthcheckParts = healthcheck.split(',').map((part) => part.trim())
    healthcheckParts.forEach((part) => {
      const [key, value] = part.split('=').map((p) => p.trim())
      if (key in defaults && value) {
        // @ts-ignore
        defaults[key] = value
      }
    })

    return defaults
  }

  return undefined
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
    var config: Object = {
      services: [
        {
          name: core.getInput('name'),
          cmd: core.getInput('cmd'),
          port: core.getInput('port'),
          healthcheck: processHealthCheck(core.getInput('healthcheck'))
        }
      ]
    }

    const configFile = await setupConfig(config)

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
