import * as core from '@actions/core'
import { platform } from '@actions/core'
import * as github from '@actions/github'
import * as exec from '@actions/exec'
import * as fs from 'fs'
import * as tmp from 'tmp-promise'

import { downloadAgent, AGENT_VERSION } from './utils.js'

async function showContextInfo(): Promise<void> {
  core.startGroup('Kittengrid Agent Info')
  core.info(`Action version: ${process.env['GITHUB_ACTIONS']}`)
  core.info(`Node version: ${process.version}`)
  core.info(`Agent version: ${AGENT_VERSION}`)
  core.info(`Architecture: ${core.platform.arch}`)
  core.info(`Operating System: ${platform.platform}`)
  core.endGroup()
}

async function populateEnv(ctx: typeof github.context): Promise<void> {
  const event_number = ctx.payload.pull_request?.number
  if (!event_number) {
    core.setFailed('This action can only be run on pull_request events.')
    return
  }

  core.exportVariable('KITTENGRID_VCS_PROVIDER', 'github')
  core.exportVariable('KITTENGRID_PROJECT_VCS_ID', ctx.repo.repo)
  core.exportVariable('KITTENGRID_PULL_REQUEST_VCS_ID', event_number)
  core.exportVariable('KITTENGRID_BIND_ADDRESS', '0.0.0.0')
  core.exportVariable(
    'KITTENGRID_WORKFLOW_RUN_ID',
    process.env['GITHUB_RUN_ID'] || ''
  )
  core.exportVariable('KITTENGRID_LAST_COMMIT_SHA', ctx.sha)

  // env vars from action inputs
  core.exportVariable(
    'KITTENGRID_LOG_LEVEL',
    core.getInput('log-level') || 'info'
  )
  core.exportVariable(
    'KITTENGRID_API_KEY',
    core.getInput('api-key', { required: true })
  )
  core.exportVariable(
    'KITTENGRID_SHOW_SERVICES_OUTPUT',
    core.getInput('show-services-output') || 'false'
  )
}

async function setupConfig(): Promise<string | void> {
  const config = core.getInput('config')
  core.info(`Config input: ${config}`)

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

    var args: string[] = []
    if (configFile) {
      core.info(`Using config file at: ${configFile}`)
      args = ['--config', configFile]
    }

    if (core.getInput('dry-run') === 'true') {
      core.info('Dry run mode enabled, not executing the agent')
      core.info('I would have run:')
      core.info(`${agentPath} ${args.join(' ')}`)
      return
    }

    await exec.exec(agentPath, args)
  } catch (error) {
    // Fail the workflow run if an error occurs
    if (error instanceof Error) core.setFailed(error.message)
  }
}
