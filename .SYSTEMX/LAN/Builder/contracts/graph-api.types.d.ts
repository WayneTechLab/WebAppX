/** Public, metadata-only LAN graph API 1.0 and 1.1 declarations. Runtime
 * validation remains authoritative; TypeScript types do not grant capability. */
export type ApiVersion = '1.0' | '1.1'
export type GraphHash = string
export type GraphIdentifier = string
export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue }

export interface PublicJsonSchema {
  readonly type?: string | readonly string[]
  readonly properties?: Readonly<Record<string, PublicJsonSchema>>
  readonly required?: readonly string[]
  readonly additionalProperties?: boolean | PublicJsonSchema
  readonly items?: PublicJsonSchema
  readonly minItems?: number
  readonly maxItems?: number
  readonly pattern?: string
  readonly minLength?: number
  readonly maxLength?: number
  readonly minimum?: number
  readonly maximum?: number
  readonly enum?: readonly unknown[]
  readonly const?: unknown
  readonly oneOf?: readonly PublicJsonSchema[]
}

export interface GraphSourceReference {
  path: string
  sourceRevision: GraphHash
  start: number
  end: number
  fingerprint: GraphHash
}
export interface GraphPage {
  id: GraphIdentifier
  rootId: GraphIdentifier
  route: string | null
}
export interface GraphNode {
  id: GraphIdentifier
  kind: 'element' | 'opaque' | 'component-instance' | 'document-root'
  parentId: GraphIdentifier | null
  childIds: GraphIdentifier[]
  label: string
  ownership: 'source-owned' | 'read-only'
  source: GraphSourceReference | null
  opaqueReason: string | null
}
export interface GraphReference {
  id: GraphIdentifier
  kind: 'node' | 'component' | 'collection'
  documentId: GraphIdentifier
  targetId: GraphIdentifier
  expectedVersion: string | null
  expectedSchemaId: string | null
  required: boolean
}
export interface GraphComponent { id: GraphIdentifier; version: string; rootId: GraphIdentifier }
export interface GraphCollection { id: GraphIdentifier; schemaId: GraphIdentifier; version: string }
export interface GraphDocument {
  schemaVersion: 1
  workspaceId: GraphHash
  documentId: GraphIdentifier
  sourceRevision: GraphHash | null
  pages: GraphPage[]
  nodes: GraphNode[]
  references: GraphReference[]
  components: GraphComponent[]
  collections: GraphCollection[]
  extensions: { 'org.webappx.readonly'?: JsonValue }
}
export interface GraphExport {
  format: 'webappx-graph'
  formatVersion: 1
  revision: GraphHash
  document: GraphDocument
}
export interface GraphFinding {
  id: string
  code: string
  severity: 'error' | 'warning' | 'info'
  objectId: GraphIdentifier | null
  referenceType: 'node' | 'component' | 'collection' | 'page' | null
  message: string
}
export interface GraphStatistics {
  revision: GraphHash
  pages: number
  nodes: number
  components: number
  collections: number
  references: number
  unresolvedReferences: number
  opaqueNodes: number
}

export type GraphQueryPayload =
  | { type: 'graph.status' }
  | { type: 'graph.document'; documentId: GraphIdentifier; revision?: GraphHash }
  | { type: 'graph.findings'; documentId: GraphIdentifier; severity?: GraphFinding['severity']; objectId?: GraphIdentifier; referenceType?: NonNullable<GraphFinding['referenceType']>; offset?: number; limit?: number }
  | { type: 'graph.lookup'; workspaceId: GraphHash; documentId: GraphIdentifier; id: GraphIdentifier; kind: 'page' | 'node' | 'component' | 'collection' | 'reference' }
  | { type: 'graph.compare'; documentId: GraphIdentifier; beforeRevision: GraphHash; afterRevision: GraphHash }
  | { type: 'graph.export'; documentId: GraphIdentifier }
  | { type: 'contracts.list' }
  | { type: 'contracts.describe'; operation: string; version?: ApiVersion }
  | { type: 'contracts.examples'; operation: string; version?: ApiVersion }
  | { type: 'contracts.compatibility'; beforeVersion: ApiVersion; afterVersion: ApiVersion }
  | { type: 'contracts.export' }

export type GraphCommandPayload =
  | { type: 'graph.preview'; document: GraphDocument; identityDocumentId?: never }
  | { type: 'graph.preview'; document?: never; identityDocumentId: GraphIdentifier }
  | { type: 'graph.accept'; digest: GraphHash }
  | { type: 'graph.reopen'; document: GraphExport }
  | { type: 'graph.migrationPreview'; document: Record<string, unknown>; targetVersion: 1 }
  | { type: 'graph.migrationApply'; digest: GraphHash }

export type OlderQueryOperation = 'graph.status' | 'graph.document' | 'graph.export'
  | 'contracts.list' | 'contracts.describe' | 'contracts.examples' | 'contracts.export'
export type OlderCommandOperation = 'graph.preview' | 'graph.accept'
type VersionFor<O extends string> = O extends OlderQueryOperation | OlderCommandOperation ? ApiVersion : '1.1'
export type QueryEnvelope = GraphQueryPayload extends infer P
  ? P extends GraphQueryPayload
    ? { apiVersion: VersionFor<P['type']>; requestId: string; kind: 'query'; operation: P['type']; payload: P }
    : never
  : never
export type CommandEnvelope = GraphCommandPayload extends infer P
  ? P extends GraphCommandPayload
    ? {
      apiVersion: VersionFor<P['type']>
      requestId: string
      kind: 'command'
      operation: P['type']
      capabilityId: `lan.graph.${P['type'] extends `graph.${infer S}` ? S : never}@1`
      payload: P
      confirmation: P['type'] extends 'graph.accept' ? 'ACCEPT GRAPH'
        : P['type'] extends 'graph.reopen' ? 'REOPEN GRAPH'
        : P['type'] extends 'graph.migrationApply' ? 'MIGRATE GRAPH COPY' : string
      expectedRevision: GraphHash | null
    }
    : never
  : never
export type GraphApiRequest = QueryEnvelope | CommandEnvelope

export interface ConfirmationContract {
  readonly required: true
  readonly exact: string | null
  readonly mayBeEmpty: boolean
}
export interface RevisionPrecondition {
  readonly required: true
  readonly nullable: true
  readonly semantics: string
}
export interface PaginationContract {
  readonly mode: 'offset'
  readonly defaultOffset: 0
  readonly defaultLimit: 20
  readonly maximumOffset: 10000
  readonly maximumLimit: 50
  readonly totalScope: string
}
export interface ContractDeprecation {
  readonly since: '1.1'
  readonly replacementVersion: '1.1'
  readonly compatibilityWindow: 'supported until an explicit removal release'
  readonly removalDate: null
}
export interface OperationDescriptor {
  readonly id: GraphApiRequest['operation']
  readonly version: ApiVersion
  readonly kind: 'query' | 'command'
  readonly implemented: boolean
  readonly capabilityId: string
  /** Exact request envelope, including the discriminated payload. */
  readonly inputSchema: PublicJsonSchema
  readonly resultSchema: PublicJsonSchema
  readonly effect: 'read-local-memory' | 'preview-local-memory' | 'isolated-copy-local-memory' | 'accept-local-memory'
  readonly confirmation: ConfirmationContract | null
  readonly revisionPrecondition: RevisionPrecondition | null
  readonly pagination: PaginationContract | null
  readonly deprecated: ContractDeprecation | null
  readonly examples: { readonly operation: 'contracts.examples'; readonly synthetic: true; readonly dispatches: false }
}
export interface ContractScope {
  readonly data: 'local-memory-graph-metadata'
  readonly sourceWrites: false
  readonly structuralEditing: false
  readonly providerAccess: false
}
export interface ContractLimits {
  readonly requestBytes: 400000
  readonly responseBytes: 800000
  readonly findings: 50
  readonly requestIdLength: 64
  readonly paginationOffset: 10000
  readonly pageSize: 50
}
export interface ContractRegistry {
  readonly apiVersion: ApiVersion
  readonly supportedVersions: readonly ApiVersion[]
  readonly schemaRevision: GraphHash
  readonly scope: ContractScope
  readonly limits: ContractLimits
  readonly operations: readonly OperationDescriptor[]
}
export interface ContractDiscovery extends ContractRegistry {
  readonly clientVersion: ApiVersion
  readonly compatibleVersion: ApiVersion
  readonly unavailableOperations: readonly {
    readonly operation: string
    readonly implemented: false
    readonly kind: 'query' | 'command'
    readonly capabilityId: string
    readonly reason: string
    readonly availableSince?: '1.1'
  }[]
  readonly deprecated: readonly ({ readonly operation: string } & ContractDeprecation)[]
}

export interface GraphStatusResult {
  workspaceId: GraphHash
  documents: { documentId: GraphIdentifier; revision: GraphHash; sourceRevision: GraphHash | null; stats: GraphStatistics }[]
  limits: Record<string, unknown>
}
export interface GraphAcceptedResult {
  document: GraphDocument
  revision: GraphHash
  stats: GraphStatistics
  findings: GraphFinding[]
  omittedCount: number
}
export interface GraphPreviewResult extends GraphAcceptedResult {
  digest: GraphHash
  documentId: GraphIdentifier
  sourceRevision: GraphHash | null
}
export interface GraphFindingsResult {
  items: GraphFinding[]
  total: number
  offset: number
  limit: number
  omittedCount: number
  upstreamOmittedCount: number
  totalScope: 'retained-findings'
  revision: GraphHash
}
export interface GraphDifference { kind: 'document' | 'page' | 'node' | 'reference' | 'component' | 'collection'; id: GraphIdentifier }
export interface GraphCompareResult {
  beforeRevision: GraphHash
  afterRevision: GraphHash
  added: GraphDifference[]
  removed: GraphDifference[]
  changed: GraphDifference[]
  reordered: GraphDifference[]
  /** Untruncated counts; each corresponding result array contains at most 50 entries. */
  totals: { added: number; removed: number; changed: number; reordered: number }
  omittedCount: number
}
export interface GraphMigrationPreviewResult {
  digest: GraphHash
  fromVersion: 0
  toVersion: 1
  steps: GraphMigrationStep[]
  unsupportedFields: string[]
  document: GraphDocument
}
export interface GraphMigrationStep {
  order: number
  operation: 'page-list-conversion' | 'child-order-derivation' | 'schema-version-0-to-1' | 'graph-validation'
  description: string
}
export interface GraphMigrationApplyResult { document: GraphDocument; revision: GraphHash; isolatedCopy: true }
export interface ContractExamplesResult {
  apiVersion: ApiVersion
  schemaRevision: GraphHash
  operation: string
  validRequest: GraphApiRequest
  invalidRequest: Record<string, unknown>
}
export interface ContractCompatibilityChange { operation: string; path: string; change: string }
export interface ContractCompatibilityResult {
  beforeVersion: ApiVersion
  afterVersion: ApiVersion
  beforeSchemaRevision: GraphHash
  afterSchemaRevision: GraphHash
  additions: ContractCompatibilityChange[]
  breakingChanges: ContractCompatibilityChange[]
  additionCount: number
  breakingCount: number
  omittedCount: number
}
export interface PublicContractExport {
  format: 'webappx-api-contracts'
  formatVersion: 1
  apiVersion: ApiVersion
  supportedVersions: ApiVersion[]
  schemaRevision: GraphHash
  scope: ContractScope
  limits: ContractLimits
  operations: OperationDescriptor[]
  capabilities: { id: string; operation: string; kind: 'query' | 'command'; implemented: boolean }[]
}
export interface GraphResultByOperation {
  'graph.status': GraphStatusResult
  'graph.document': GraphAcceptedResult
  'graph.findings': GraphFindingsResult
  'graph.lookup': GraphPage | GraphNode | GraphReference | GraphComponent | GraphCollection
  'graph.compare': GraphCompareResult
  'graph.export': GraphExport
  'graph.preview': GraphPreviewResult
  'graph.accept': GraphAcceptedResult
  'graph.reopen': GraphAcceptedResult
  'graph.migrationPreview': GraphMigrationPreviewResult
  'graph.migrationApply': GraphMigrationApplyResult
  'contracts.list': ContractRegistry
  'contracts.describe': OperationDescriptor | null
  'contracts.examples': ContractExamplesResult
  'contracts.compatibility': ContractCompatibilityResult
  'contracts.export': PublicContractExport
}
export type GraphApiOperation = keyof GraphResultByOperation
export type GraphApiResult<O extends GraphApiOperation> = GraphResultByOperation[O]

export interface ApiFailure {
  /** May echo a refused, bounded requested version not in the supported union. */
  apiVersion: string
  requestId: string | null
  ok: false
  error: {
    category: 'validation' | 'missing-target' | 'conflict' | 'capability' | 'confirmation' | 'incompatible-version' | 'internal'
    code: string
    message: string
    findings: Readonly<Record<string, unknown>>[]
    omittedCount: number
  }
}
export interface ApiSuccess<R = unknown> { apiVersion: ApiVersion; requestId: string; ok: true; result: R }

export declare const API_VERSION: '1.1'
export declare const SUPPORTED_API_VERSIONS: readonly ['1.0', '1.1']
export declare const contractLimits: ContractLimits
export declare function getContractRegistry(version?: ApiVersion): ContractRegistry
export declare function getOperationDescriptor(operation: string, version?: ApiVersion): OperationDescriptor | null
export declare function discoveryForClient(clientVersion?: ApiVersion): ContractDiscovery
