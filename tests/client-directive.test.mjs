import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

// Un componente que usa hooks de React sin la directiva 'use client' truena en producción apenas lo renderiza
// un Server Component ("Error: An error occurred in the Server Components render"). El caso real fue
// components/ui/avatar.tsx importado desde app/usuarios/page.tsx: /usuarios mostraba "Algo salió mal".
// Solo los hooks que NO existen en el entorno de servidor de React (useMemo, useCallback y useId sí existen allí).
const HOOKS = /\b(?:React\.)?(useState|useEffect|useLayoutEffect|useRef|useReducer|useContext|useTransition|useActionState|useOptimistic|useSyncExternalStore)\s*[(<]/
const DIRECTIVA = /^\s*(?:\/\/[^\n]*\n|\/\*[\s\S]*?\*\/\s*)*['"]use client['"]/

function archivos(dir) {
  return readdirSync(dir).flatMap((nombre) => {
    const ruta = join(dir, nombre)
    if (statSync(ruta).isDirectory()) return archivos(ruta)
    return /\.tsx?$/.test(nombre) ? [ruta] : []
  })
}

test("todo archivo de components/ y app/ que usa hooks de React declara 'use client'", () => {
  const sinDirectiva = [...archivos('components'), ...archivos('app')]
    .filter((ruta) => {
      const fuente = readFileSync(ruta, 'utf8')
      return HOOKS.test(fuente) && !DIRECTIVA.test(fuente)
    })
    .map((ruta) => ruta.replaceAll('\\', '/'))
  assert.deepEqual(sinDirectiva, [], `Falta 'use client' en: ${sinDirectiva.join(', ')}`)
})

test('la detección reconoce la directiva con comentarios previos y rechaza su ausencia', () => {
  assert.ok(DIRECTIVA.test("'use client'\n\nimport x from 'y'"))
  assert.ok(DIRECTIVA.test("// nota\n'use client'\nconst a = 1"))
  assert.ok(!DIRECTIVA.test("import * as React from 'react'\n// 'use client'"))
  assert.ok(HOOKS.test('const [a, setA] = React.useState(false)'))
  assert.ok(!HOOKS.test('const usuarios = lista.filter(Boolean)'))
  assert.ok(!HOOKS.test('const x = React.useMemo(() => 1, [])'), 'useMemo funciona en servidor')
})
