import { registerHooks } from 'node:module'
import { readFileSync, existsSync } from 'node:fs'
import { pathToFileURL, fileURLToPath } from 'node:url'
import path from 'node:path'
import ts from 'typescript'

registerHooks({
  resolve(specifier, context, nextResolve) {
    let target
    if (specifier.startsWith('@/')) target = path.resolve(specifier.slice(2))
    else if (specifier.startsWith('.') && context.parentURL?.endsWith('.ts')) target = path.resolve(path.dirname(fileURLToPath(context.parentURL)), specifier)
    if (target) {
      for (const suffix of ['', '.ts', '.tsx']) if (existsSync(target + suffix)) return nextResolve(pathToFileURL(target + suffix).href, context)
    }
    return nextResolve(specifier, context)
  },
  load(url, context, nextLoad) {
    if (url.endsWith('.ts') && !url.includes('node_modules')) {
      return { format: 'module', shortCircuit: true, source: ts.transpile(readFileSync(fileURLToPath(url), 'utf8'), { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }) }
    }
    return nextLoad(url, context)
  },
})
