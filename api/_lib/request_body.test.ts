import { Readable } from 'node:stream';
import { expect, it } from 'vitest';
import { prepareRequestBody } from './request_body';

function request(chunks: Buffer[], contentType: string): any {
  return Object.assign(Readable.from(chunks), { method: 'POST', headers: { 'content-type': contentType } });
}

it('retains the exact JSON bytes while exposing the parsed body to existing handlers', async () => {
  const raw = Buffer.from('{ "action": "test" }\n');
  const req = request([raw.subarray(0, 5), raw.subarray(5)], 'application/json');
  await prepareRequestBody(req);
  expect(req.body).toEqual({ action: 'test' });
  expect(req.rawBody).toEqual(raw);
});

it('keeps non-JSON WebSub XML intact for its existing signature verifier', async () => {
  const raw = Buffer.from('<feed>test</feed>\n');
  const req = request([raw], 'application/atom+xml');
  await prepareRequestBody(req);
  expect(req.body).toEqual(raw);
});

it('rejects an invalid JSON body with a client error', async () => {
  await expect(prepareRequestBody(request([Buffer.from('{')], 'application/json'))).rejects.toMatchObject({ statusCode: 400 });
});

it('rejects an oversized chunked request before collecting its entire stream', async () => {
  await expect(prepareRequestBody(request([Buffer.alloc(3 * 1024 * 1024), Buffer.alloc(2 * 1024 * 1024)], 'application/json'))).rejects.toMatchObject({ statusCode: 413 });
});
