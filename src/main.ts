import * as core from '@actions/core'
import * as github from '@actions/github'
import { findComment } from './modules/find-comment/main'
import { ActionInputs } from './modules/models'
import { buildReport } from './modules/report'
import { fetchQualityGate } from './modules/sonarqube-api'
import { trimTrailingSlash } from './modules/utils'

/**
 * The main function for the action.
 * @returns {Promise<void>} Resolves when the action is complete.
 */
export async function run(): Promise<void> {
  try {
    const { context } = github
    const isPR = context.eventName === 'pull_request'

    // Get branch input or auto-detect from PR context
    let branchInput = core.getInput('branch')
    let pullRequestNumber: string | undefined

    // If this is a PR, get the PR number for SonarQube
    if (isPR && context.payload.pull_request) {
      const prNumber = context.payload.pull_request.number
      if (prNumber) {
        pullRequestNumber = prNumber.toString()
        console.log(`Detected Pull Request number: ${pullRequestNumber}`)
      }

      // Also auto-detect branch if not provided
      if (!branchInput) {
        branchInput = context.payload.pull_request.head.ref
        console.log(`Auto-detected branch from PR: ${branchInput}`)
      }
    }

    const inputs: ActionInputs = {
      hostURL: trimTrailingSlash(core.getInput('sonar-host-url')),
      projectKey: core.getInput('sonar-project-key'),
      token: core.getInput('sonar-token'),
      commentDisabled: core.getInput('disable-pr-comment') === 'true',
      failOnQualityGateError:
        core.getInput('fail-on-quality-gate-error') === 'true',
      branch: branchInput,
      githubToken: core.getInput('github-token')
    }

    const result = await fetchQualityGate(
      inputs.hostURL,
      inputs.projectKey,
      inputs.token,
      inputs.branch,
      pullRequestNumber
    )

    console.log('Quality gate fetch completed successfully')
    console.log(`Project status: ${result.projectStatus.status}`)
    console.log(
      `Number of conditions: ${result.projectStatus.conditions?.length || 0}`
    )

    core.setOutput('project-status', result.projectStatus.status)
    core.setOutput('quality-gate-result', JSON.stringify(result))

    if (isPR && !inputs.commentDisabled) {
      if (!inputs.githubToken) {
        throw new Error(
          '`inputs.github-token` is required for result comment creation.'
        )
      }

      const octokit = github.getOctokit(inputs.githubToken)

      const reportBody = buildReport(
        result,
        inputs.hostURL,
        inputs.projectKey,
        context,
        inputs.branch
      )

      console.log('Finding comment associated with the report...')

      const issueComment = await findComment({
        token: inputs.githubToken,
        repository: `${context.repo.owner}/${context.repo.repo}`,
        issueNumber: context.issue.number,
        commentAuthor: 'github-actions[bot]',
        bodyIncludes: 'SonarQube Quality Gate Result',
        direction: 'first'
      })

      if (issueComment) {
        console.log('Found existing comment, updating with the latest report.')

        await octokit.rest.issues.updateComment({
          owner: context.repo.owner,
          repo: context.repo.repo,
          issue_number: context.issue.number,
          comment_id: issueComment.id,
          body: reportBody
        })
      } else {
        console.log('Report comment does not exist, creating a new one.')

        await octokit.rest.issues.createComment({
          owner: context.repo.owner,
          repo: context.repo.repo,
          issue_number: context.issue.number,
          body: reportBody
        })
      }
    }

    const resultMessage = `Quality gate status for \`${inputs.projectKey}\` returned \`${result.projectStatus.status}\``
    if (
      inputs.failOnQualityGateError &&
      result.projectStatus.status === 'ERROR'
    ) {
      console.error(resultMessage)
      core.setFailed(resultMessage)
    } else {
      console.log(resultMessage)
    }
  } catch (error) {
    if (error instanceof Error) {
      console.error(error.message)
      core.setFailed(error.message)
    } else {
      console.error('Unexpected error')
      core.setFailed('Unexpected error')
    }
  }
}
