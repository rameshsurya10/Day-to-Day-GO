/* =================================================================
   ai.js — the coach's model provider (server-only).
   Groq exposes an OpenAI-compatible API, so the OpenAI-compatible
   provider works; point GROQ_BASE_URL elsewhere to use another host.
   ================================================================= */

import { createOpenAICompatible } from '@ai-sdk/openai-compatible';

const DEFAULT_BASE_URL = 'https://api.groq.com/openai/v1';

export function coachConfigError() {
  if (!process.env.GROQ_API_KEY) return 'GROQ_API_KEY is not set.';
  if (!process.env.COACH_MODEL) return 'COACH_MODEL is not set.';
  return null;
}

let provider;
export function coachModel() {
  provider ??= createOpenAICompatible({
    name: 'groq',
    baseURL: process.env.GROQ_BASE_URL || DEFAULT_BASE_URL,
    apiKey: process.env.GROQ_API_KEY,
  });
  return provider(process.env.COACH_MODEL);
}
