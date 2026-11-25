import {createHmac, randomBytes, timingSafeEqual} from 'node:crypto';
import {execFile} from 'node:child_process';
import {readFile, writeFile} from 'node:fs/promises';
import http from 'node:http';
import {homedir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {promisify} from 'node:util';

const exec = promisify(execFile);
const cookie = '__Host-santa-dashboard';
const sessionSeconds = 12 * 60 * 60;
const loginPath = '/_santa/dashboard-unlock';
const secureHeaders = {
  'Cache-Control': 'no-store',
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
  'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'",
};
const login = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Santa Claw · Agent Dashboard</title>
<style>body{background:#152324;color:#eef8f2;font:17px/1.55 system-ui;margin:12vh auto;padding:0 20px;max-width:540px}input,button{font:inherit;padding:10px}button{background:#b8ea84;color:#152324;border:0}code{overflow-wrap:anywhere}label{display:block;margin-bottom:8px}</style>
<h1>Agent Dashboard</h1><p>On your Brev VM, read the dashboard access code from <code>~/.config/santa-claw-launchable/dashboard-code</code>.</p>
<form method="post" action="${loginPath}"><label for="code">Dashboard access code</label><input id="code" name="code" type="password" autocomplete="off" required maxlength="64" autofocus> <button>Open dashboard</button></form></html>`;

function equal(a, b) {
  const first = Buffer.from(a);
  const second = Buffer.from(b);
  return first.length === second.length && timingSafeEqual(first, second);
}

export function targetPort(output) {
  const url = new URL(output.trim());
  const port = Number(url.port);
  if (url.protocol !== 'http:' || !['127.0.0.1', 'localhost'].includes(url.hostname) ||
      url.username || url.password || !Number.isInteger(port) || port < 1024 || port > 65535 ||
      [4310, 4311, 4312, 4313].includes(port)) {
    throw Error('Expected a native loopback dashboard URL.');
  }
  return port;
}

export function dashboardTarget({home, stateHome, config, root, command = exec}) {
  let pending, cached, expires = 0;
  return async () => {
    if (pending) return pending;
    if (Date.now() < expires) return cached;
    pending = (async () => {
      const [agent] = (await readFile(path.join(config, 'options'), 'utf8')).trim().split('\n');
      if (!['openclaw', 'hermes'].includes(agent)) throw Error('Unknown dashboard runtime.');
      const stateDir = agent === 'hermes' ? 'santa-claw-portable-hermes' : 'santa-claw-portable';
      const receipt = JSON.parse(await readFile(path.join(stateHome, stateDir, 'launcher.json'), 'utf8'));
      if (receipt.root !== root || receipt.agent !== agent || !receipt.qualified ||
          !/^[a-z][a-z0-9-]{1,18}$/.test(receipt.sandbox)) throw Error('Dashboard is waiting for workshop setup.');
      const {stdout} = await command('nemoclaw', [receipt.sandbox, 'dashboard-url', '--quiet'], {
        cwd: root, timeout: 5000, maxBuffer: 8192,
        env: {...process.env, PATH: [path.join(home, '.local/bin'), path.join(home, '.npm-global/bin'), process.env.PATH].join(':')},
      });
      // OpenClaw prints a credential in the fragment. Keep only the port.
      return targetPort(stdout);
    })().then(port => {
      cached = port;
      expires = Date.now() + 15000;
      return port;
    }, () => {
      cached = undefined;
      expires = Date.now() + 2000;
    }).finally(() => { pending = undefined; });
    return pending;
  };
}

function externalOrigin(req) {
  const host = req.headers.host?.toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]*\.gobrev\.dev(?::443)?$/.test(host || '')) return null;
  const origin = 'https://' + host.replace(/:443$/, '');
  if (req.headers.origin && req.headers.origin !== origin) return null;
  if (req.headers['sec-fetch-site'] === 'cross-site' && !(req.method === 'GET' && req.url === '/' && !req.headers.origin)) return null;
  if (!req.url?.startsWith('/') || req.url.startsWith('//') || req.url.includes('\\')) return null;
  return origin;
}

function upstreamHeaders(req, port, upgrade) {
  const result = {...req.headers};
  const nominated = (req.headers.connection || '').toLowerCase().split(',').map(v => v.trim());
  for (const key of [...nominated, 'connection', 'upgrade', 'proxy-authorization', 'proxy-connection', 'keep-alive', 'te', 'trailer', 'transfer-encoding', 'forwarded']) delete result[key];
  for (const key of Object.keys(result)) {
    if (/^(x-forwarded-|cf-|x-auth-request-)/.test(key)) delete result[key];
  }
  // The relay's access cookie and Brev's sign-in cookies belong at the edge.
  // Native session cookies are namespaced when returned through the relay.
  delete result.cookie;
  const nativeCookies = (req.headers.cookie || '').split(';').map(v => v.trim()).filter(v => v.startsWith('santa_native_'));
  if (nativeCookies.length) result.cookie = nativeCookies.map(v => v.slice('santa_native_'.length)).join('; ');
  result.host = '127.0.0.1:' + port;
  if (req.headers.origin) result.origin = 'http://' + result.host;
  if (req.headers.referer) delete result.referer;
  if (upgrade) {
    result.connection = 'Upgrade';
    result.upgrade = 'websocket';
  }
  return result;
}

function responseHeaders(headers, port, origin) {
  const result = {...headers, 'cache-control': 'no-store', 'referrer-policy': 'no-referrer'};
  if (result.location) {
    try {
      const dest = new URL(result.location);
      if (['127.0.0.1', 'localhost'].includes(dest.hostname) && Number(dest.port) === port) {
        result.location = origin + dest.pathname + dest.search + dest.hash;
      }
    } catch {} // Relative redirects already resolve on the Secure Link.
  }
  if (headers['set-cookie']) {
    result['set-cookie'] = headers['set-cookie'].map(c => 'santa_native_' +
      c.replace(/;\s*Domain=[^;]+/ig, '').replace(/;\s*Secure\b/ig, '') + '; Secure');
  }
  return result;
}

export function createDashboardRelay({selectPort, accessCode}) {
  const sign = value => createHmac('sha256', accessCode).update(value).digest('base64url');
  function unlocked(req, origin) {
    const token = (req.headers.cookie || '').split(';').map(v => v.trim()).find(v => v.startsWith(cookie + '='));
    const [expiry, mac] = token?.slice(cookie.length + 1).split('.') || [];
    return Boolean(mac && Number(expiry) > Date.now() && equal(mac, sign(origin + ':' + expiry)));
  }
  function send(res, status, message, type = 'text/plain; charset=utf-8') {
    res.writeHead(status, {...secureHeaders, 'Content-Type': type}).end(message);
  }

  const server = http.createServer(async (req, res) => {
    const origin = externalOrigin(req);
    if (!origin) return send(res, 403, 'Open the authenticated Brev Secure Link.');
    if (req.method === 'POST' && req.url === loginPath) {
      if (req.headers.origin !== origin || !req.headers['content-type']?.startsWith('application/x-www-form-urlencoded') ||
          !Number(req.headers['content-length']) || Number(req.headers['content-length']) > 256) {
        return send(res, 403, 'Open the dashboard sign-in form and try again.');
      }
      try {
        let body = '';
        for await (const chunk of req) {
          body += chunk;
          if (body.length > 256) return send(res, 413, 'Access code too long.');
        }
        if (!equal(new URLSearchParams(body).get('code') || '', accessCode)) {
          return send(res, 401, '<p>That access code did not match.</p>' + login, 'text/html; charset=utf-8');
        }
      } catch {
        return send(res, 400, 'Unable to read the access code.');
      }
      const expiry = Date.now() + sessionSeconds * 1000;
      return res.writeHead(303, {...secureHeaders, Location: '/',
        'Set-Cookie': `${cookie}=${expiry}.${sign(origin + ':' + expiry)}; Path=/; Max-Age=${sessionSeconds}; Secure; HttpOnly; SameSite=Strict`}).end();
    }
    if (!unlocked(req, origin)) {
      if (req.method === 'GET' && req.url === '/') return send(res, 200, login, 'text/html; charset=utf-8');
      return send(res, 401, 'Unlock the dashboard from the Brev Secure Link.');
    }
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && req.headers.origin !== origin) {
      return send(res, 403, 'Dashboard changes require the Secure Link origin.');
    }
    const port = await selectPort();
    if (!port) return send(res, 503, 'Dashboard is starting. Finish Santa Claw Setup, then reload.');
    const upstream = http.request({host: '127.0.0.1', port, path: req.url, method: req.method, headers: upstreamHeaders(req, port, false)}, reply => {
      res.writeHead(reply.statusCode, responseHeaders(reply.headers, port, origin));
      reply.on('error', () => res.destroy());
      reply.pipe(res);
    });
    upstream.on('error', () => {
      if (res.headersSent) res.destroy();
      else send(res, 503, 'Native dashboard unavailable. Check Santa Claw Setup and retry.');
    });
    res.on('close', () => upstream.destroy());
    req.pipe(upstream);
  });

  server.on('upgrade', async (req, socket, head) => {
    socket.on('error', () => socket.destroy());
    const origin = externalOrigin(req);
    if (!origin || req.headers.origin !== origin || req.headers.upgrade?.toLowerCase() !== 'websocket' ||
        !unlocked(req, origin)) return socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');
    const port = await selectPort();
    if (!port) return socket.end('HTTP/1.1 503 Service Unavailable\r\nConnection: close\r\n\r\n');
    if (socket.destroyed) return;
    const upstream = http.request({host: '127.0.0.1', port, path: req.url, method: 'GET', headers: upstreamHeaders(req, port, true)});
    upstream.on('response', reply => {
      reply.resume();
      socket.end('HTTP/1.1 502 Bad Gateway\r\nConnection: close\r\n\r\n');
    });
    upstream.on('upgrade', (reply, stream, upstreamHead) => {
      const lines = reply.rawHeaders.flatMap((name, i) => i % 2 ? [] : [name + ': ' + reply.rawHeaders[i + 1]]);
      socket.write('HTTP/1.1 101 Switching Protocols\r\n' + lines.join('\r\n') + '\r\n\r\n');
      if (upstreamHead.length) socket.write(upstreamHead);
      if (head.length) stream.write(head);
      stream.on('error', () => socket.destroy());
      stream.on('close', () => socket.destroy());
      socket.on('close', () => stream.destroy());
      socket.pipe(stream).pipe(socket);
    });
    upstream.on('error', () => socket.destroy());
    socket.on('close', () => upstream.destroy());
    upstream.end();
  });
  return server;
}

async function main() {
  const home = homedir();
  const config = path.join(home, '.config/santa-claw-launchable');
  const stateHome = process.env.XDG_STATE_HOME || path.join(home, '.local/state');
  const root = fileURLToPath(new URL('../../', import.meta.url)).replace(/\/$/, '');
  const codeFile = path.join(config, 'dashboard-code');
  try {
    await writeFile(codeFile, randomBytes(24).toString('base64url') + '\n', {mode: 0o600, flag: 'wx'});
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
  }
  const accessCode = (await readFile(codeFile, 'utf8')).trim();
  if (!/^[A-Za-z0-9_-]{32}$/.test(accessCode)) throw Error('Invalid dashboard access code file.');
  createDashboardRelay({selectPort: dashboardTarget({home, stateHome, config, root}), accessCode}).listen(4313, '0.0.0.0');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
