import { lookup } from 'node:dns/promises';
import { BlockList, isIP } from 'node:net';
import http from 'node:http';
import https from 'node:https';

const blocked4 = new BlockList();
for (const [subnet, prefix] of [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8],
  ['169.254.0.0', 16], ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.0.2.0', 24],
  ['192.88.99.0', 24], ['192.168.0.0', 16], ['198.18.0.0', 15],
  ['198.51.100.0', 24], ['203.0.113.0', 24], ['224.0.0.0', 4], ['240.0.0.0', 4],
] as [string, number][]) blocked4.addSubnet(subnet, prefix, 'ipv4');
const global6 = new BlockList();
global6.addSubnet('2000::', 3, 'ipv6');
const blocked6 = new BlockList();
blocked6.addSubnet('2001::', 23, 'ipv6');
blocked6.addSubnet('2001:db8::', 32, 'ipv6');
blocked6.addSubnet('2002::', 16, 'ipv6');

export function isPublicImageAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 4) return !blocked4.check(address, 'ipv4');
  return family === 6 && global6.check(address, 'ipv6') && !blocked6.check(address, 'ipv6');
}

function downloadError(message: string, statusCode: number) { return Object.assign(new Error(message), { statusCode }); }

export async function resolveImageTarget(target: URL) {
  if (!['http:', 'https:'].includes(target.protocol) || target.username || target.password) throw downloadError('Unsupported image URL', 400);
  const hostname = target.hostname.replace(/^\[|\]$/g, '');
  if (!hostname || hostname === 'localhost' || hostname.endsWith('.local') || hostname.endsWith('.localhost')) throw downloadError('Blocked host', 403);
  const literal = isIP(hostname);
  const addresses = literal ? [{ address: hostname, family: literal }] : await lookup(hostname, { all: true, verbatim: true });
  if (!addresses.length || addresses.some(item => !isPublicImageAddress(item.address))) throw downloadError('Blocked host', 403);
  return addresses[0];
}

export async function downloadPublicImage(input: URL, headers: Record<string, string>, maxBytes = 15 * 1024 * 1024): Promise<Buffer> {
  let target = new URL(input);
  for (let redirects = 0; redirects <= 3; redirects++) {
    const address = await resolveImageTarget(target);
    const result = await new Promise<{ buffer?: Buffer; location?: string }>((resolve, reject) => {
      const transport = target.protocol === 'https:' ? https : http;
      const request = transport.get(target, {
        headers: { ...headers, Referer: `${target.origin}/` },
        // Pin the validated address; the connection cannot perform another DNS lookup.
        family: address.family,
        lookup: ((_host: string, options: any, callback: any) => {
          if (options?.all) callback(null, [address]);
          else callback(null, address.address, address.family);
        }) as any,
      }, async response => {
        if ([301, 302, 303, 307, 308].includes(response.statusCode || 0)) {
          const location = response.headers.location;
          response.destroy();
          if (!location) reject(downloadError('Invalid redirect', 502));
          else resolve({ location });
          return;
        }
        if (!response.statusCode || response.statusCode < 200 || response.statusCode >= 300) {
          response.destroy(); reject(downloadError('Upstream error', 502)); return;
        }
        if (Number(response.headers['content-length']) > maxBytes) {
          response.destroy(); reject(downloadError('Too large', 413)); return;
        }
        const chunks: Buffer[] = [];
        let bytes = 0;
        try {
          for await (const chunk of response) {
            const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
            bytes += buffer.length;
            if (bytes > maxBytes) { response.destroy(); throw downloadError('Too large', 413); }
            chunks.push(buffer);
          }
          resolve({ buffer: Buffer.concat(chunks) });
        } catch (error) { reject(error); }
      });
      const deadline = setTimeout(() => request.destroy(downloadError('Image download timed out', 504)), 15000);
      request.on('close', () => clearTimeout(deadline));
      request.on('error', reject);
    });
    if (result.buffer) return result.buffer;
    target = new URL(result.location!, target);
  }
  throw downloadError('Too many redirects', 502);
}
