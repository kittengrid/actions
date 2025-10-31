import { HttpClient } from '@actions/http-client'
import * as github from '@actions/github'
import { promises as fs } from 'fs'
import * as core from '@actions/core'
import { spawn } from 'child_process'
import { basename } from 'path'
import * as path from 'path'
import * as os from 'os'
import * as tar from 'tar'
import * as exec from '@actions/exec'
export const AGENT_VERSION = '0.0.11'

/**
 * Downloads a .tar.gz from a given URL and extracts its single file.
 * Saves the extracted file to the specified destination directory.
 *
 * @param url - The .tar.gz URL
 * @param outputDir - Directory where the extracted file should go
 * @returns Promise<string> - Resolves with the extracted file path
 */
export async function downloadAndExtract(
  url: string,
  outputDir: string = '.'
): Promise<string> {
  const client = new HttpClient('kittengrid-action')
  const response = await client.get(url)

  if (response.message.statusCode !== 200) {
    // Properly close the response stream to prevent hanging handles
    response.message.destroy()
    throw new Error(
      `Failed to fetch ${url}: ${response.message.statusCode} ${response.message.statusMessage}`
    )
  }

  // Extract directly from the response stream
  return new Promise((resolve, reject) => {
    let extractedFilePath = ''

    if (!response.message || !response.message.readable) {
      response.message?.destroy()
      reject(new Error(`No response body received from ${url}`))
      return
    }

    response.message
      .pipe(
        tar.x({
          cwd: outputDir, // where to extract
          strict: true,
          onentry: (entry) => {
            extractedFilePath = `${outputDir}/${basename(entry.path)}`
          }
        })
      )
      .on('error', (err) => {
        response.message.destroy()
        reject(err)
      })
      .on('close', () => resolve(extractedFilePath))
  })
}

/**
 * Downloads the Kittengrid agent for a specific architecture, OS, and version.
 *
 * @param arch - The architecture (e.g., 'amd64', 'arm64')
 * @param os - The operating system (e.g., 'linux', 'darwin')
 * @param version - The version of the agent to download
 * @param outputDir - Destination path to save the downloaded file
 * @returns Promise<string> - Resolves with the path to the downloaded agent
 **/
async function downloadAgentInternal(
  arch: string,
  os: string,
  version: string,
  outputDir: string
): Promise<string> {
  const url = `https://github.com/kittengrid/agent/releases/download/v${version}/kittengrid-agent-${os}-${arch}.tar.gz`
  return downloadAndExtract(url, outputDir)
}

export async function downloadAgent(): Promise<string> {
  const arch = core.platform.arch === 'x64' ? 'amd64' : core.platform.arch
  if (arch !== 'amd64' && arch !== 'arm64') {
    throw new Error(
      `Unsupported architecture: ${arch}. Only amd64 and arm64 are supported.`
    )
  }

  const current_os = core.platform.platform
  if (current_os !== 'linux') {
    throw new Error(
      `Unsupported OS: ${current_os}. Only linux is currently supported.`
    )
  }

  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'download-agent-'))

  return downloadAgentInternal(arch, current_os, AGENT_VERSION, tempDir)
}

export async function showContextInfo(): Promise<void> {
  core.startGroup('Kittengrid Agent Info')
  core.info(`Action version: ${process.env['GITHUB_ACTIONS']}`)
  core.info(`Node version: ${process.version}`)
  core.info(`Agent version: ${AGENT_VERSION}`)
  core.info(`Architecture: ${core.platform.arch}`)
  core.info(`Operating System: ${core.platform.platform}`)
  core.endGroup()
}

export async function populateEnv(ctx: typeof github.context): Promise<void> {
  const event_number = ctx.payload.pull_request?.number
  if (!event_number) {
    core.setFailed('This action can only be run on pull_request events.')
    return
  }

  core.exportVariable('KITTENGRID_VCS_PROVIDER', 'github')
  core.exportVariable(
    'KITTENGRID_PROJECT_VCS_ID',
    ctx.repo.owner + '/' + ctx.repo.repo
  )
  core.exportVariable('KITTENGRID_PULL_REQUEST_VCS_ID', event_number)
  core.exportVariable('KITTENGRID_BIND_ADDRESS', '0.0.0.0')
  core.exportVariable('KITTENGRID_API_URL', 'https://app.kittengrid.com')
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

/**
 * Starts the Kittengrid agent with the provided arguments.
 *
 * @param ctx - The GitHub action context
 * @param args - Arguments to pass to the agent
 * @param dryRun - If true, the agent will not be executed, just logged
 * @param background - If true, the agent will be started in the background
 * @returns Promise<void> - Resolves when the agent has started or in dry run mode
 **/
export async function startAgent(
  ctx: typeof github.context,
  args: string[],
  dryRun: boolean,
  background: boolean
): Promise<void> {
  core.info('Kittengrid Preview Action is starting...')
  await showContextInfo()

  core.startGroup('Downloading and extracting Kittengrid agent...')
  const agentPath = await downloadAgent()
  core.info(`Kittengrid agent downloaded to: ${agentPath}`)
  core.info('Kittengrid agent extraction complete.')
  core.endGroup()

  core.startGroup('Starting Kittengrid Agent')
  await populateEnv(ctx)
  if (dryRun) {
    core.info('Dry run mode enabled, not executing the agent')
    core.info('I would have run:')
    core.info(`${agentPath} --start-terminal true`)
    return
  }
  await exec.exec('bash', ['-c', 'env | grep KITTENGRID_ > /tmp/vars'])
  await exec.exec('bash', ['-c', 'env | grep PATH > /tmp/vars'])
  if (background) {
    core.info('Starting Kittengrid agent in the background...')
    const child = spawn(
      'sudo',
      [
        '-E',
        'bash',
        '-c',
        `source /tmp/vars && ${agentPath} ${args.join(' ')}`
      ],
      {
        detached: true,
        stdio: 'inherit' // <-- this is the key part
      }
    )

    // let it run on its own
    child.unref()
  } else {
    await exec.exec('sudo', [
      '-E',
      'bash',
      '-c',
      `source /tmp/vars && ${agentPath} ${args.join(' ')}`
    ])
  }
}

/**
 * Validates the dry-run input string and converts it to a boolean.
 *
 * @param input - The dry-run input string
 * @returns Promise<boolean> - Resolves with true if dry-run is 'true', false otherwise
 * @throws Error if the input is not 'true', 'false', or empty
 */
export async function validateDryRunInput(input: string): Promise<boolean> {
  // Sanity check for dry-run variable setting, it has to be 'true' or 'false'
  const dryRunInput = input.toLowerCase()
  if (dryRunInput !== 'true' && dryRunInput !== 'false' && dryRunInput !== '') {
    throw new Error(
      `Invalid value for dry-run input: ${core.getInput(
        'dry-run'
      )}. It must be either 'true' or 'false'.`
    )
  }

  return dryRunInput === 'true'
}
