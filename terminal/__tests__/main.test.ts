/**
 * Unit tests for the action's main functionality, src/main.ts
 *
 * To mock dependencies in ESM, you can create fixtures that export mock
 * functions and objects. For example, the core module is mocked in this test,
 * so that the actual '@actions/core' module is not imported.
 */
import { jest, describe, expect, beforeEach, it } from '@jest/globals'

import * as shared from '../__fixtures__/shared.js'
jest.unstable_mockModule('@kittengrid-actions/shared', () => shared)

import * as core from '../__fixtures__/core.js'
jest.unstable_mockModule('@actions/core', () => core)

import * as github from '../__fixtures__/github.js'
jest.unstable_mockModule('@actions/github', () => github)

// The module being tested should be imported dynamically. This ensures that the
// mocks are used in place of any actual dependencies.
const { run } = await import('../src/main.js')

describe('main.ts', () => {
  beforeEach(() => {
    jest.resetAllMocks()
  })

  it('runs the agent in dry mode when dry-run is correctly set', async () => {
    shared.validateDryRunInput.mockImplementation(() => {
      return true
    })

    await run()
    expect(shared.startAgent).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      true
    )
  })

  it('adds --start-terminal true by default to the args', async () => {
    await run()
    expect(shared.startAgent).toHaveBeenCalledWith(
      expect.anything(),
      ['--start-terminal', 'true'],
      undefined
    )
  })

  it('when somwthing wrong happens that throws an error (Error type)', async () => {
    shared.validateDryRunInput.mockImplementation(() => {
      throw new Error('Invalid dry-run value')
    })

    await run()
    expect(core.setFailed).toHaveBeenCalledWith('Invalid dry-run value')
  })

  it('when somwthing wrong happens that throws an error (String)', async () => {
    shared.validateDryRunInput.mockImplementation(() => {
      throw 'Invalid dry-run value'
    })

    await run()
    expect(core.setFailed).toHaveBeenCalledWith('Invalid dry-run value')
  })
})
