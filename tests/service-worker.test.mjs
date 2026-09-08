import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'

test('service worker no guarda HTML privado y limpia solo sus cachés antiguas', async () => {
  const handlers = new Map(), writes = [], deletes = []
  const offline = new Response('offline')
  const scope = { addEventListener: (name, fn) => handlers.set(name, fn), location: {origin:'https://app.test'}, clients:{claim:async()=>{}}, skipWaiting:async()=>{} }
  const context = vm.createContext({ self:scope, URL, Response,
    fetch:async()=>new Response('datos privados'),
    caches:{ keys:async()=>['otra-app','proyecto-emilio-shell-v1','proyecto-emilio-shell-v2'],
      delete:async key=>deletes.push(key), match:async()=>offline,
      open:async()=>({put:async(...args)=>writes.push(args),addAll:async()=>{}}) },
  })
  vm.runInContext(readFileSync('public/sw.js','utf8'),context)
  let work
  handlers.get('activate')({waitUntil:p=>work=p}); await work
  assert.deepEqual(deletes,['proyecto-emilio-shell-v1'])
  handlers.get('fetch')({request:{method:'GET',url:'https://app.test/obras/1',mode:'navigate'},respondWith:p=>work=p})
  assert.equal(await (await work).text(),'datos privados')
  assert.equal(writes.length,0)
  context.fetch=async()=>{throw new Error('offline')}
  handlers.get('fetch')({request:{method:'GET',url:'https://app.test/obras/1',mode:'navigate'},respondWith:p=>work=p})
  assert.equal(await (await work).text(),'offline')
})
