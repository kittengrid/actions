/**
 * Unit tests for the action's main functionality, src/main.ts
 *
 * To mock dependencies in ESM, you can create fixtures that export mock
 * functions and objects. For example, the core module is mocked in this test,
 * so that the actual '@actions/core' module is not imported.
 */
import {
  jest,
  describe,
  expect,
  beforeEach,
  afterEach,
  it
} from '@jest/globals'
import * as core from '../__fixtures__/core.js'

// Mocks should be declared before the module being tested is imported.
jest.unstable_mockModule('@actions/core', () => core)

// The module being tested should be imported dynamically. This ensures that the
// mocks are used in place of any actual dependencies.
const { run } = await import('../src/main.js')

describe('main.ts', () => {
  beforeEach(() => {
    // Set the action's inputs as return values from core.getInput().
    core.getInput.mockImplementation(() => '500')
  })

  afterEach(() => {
    jest.resetAllMocks()
  })

  it('Sets a failed status', async () => {
    Object.defineProperty(core.platform, 'arch', { value: 'unsupported' })

    await run()

    // Verify that the action was marked as failed.
    expect(core.setFailed).toHaveBeenNthCalledWith(
      1,
      'Unsupported architecture: x64. Only amd64 and arm64 are supported.'
    )
  })
})
