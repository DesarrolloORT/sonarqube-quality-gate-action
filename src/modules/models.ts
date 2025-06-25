export interface QualityGate {
  projectStatus: ProjectStatus
}

export interface ProjectStatus {
  status: string
  conditions: Condition[]
  ignoredConditions: boolean
  caycStatus?: string
  period?: Period
}

export interface Condition {
  status: string
  metricKey: string
  comparator: string
  errorThreshold?: string
  actualValue: string
  periodIndex?: number
}

export interface Period {
  mode: string
  date: string
  parameter?: string
}

export interface ActionInputs {
  hostURL: string
  projectKey: string
  token: string
  commentDisabled?: boolean
  failOnQualityGateError?: boolean
  branch?: string
  githubToken?: string
}
