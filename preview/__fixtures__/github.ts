import type * as github from '@actions/github'

export const context = {
  payload: {
    pull_request: {
      number: 42
    }
  },
  actor: 'example-actor',
  repo: {
    repo: 'example-repo',
    owner: 'example-owner'
  },
  sha: 'abc123'
} as typeof github.context
