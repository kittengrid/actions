import * as core from '@actions/core'
import { platform } from '@actions/core'

import { downloadAgent, AGENT_VERSION } from './utils.js'

/**
 * The main function for the action.
 *
 * @returns Resolves when the action is complete.
 */
export async function run(): Promise<void> {
  try {
    core.info('Kittengrid Preview Action is starting...')
    core.info(`Action version: ${process.env['GITHUB_ACTIONS']}`)
    core.info(`Node version: ${process.version}`)
    core.info(`Agent version: ${AGENT_VERSION}`)
    core.info(`Architecture: ${core.platform.arch}`)
    core.info(`Operating System: ${platform.platform}`)

    core.info('Downloading and extracting Kittengrid agent...')
    const agentPath = await downloadAgent()
    core.info(`Kittengrid agent downloaded to: ${agentPath}`)
    core.info('Kittengrid agent extraction complete.')
    // Set outputs for other workflow steps to use
    core.setOutput('time', new Date().toTimeString())

    // More stuff
    core.summary.addRaw('Some content here :speech_balloon:', true)

    core.summary.addCodeBlock("console.log('hello world')", 'javascript')

    core.summary.addList(['item1', 'item2', 'item3'], true)
    core.summary.addDetails('Label', 'Some detail that will be collapsed')
    core.summary.addHeading('My Heading', '2')

    const tableData = [
      { data: 'Header1', header: true },
      { data: 'Header2', header: true },
      { data: 'Header3', header: true },
      { data: 'MyData1' },
      { data: 'MyData2' },
      { data: 'MyData3' }
    ]

    // Add an HTML table
    core.summary.addTable([tableData])
    core.summary.write()
  } catch (error) {
    // Fail the workflow run if an error occurs
    if (error instanceof Error) core.setFailed(error.message)
  }
}
