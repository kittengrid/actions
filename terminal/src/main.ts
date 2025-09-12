import * as core from '@actions/core'
import * as github from '@actions/github'

import { validateDryRunInput, startAgent } from '@kittengrid-actions/shared'
/**
 * The main function for the action.
 *
 * @returns Resolves when the action is complete.
 */
export async function run(): Promise<void> {
  try {
    const ctx = github.context
    const dryRun = await validateDryRunInput(core.getInput('dry-run'))

    startAgent(ctx, ['--start-terminal', 'true'], dryRun)
  } catch (error) {
    // Fail the workflow run if an error occurs
    if (error instanceof Error) core.setFailed(error.message)
    else core.setFailed(String(error))
  }
}
