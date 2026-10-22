import test from 'node:test';
import assert from 'node:assert/strict';
import { apiEndpoint, normalizeApiOrigin } from '../src/lib/apiEndpoint';

test('独立后端地址在JSON请求和SSE中保持一致，本地留空仍走同源', () => {
  assert.equal(apiEndpoint('/api/rooms'), '/api/rooms');
  assert.equal(apiEndpoint('/api/rooms', ' https://paper-api.example.test/ '), 'https://paper-api.example.test/api/rooms');
  assert.equal(apiEndpoint('/api/rooms/abc/events?token=sample', 'https://paper-api.example.test'), 'https://paper-api.example.test/api/rooms/abc/events?token=sample');
  assert.equal(normalizeApiOrigin('http://127.0.0.1:5188'), 'http://127.0.0.1:5188');
  assert.throws(() => apiEndpoint('//other.test/api'), /路径无效/);
});

test('后端配置拒绝凭据、查询参数、路径及公网HTTP，避免上线后混合内容或地址误配', () => {
  for (const value of ['javascript:alert(1)', '//api.example.test', 'http://api.example.test', 'https://user:password@api.example.test', 'https://api.example.test/api', 'https://api.example.test?token=secret', 'https://api.example.test/#share']) assert.throws(() => normalizeApiOrigin(value), /HTTPS/);
});
