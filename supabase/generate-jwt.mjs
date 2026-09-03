#!/usr/bin/env node
// Gera ANON_KEY e SERVICE_ROLE_KEY (JWTs HS256 legados) para o .env deste
// stack, assinados com o mesmo JWT_SECRET usado por auth/rest/realtime/kong.
// Sem dependências — HS256 é só base64url(header) + "." + base64url(payload)
// assinado com HMAC-SHA256, que o módulo "crypto" nativo do Node já faz.
//
// Uso: JWT_SECRET=... node generate-jwt.mjs
// (ou: node generate-jwt.mjs "meu-jwt-secret")

import crypto from 'node:crypto';

const secret = process.argv[2] || process.env.JWT_SECRET;
if (!secret) {
  console.error('Uso: JWT_SECRET=... node generate-jwt.js   (ou passe o secret como argumento)');
  process.exit(1);
}

function base64url(input) {
  return Buffer.from(input).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function signJwt(payload, secret) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const headerPart = base64url(JSON.stringify(header));
  const payloadPart = base64url(JSON.stringify(payload));
  const signature = crypto
    .createHmac('sha256', secret)
    .update(`${headerPart}.${payloadPart}`)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  return `${headerPart}.${payloadPart}.${signature}`;
}

const iat = Math.floor(Date.now() / 1000);
const exp = iat + 10 * 365 * 24 * 60 * 60; // 10 anos — mesma convenção do .env.example oficial do Supabase

const anonKey = signJwt({ role: 'anon', iss: 'vertice-supabase', iat, exp }, secret);
const serviceRoleKey = signJwt({ role: 'service_role', iss: 'vertice-supabase', iat, exp }, secret);

console.log(`ANON_KEY=${anonKey}`);
console.log(`SERVICE_ROLE_KEY=${serviceRoleKey}`);
