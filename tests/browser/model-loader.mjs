import { readFile } from 'node:fs/promises'
import ts from 'typescript'

const modules = new Map()

/** Load the small pure TypeScript mock models for fixture validation in Node.
 * Browser behavior still runs through Vite; this loader does not transform or
 * replace runtime source, seed browser storage, or invoke UI state setters.
 */
export async function loadMockModel(file) {
  if (modules.has(file.href)) return import(modules.get(file.href))
  const source = await readFile(file, 'utf8')
  let compiled = file.pathname.endsWith('.json')
    ? `export default ${JSON.stringify(JSON.parse(source))}`
    : ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText
  for (const match of [...compiled.matchAll(/from ['"](\.{1,2}\/[^'"]+)['"]/g)]) {
    const relative = match[1]
    const dependency = new URL(/\.(?:ts|json)$/.test(relative) ? relative : `${relative}.ts`, file)
    await loadMockModel(dependency)
    compiled = compiled.replace(match[0], `from '${modules.get(dependency.href)}'`)
  }
  const moduleUrl = `data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`
  modules.set(file.href, moduleUrl)
  return import(moduleUrl)
}
