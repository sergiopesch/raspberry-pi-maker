const assert = require('node:assert/strict')
const fs = require('node:fs')
const http = require('node:http')
const https = require('node:https')
const { spawnSync } = require('node:child_process')
const { tmpdir } = require('node:os')
const net = require('node:net')
const path = require('node:path')
const { createRequire } = require('node:module')
const { finished } = require('node:stream/promises')
const test = require('node:test')

const root = path.resolve(__dirname, '../..')
const npmRoot = path.join(root, 'node_modules/npm')
const npmRequire = createRequire(path.join(npmRoot, 'package.json'))
const gypRequire = createRequire(npmRequire.resolve('node-gyp/package.json'))
const socksRequire = createRequire(npmRequire.resolve('socks/package.json'))
const undici = gypRequire('undici')
const { EventSourceStream } = gypRequire('undici/lib/web/eventsource/eventsource-stream')
const { Address4, Address6 } = socksRequire('ip-address')
const { ipToBuffer } = socksRequire('socks/build/common/helpers')
const { download } = gypRequire('node-gyp/lib/download')

test('normal installed manifests, bundled resolutions and lock agree with archive SRI', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, 'provenance.json')))
  const lock = JSON.parse(fs.readFileSync(path.join(root, 'package-lock.json')))
  const installed = npmRequire('./package.json')
  assert.equal(installed.version, manifest.version)
  assert.equal(lock.packages['node_modules/npm'].version, manifest.version)
  assert.equal(lock.packages['node_modules/npm'].integrity, manifest.integrity)
  assert.equal(gypRequire('undici/package.json').version, '6.29.1')
  assert.equal(socksRequire('ip-address/package.json').version, '10.7.4')
  for (const [name, version] of [['undici', '6.29.1'], ['ip-address', '10.7.4']]) {
    assert.equal(lock.packages[`node_modules/npm/node_modules/${name}`].version, version)
    assert.equal(lock.packages[`node_modules/npm/node_modules/${name}`].inBundle, true)
    assert.equal(lock.packages[`node_modules/npm/node_modules/${name}`].dev, true)
  }
  assert.ok(npmRequire('semver').satisfies('6.29.1', gypRequire('./package.json').dependencies.undici))
  assert.ok(npmRequire('semver').satisfies('10.7.4', socksRequire('./package.json').dependencies['ip-address']))
})

test('socks keeps IPv4 and IPv6 conversion API and rejects malformed zone input promptly', () => {
  assert.deepEqual([...ipToBuffer('192.0.2.1')], [192, 0, 2, 1])
  const bytes = ipToBuffer('2001:db8::1')
  assert.equal(bytes.length, 16)
  assert.equal(Address6.fromByteArray([...bytes]).canonicalForm(), new Address6('2001:db8::1').canonicalForm())
  assert.deepEqual(new Address4('192.0.2.1').toArray(), [192, 0, 2, 1])
  const start = performance.now()
  assert.throws(() => new Address6('::1%' + 'a%'.repeat(50_000) + '\n'))
  assert.ok(performance.now() - start < 1000)
})

test('EventSource accepts ordinary events and clears bounded parser state on byte, line and chunk exhaustion', async () => {
  const ordinary = new EventSourceStream({ maxEventSize: 100 })
  const messages = []
  ordinary.on('data', (message) => messages.push(message))
  ordinary.end('data: first\n\ndata: second\n\n')
  await finished(ordinary)
  assert.deepEqual(messages.map((message) => message.options.data), ['first', 'second'])

  for (const kind of ['bytes', 'lines', 'chunks']) {
    const parser = new EventSourceStream({ maxEventSize: kind === 'bytes' ? 16 : 200_000 })
    parser.resume()
    const rejection = assert.rejects(finished(parser), /EventSource message size exceeded/)
    if (kind === 'bytes') parser.end('data: ' + 'x'.repeat(32) + '\n')
    if (kind === 'lines') parser.end('data:\n'.repeat(parser.maxDataLines + 1))
    if (kind === 'chunks') {
      for (let i = 0; i <= parser.maxBufferedChunks; i++) parser.write(Buffer.from('x'))
      parser.end()
    }
    await rejection
    assert.equal(parser.chunks.length, 0)
    assert.equal(parser.event.data, undefined)
    assert.equal(parser.dataLineCount, 0)
  }
})

test('node-gyp direct, retry and explicit proxy downloads work; excessive encoding rejects without process crash', async (t) => {
  let retryCalls = 0
  const origin = http.createServer((request, response) => {
    if (request.url === '/retry' && retryCalls++ === 0) {
      response.writeHead(503).end('retry')
    } else if (request.url === '/coding') {
      response.writeHead(200, { 'content-encoding': 'gzip, gzip, gzip, gzip, gzip, gzip' }).end('x')
    } else response.end('downloaded')
  })
  await new Promise((resolve) => origin.listen(0, '127.0.0.1', resolve))
  const port = origin.address().port
  const proxy = http.createServer()
  let proxyCalls = 0
  proxy.on('connect', (request, client, head) => {
    assert.equal(request.url, `owned-npm-proof.invalid:${port}`)
    proxyCalls++
    const target = net.connect(port, '127.0.0.1', () => {
      client.write('HTTP/1.1 200 Connection Established\r\n\r\n')
      if (head.length) target.write(head)
      client.pipe(target).pipe(client)
    })
    target.on('error', () => client.destroy())
    client.on('error', () => target.destroy())
    client.on('close', () => target.destroy())
  })
  await new Promise((resolve) => proxy.listen(0, '127.0.0.1', resolve))
  t.after(() => {
    origin.closeAllConnections()
    origin.close()
    proxy.closeAllConnections()
    proxy.close()
  })
  const direct = { version: '13.0.0', opts: { noproxy: '127.0.0.1' } }
  assert.equal(await (await download(direct, `http://127.0.0.1:${port}/`)).text(), 'downloaded')
  assert.equal(await (await download(direct, `http://127.0.0.1:${port}/retry`)).text(), 'downloaded')
  assert.equal(retryCalls, 2)
  const proxied = { version: '13.0.0', opts: { proxy: `http://127.0.0.1:${proxy.address().port}` } }
  assert.equal(await (await download(proxied, `http://owned-npm-proof.invalid:${port}/`)).text(), 'downloaded')
  assert.equal(proxyCalls, 1)
  await assert.rejects(undici.fetch(`http://127.0.0.1:${port}/coding`))
  assert.equal(await (await download(direct, `http://127.0.0.1:${port}/`)).text(), 'downloaded')
})

test('node-gyp preserves custom CA verification for direct and proxied TLS origins', async (t) => {
  const fixture = fs.mkdtempSync(path.join(tmpdir(), 'pi-maker-sdk-tls-'))
  t.after(() => fs.rmSync(fixture, { recursive: true, force: true }))
  const certificate = path.join(fixture, 'certificate.pem')
  const key = path.join(fixture, 'key.pem')
  const generated = spawnSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', key, '-out', certificate, '-days', '1', '-subj', '/CN=owned-npm-proof.invalid', '-addext', 'subjectAltName=DNS:localhost,DNS:owned-npm-proof.invalid,IP:127.0.0.1'], { stdio: 'ignore' })
  assert.equal(generated.status, 0, 'OpenSSL must create the temporary loopback fixture')
  const origin = https.createServer({
    cert: fs.readFileSync(certificate),
    key: fs.readFileSync(key),
  }, (request, response) => response.end('verified TLS'))
  await new Promise((resolve) => origin.listen(0, '127.0.0.1', resolve))
  const port = origin.address().port
  let proxyCalls = 0
  const proxy = http.createServer()
  proxy.on('connect', (request, client, head) => {
    assert.equal(request.url, `owned-npm-proof.invalid:${port}`)
    proxyCalls++
    const target = net.connect(port, '127.0.0.1', () => {
      client.write('HTTP/1.1 200 Connection Established\r\n\r\n')
      if (head.length) target.write(head)
      client.pipe(target).pipe(client)
    })
    target.on('error', () => client.destroy())
    client.on('error', () => target.destroy())
    client.on('close', () => target.destroy())
  })
  await new Promise((resolve) => proxy.listen(0, '127.0.0.1', resolve))
  t.after(() => {
    origin.closeAllConnections()
    origin.close()
    proxy.closeAllConnections()
    proxy.close()
  })
  const direct = { version: '13.0.0', opts: { cafile: certificate, noproxy: '127.0.0.1' } }
  assert.equal(await (await download(direct, `https://127.0.0.1:${port}/`)).text(), 'verified TLS')
  const proxied = { version: '13.0.0', opts: { cafile: certificate, proxy: `http://127.0.0.1:${proxy.address().port}` } }
  assert.equal(await (await download(proxied, `https://owned-npm-proof.invalid:${port}/`)).text(), 'verified TLS')
  assert.equal(proxyCalls, 1)
})
