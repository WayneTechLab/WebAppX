// Match only previously collected, bounded Navigator metadata. Predicates are
// data comparisons; neither the query nor its values reach a selector engine.
const fields = new Set(['tag', 'id', 'class', 'name', 'component'])
const maxTerms = 6
export const navigatorQueryLimit = 160
const normalize = value => value.trim().replace(/\s+/gu, ' ')

function refused(reason) {
  return { mode: 'refused', query: '', terms: [], refusal: 'Search refused. ' + reason }
}

export function parseNavigatorSearch(raw, maxChars = navigatorQueryLimit) {
  if (typeof raw !== 'string') return refused('Enter a text query.')
  const limit = Number.isSafeInteger(maxChars) ? Math.min(Math.max(1, maxChars), navigatorQueryLimit) : navigatorQueryLimit
  // Bound even classification of a programmatic query. Never execute a valid
  // prefix when a predicate or its closing quote would be lost to truncation.
  if (raw.length > 4096) return refused('Shorten the search input.')
  if (!raw.includes(':')) {
    if (/[\[\]{}()<>*|=\\;]/u.test(raw) || /(?:^|[\w.#\s-])[+~](?:$|[\w.#\s-])/u.test(raw) || /^[\w.#-]+(?:\s*,\s*[\w.#-]+)+$/u.test(raw.trim())) {
      return refused('Use plain metadata text or reviewed field:value predicates.')
    }
    const query = normalize(raw.slice(0, limit)).toLocaleLowerCase().slice(0, limit)
    return { mode: query ? 'plain' : 'empty', query, terms: [], limited: raw.length > limit }
  }
  if (raw.length > limit) return refused('Predicate queries allow up to ' + limit + ' characters.')
  const query = raw.trim()
  const terms = []
  // A sticky, bounded token parser accounts for every character: outside
  // quoted values only whitespace can separate predicates.
  const pattern = /([a-z]+):(?:"([^"\\\p{Cc}]*)"|([\p{L}\p{M}\p{N}_-]+))/iyu
  let offset = 0
  while (offset < query.length) {
    if (terms.length === maxTerms) return refused('Combine up to six predicates.')
    pattern.lastIndex = offset
    const term = pattern.exec(query)
    if (!term) return refused('Use field:value, with double quotes around values containing spaces.')
    const field = term[1].toLowerCase()
    if (!fields.has(field)) return refused('Supported fields are tag, id, class, name and component.')
    const literal = term[2] ?? term[3]
    if (!literal.trim() || (field === 'tag' && !/^[a-z][a-z0-9-]*$/iu.test(literal)) ||
        ((field === 'id' || field === 'class') && /[\t\n\f\r ]/u.test(literal))) {
      return refused('Use a nonempty value and one exact tag, identifier or class token per predicate.')
    }
    const normalizedValue = field === 'id' || field === 'class' ? literal : normalize(literal).toLowerCase()
    terms.push({ field, value: normalizedValue })
    offset = pattern.lastIndex
    if (offset < query.length && !/\s/u.test(query[offset])) return refused('Separate predicates with whitespace.')
    while (offset < query.length && /\s/u.test(query[offset])) offset++
  }
  return { mode: 'predicates', query, terms }
}

export function matchesNavigatorSearch(search, entry) {
  if (search.mode === 'empty') return true
  if (search.mode === 'plain') return entry.search.includes(search.query)
  if (search.mode !== 'predicates' || !entry.searchFields) return false
  return search.terms.every(({ field, value }) => field === 'class'
    ? entry.searchFields.class?.includes(value) === true
    : entry.searchFields[field] === value)
}
