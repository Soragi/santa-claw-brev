import assert from 'node:assert/strict';
import {once} from 'node:events';
import {mkdir, mkdtemp, rm, writeFile} from 'node:fs/promises';
import http from 'node:http';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {test} from 'node:test';
import WebSocket, {WebSocketServer} from 'ws';
import {createDashboardRelay, dashboardTarget, targetPort} from '../deploy/brev/dashboard-relay.mjs';

const host = ['agent-dashboard-instance', 'gobrev', 'dev'].join('.');
const origin = 'https://' + host;
const accessCode = 'test-only-dashboard-code';
async function listen(server) {
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  return server.address().port;
}

function request(port, options = {}) {
  const {method = 'GET', body, route = '/', headers = {}} = options;
  return new Promise((resolve, reject) => {
    const req = http.request({host: '127.0.0.1', port, path: route, method,
      headers: {Host: host, ...(body ? {'Content-Length': Buffer.byteLength(body)} : {}), ...headers}}, res => {
      let text = '';
      res.on('data', c => { text += c; });
      res.on('end', () => resolve({status: res.statusCode, headers: res.headers, text}));
    });
    req.on('error', reject).end(body);
  });
}

test('only a registered loopback dashboard can be relayed', () => {
  assert.equal(targetPort('http://localhost:18790/#token=private'), 18790);
  for (const url of ['http://127.0.0.1:4311/', 'https://remote.example:18790/', 'http://10.0.0.10:18789/', 'http://name:secret@127.0.0.1:18789/']) {
    assert.throws(() => targetPort(url));
  }
});

for (const agent of ['openclaw', 'hermes']) {
  test(agent + ' relay discovers the selected sandbox and preserves native HTTP and WebSocket auth', async t => {
    const dir = await mkdtemp(path.join(tmpdir(), 'santa-dashboard-fixture-'));
    t.after(() => rm(dir, {recursive: true, force: true}));
    const config = path.join(dir, 'config');
    const stateHome = path.join(dir, 'state');
    const root = path.join(dir, 'checkout');
    const selected = agent === 'hermes' ? 'santa-claw-portable-hermes' : 'santa-claw-portable';
    const receiptDir = path.join(stateHome, selected);
    const sandbox = 'test-' + agent;
    for (const dest of [config, receiptDir, root]) await mkdir(dest, {recursive: true});
    await writeFile(path.join(config, 'options'), agent + '\nexample/test-model\n');
    await writeFile(path.join(receiptDir, 'launcher.json'), JSON.stringify({root, agent, sandbox, qualified: true}));
    let last;
    const native = http.createServer((req, res) => {
      last = req.headers;
      if (req.url === '/redirect') return res.writeHead(302, {location: 'http://localhost:' + native.address().port + '/assets/app.js'}).end();
      res.writeHead(200, {'Set-Cookie': 'native_session=abc; HttpOnly; Domain=localhost; Path=/'}).end(agent + ':' + req.url);
    });
    const nativeWs = new WebSocketServer({server: native});
    nativeWs.on('connection', (stream, req) => {
      last = req.headers;
      stream.send(agent + ' native auth challenge');
      stream.on('message', data => stream.send(data.toString()));
    });
    const target = await listen(native);
    t.after(() => {for (const client of nativeWs.clients) client.terminate(); nativeWs.close(); native.close();});
    let lookups = 0;
    const selectPort = dashboardTarget({home: dir, stateHome, config, root, command: async (name, args) => {
      assert.equal(name, 'nemoclaw');
      assert.deepEqual(args, [sandbox, 'dashboard-url', '--quiet']);
      lookups++;
      return {stdout: 'http://localhost:' + target + '/' + (agent === 'openclaw' ? '#token=private-native-token' : '')};
    }});
    const relay = createDashboardRelay({selectPort, accessCode});
    const port = await listen(relay);
    t.after(() => relay.close());

    const landing = await request(port);
    assert.match(landing.text, /Dashboard access code/);
    assert.doesNotMatch(landing.text, /private-native-token/);
    assert.equal((await request(port, {route: '/assets/app.js'})).status, 401);
    async function unlock(code, requestOrigin = origin) {
      return request(port, {method: 'POST', route: '/_santa/dashboard-unlock', body: 'code=' + code,
        headers: {Origin: requestOrigin, 'Content-Type': 'application/x-www-form-urlencoded'}});
    }
    assert.equal((await unlock('wrong')).status, 401);
    assert.equal((await unlock(accessCode, 'https://evil.example')).status, 403);
    const accepted = await unlock(accessCode);
    assert.equal(accepted.status, 303);
    assert.match(accepted.headers['set-cookie'][0], /Secure; HttpOnly; SameSite=Strict/);
    const cookie = accepted.headers['set-cookie'][0].split(';')[0];
    assert.equal((await request(port, {headers: {Cookie: cookie, Host: host.replace('agent-dashboard', 'other')}})).text, landing.text);

    const app = await request(port, {headers: {Cookie: cookie}});
    assert.equal(app.text, agent + ':/');
    assert.match(app.headers['set-cookie'][0], /^santa_native_native_session=abc; HttpOnly; Path=\/; Secure$/);
    assert.equal((await request(port, {route: '/redirect', headers: {Cookie: cookie}})).headers.location, origin + '/assets/app.js');
    const headers = {Cookie: cookie + '; cf_clearance=private; santa_native_native_session=abc', Origin: origin, Authorization: 'Bearer native'};
    assert.equal((await request(port, {route: '/api/config', method: 'POST', body: '{}', headers})).status, 200);
    assert.equal(last.cookie, 'native_session=abc');
    assert.equal(last.authorization, 'Bearer native');
    assert.equal(last.origin, 'http://127.0.0.1:' + target);
    assert.equal((await request(port, {route: '/api/config', method: 'POST', headers: {Cookie: cookie}})).status, 403);

    const denied = new WebSocket('ws://127.0.0.1:' + port + '/ws', {headers: {Host: host, Origin: origin}});
    assert.match(String((await once(denied, 'error'))[0]), /403/);
    const socket = new WebSocket('ws://127.0.0.1:' + port + '/ws', {headers: {Host: host, ...headers}});
    const [message] = await once(socket, 'message');
    assert.equal(message.toString(), agent + ' native auth challenge');
    assert.equal(last.cookie, 'native_session=abc');
    assert.equal(last.origin, 'http://127.0.0.1:' + target);
    socket.send('ping');
    assert.equal((await once(socket, 'message'))[0].toString(), 'ping');
    socket.close();
    await once(socket, 'close');
    assert.equal(lookups, 1);
  });
}
