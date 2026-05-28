/**
 * nodeFetch — Custom fetch implementation using Node.js built-in `https` module.
 *
 * Why: Node.js 22's built-in `fetch` (powered by `undici`) can fail with
 * ConnectTimeoutError on Windows when connecting to Cloudflare-backed APIs
 * (e.g. Supabase) due to TLS/HTTP2 ALPN negotiation issues. The classic
 * `https` module reliably handles these connections.
 *
 * Usage: pass as `global.fetch` option in Supabase `createClient()`.
 */

import * as https from 'node:https';
import * as http from 'node:http';

const TIMEOUT_MS = 30_000; // 30 seconds — generous for Supabase cold starts

export async function nodeFetch(
  input: RequestInfo | URL | string,
  init?: RequestInit,
): Promise<Response> {
  return new Promise((resolve, reject) => {
    // ── Normalise URL ───────────────────────────────────────────────────────
    let url: URL;
    if (typeof input === 'string') {
      url = new URL(input);
    } else if (input instanceof URL) {
      url = input;
    } else {
      // Request object
      url = new URL((input as Request).url);
    }

    // ── Method ──────────────────────────────────────────────────────────────
    const method: string =
      init?.method ??
      (typeof input !== 'string' && !(input instanceof URL)
        ? (input as Request).method
        : 'GET');

    // ── Headers ─────────────────────────────────────────────────────────────
    const headers: Record<string, string> = {};
    const rawHeaders = init?.headers;
    if (rawHeaders) {
      if (typeof (rawHeaders as Headers).forEach === 'function') {
        (rawHeaders as Headers).forEach((v, k) => (headers[k] = v));
      } else if (Array.isArray(rawHeaders)) {
        (rawHeaders as [string, string][]).forEach(([k, v]) => (headers[k] = v));
      } else {
        Object.assign(headers, rawHeaders as Record<string, string>);
      }
    }

    // ── Body ────────────────────────────────────────────────────────────────
    let bodyBuffer: Buffer | undefined;
    if (init?.body != null) {
      if (typeof init.body === 'string') {
        bodyBuffer = Buffer.from(init.body, 'utf8');
      } else if (Buffer.isBuffer(init.body)) {
        bodyBuffer = init.body;
      } else if (init.body instanceof Uint8Array) {
        bodyBuffer = Buffer.from(init.body);
      } else {
        bodyBuffer = Buffer.from(JSON.stringify(init.body), 'utf8');
      }
      if (!headers['content-length']) {
        headers['content-length'] = String(bodyBuffer!.length);
      }
    }

    // ── Request ─────────────────────────────────────────────────────────────
    const isHttps = url.protocol === 'https:';
    const mod = isHttps ? https : http;
    const port = url.port
      ? Number(url.port)
      : isHttps
        ? 443
        : 80;

    const req = mod.request(
      {
        hostname: url.hostname,
        port,
        path: url.pathname + url.search,
        method: method.toUpperCase(),
        headers,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => {
          const respBody = Buffer.concat(chunks);

          // Convert Node.js IncomingMessage headers → Fetch API Headers
          const respHeaders = new Headers();
          Object.entries(res.headers).forEach(([k, v]) => {
            if (v != null) {
              respHeaders.set(k, Array.isArray(v) ? v.join(', ') : String(v));
            }
          });

          resolve(
            new Response(respBody, {
              status: res.statusCode ?? 200,
              statusText: res.statusMessage ?? '',
              headers: respHeaders,
            }),
          );
        });
        res.on('error', reject);
      },
    );

    // ── Timeout ─────────────────────────────────────────────────────────────
    req.setTimeout(TIMEOUT_MS, () => {
      req.destroy(
        new Error(
          `[nodeFetch] Request to ${url.hostname} timed out after ${TIMEOUT_MS}ms`,
        ),
      );
    });

    req.on('error', (err) => reject(err));

    if (bodyBuffer) req.write(bodyBuffer);
    req.end();
  });
}
