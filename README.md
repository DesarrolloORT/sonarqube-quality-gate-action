# SonarQube Quality Gate Check

Check quality gate result from latest analysis and report result in the pull
request's comment.

> This action replicates the action in
> [this repo](https://github.com/phwt/sonarqube-quality-gate-action) but was
> adapted to work on Linux, MacOS and Windows.

![PR comment](https://user-images.githubusercontent.com/28344318/194283898-6f3f6466-d4a7-4f83-93a4-daef88b14777.png)

<!-- Generated with `npx action-docs --update-readme` -->

<!-- action-docs-inputs -->

## Inputs

| parameter                  | description                                                                                             | required | default |
| -------------------------- | ------------------------------------------------------------------------------------------------------- | -------- | ------- |
| sonar-project-key          | SonarQube project key                                                                                   | `true`   |         |
| sonar-host-url             | SonarQube server URL                                                                                    | `true`   |         |
| sonar-token                | SonarQube token for retrieving quality gate result                                                      | `true`   |         |
| github-token               | GitHub Token for commenting on the pull request - not required if `disable-pr-comment` is set to `true` | `false`  |         |
| disable-pr-comment         | Disable commenting result on the pull request                                                           | `false`  | false   |
| fail-on-quality-gate-error | Set the action status to failed when quality gate status is `ERROR`                                     | `false`  | false   |
| branch                     | Branch name to retrieve the quality gate result                                                         | `false`  |         |

<!-- action-docs-inputs -->

<!-- action-docs-outputs -->

## Outputs

| parameter           | description                                             |
| ------------------- | ------------------------------------------------------- |
| project-status      | Project's quality gate status either as `OK` or `ERROR` |
| quality-gate-result | Quality gate of the latest analysis in JSON format      |

<!-- action-docs-outputs -->

## Usage example

```yml
name: Check quality gate result on pull request

on:
  pull_request:

jobs:
  test:
    runs-on: windows-latest
    steps:
      - uses: DesarrolloORT/sonarqube-quality-gate-action@v2
        id: quality-gate-check
        with:
          sonar-project-key: ${{ secrets.SONAR_PROJECT_KEY }}
          sonar-host-url: ${{ secrets.SONAR_HOST_URL }}
          sonar-token: ${{ secrets.SONAR_TOKEN }}
          github-token: ${{ secrets.GITHUB_TOKEN }}
          branch: main # Optional input

      - name: Output result
        run: |
          echo "${{ steps.quality-gate-check.outputs.project-status }}"
          echo "${{ steps.quality-gate-check.outputs.quality-gate-result }}"
```

### Check the results immediately after the scan

Sometimes the results will not be available right away after the scan has
finished. Make sure to add a defer step before retrieving the scan results.

```yml
name: Check quality gate result on pull request

on:
  pull_request:

jobs:
  test:
    runs-on: windows-latest
    steps:
      - uses: some/scan-actions@v2 # Step for scanning your project

      - name: Wait for the quality gate result
        run: sleep 5

      - uses: DesarrolloORT/sonarqube-quality-gate-action@v2
        id: quality-gate-check
        with:
          sonar-project-key: ${{ secrets.SONAR_PROJECT_KEY }}
          sonar-host-url: ${{ secrets.SONAR_HOST_URL }}
          sonar-token: ${{ secrets.SONAR_TOKEN }}
          github-token: ${{ secrets.GITHUB_TOKEN }}
          branch: main # Optional input

      - name: Output result
        run: |
          echo "${{ steps.quality-gate-check.outputs.project-status }}"
          echo "${{ steps.quality-gate-check.outputs.quality-gate-result }}"
```
