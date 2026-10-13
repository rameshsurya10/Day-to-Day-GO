/* =================================================================
   ai.js — the coach's model provider (server-only).
   Groq exposes an OpenAI-compatible API, so the OpenAI-compatible
   provider works; point GROQ_BASE_URL elsewhere to use another host.
   ================================================================= */

import { createOpenAICompatible } from '@ai-sdk/openai-compatible';

const DEFAULT_BASE_URL = 'https://api.groq.com/openai/v1';

/* Dashboard values are often pasted with quotes or stray spaces
   ("openai/gpt-oss-120b" ) — strip them so the provider gets a clean id. */
const env = (name) => (process.env[name] || '').trim().replace(/^(['"])(.*)\1$/, '$2').trim();

export function coachConfigError() {
  if (!env('GROQ_API_KEY')) return 'GROQ_API_KEY is not set.';
  if (!env('COACH_MODEL')) return 'COACH_MODEL is not set.';
  return null;
}

let provider;
export function coachModel() {
  provider ??= createOpenAICompatible({
    name: 'groq',
    baseURL: env('GROQ_BASE_URL') || DEFAULT_BASE_URL,
    apiKey: env('GROQ_API_KEY'),
  });
  return provider(env('COACH_MODEL'));
}
