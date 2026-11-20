import { exportInventoryMetadata, revalidateInventoryProposal } from './inventory-metadata.mjs'

const refused = code => ({ status: 'refused', code })

// The caller passes the CLI argv beginning with the action and the existing
// trusted trackedInventory(root, action) implementation. Neither action writes
// the accepted baseline; compare resamples the bounded working inventory.
export function runInventoryMetadataAction(argv, trackedInventory, defaultRoot = process.cwd()) {
  const [action, ...flags] = argv
  if (!['export', 'revalidate'].includes(action) || flags.length > 68 || flags.length % 2) return refused('invalid-metadata-arguments')
  let root, revision
  const paths = []
  for (let i = 0; i < flags.length; i += 2) {
    const flag = flags[i], value = flags[i + 1]
    if (!value || value.startsWith('--')) return refused('invalid-metadata-arguments')
    if (flag === '--root' && root === undefined) root = value
    else if (action === 'revalidate' && flag === '--revision' && revision === undefined && /^[a-f0-9]{64}$/.test(value)) revision = value
    else if (action === 'revalidate' && flag === '--path' && paths.length < 32 && !paths.includes(value)) paths.push(value)
    else return refused('invalid-metadata-arguments')
  }
  if (action === 'revalidate' && (!revision || !paths.length)) return refused('expected-revision-and-resource-path')
  const retained = trackedInventory(root ?? defaultRoot, 'last-good')
  if (retained.status !== 'retained' || !retained.lastGood) return refused('accepted-inventory-required')
  if (action === 'export') return exportInventoryMetadata(retained.lastGood)
  if (revision !== retained.lastGood.revision) return refused('proposal-baseline-changed')
  const fresh = trackedInventory(root ?? defaultRoot, 'compare')
  if (fresh.status !== 'compared') return refused('fresh-complete-comparison-required')
  return revalidateInventoryProposal(retained.lastGood, fresh.inventory, { paths })
}
