// Split out of routes/aiAssistantRoutes.js — providers
const fetch = require('node-fetch');
const { systemPromptFor } = require('./prompts');
const { SAFE_TOOL_DEFINITIONS } = require('./tools');

// ═══════════════════════════════════════════════
// MULTI-PROVIDER AI INTEGRATION — ALL FREE!
// Supports: Pollinations (FREE, NO KEY), Gemini, Groq, Cerebras, OpenRouter, DeepSeek, OpenAI
// Priority: Pollinations (always free) → Gemini Pro → Groq → DeepSeek → Cerebras → OpenRouter → OpenAI
// ═══════════════════════════════════════════════

async function callAI(messages, toolDefs) {
  const geminiKey = process.env.GEMINI_API_KEY;
  const groqKey = process.env.GROQ_API_KEY;
  const cerebrasKey = process.env.CEREBRAS_API_KEY;
  const openrouterKey = process.env.OPENROUTER_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;
  const deepseekKey = process.env.DEEPSEEK_API_KEY;
  
  // ── Strategy: Best keyed providers FIRST, then free fallback ──
  // Keyed providers have higher rate limits and are faster
  // Pollinations is the LAST resort (always free but rate-limited)

  // 1. Groq — Very fast, 1000 req/day (if key provided)
  if (groqKey) {
    const result = await callGroq(messages, toolDefs, groqKey);
    if (result) return { ...result, provider: 'Groq' };
  }

  // 2. Gemini 2.5 Pro — Most powerful free model (if key provided)
  if (geminiKey) {
    const proResult = await callGemini(messages, toolDefs, geminiKey, 'gemini-2.5-pro');
    if (proResult) return { ...proResult, provider: 'Gemini 2.5 Pro' };
    
    const flashResult = await callGemini(messages, toolDefs, geminiKey, 'gemini-2.5-flash');
    if (flashResult) return { ...flashResult, provider: 'Gemini 2.5 Flash' };
  }

  // 3. DeepSeek V3 — Great for code, 5M free tokens (if key provided)
  if (deepseekKey) {
    const result = await callDeepSeek(messages, toolDefs, deepseekKey);
    if (result) return { ...result, provider: 'DeepSeek V3' };
  }

  // 4. Cerebras — Very fast, 1M tokens/day (if key provided)
  if (cerebrasKey) {
    const result = await callCerebras(messages, toolDefs, cerebrasKey);
    if (result) return { ...result, provider: 'Cerebras' };
  }

  // 5. OpenRouter — Multi-model gateway (if key provided)
  if (openrouterKey) {
    const result = await callOpenRouter(messages, toolDefs, openrouterKey);
    if (result) return { ...result, provider: 'OpenRouter' };
  }

  // 6. OpenAI GPT-4o — Paid only (if key provided)
  if (openaiKey) {
    const result = await callOpenAI(messages, toolDefs, openaiKey);
    if (result) return { ...result, provider: 'OpenAI GPT-4o' };
  }

  // 7. Pollinations AI — ALWAYS FREE, NO KEY — last resort fallback
  const pollResult = process.env.ALLOW_PUBLIC_AI === 'true'
    ? await callPollinations(messages, toolDefs) : null;
  if (pollResult) return { ...pollResult, provider: 'Pollinations AI (Free)' };

  return null; // All providers failed — fall back to rule-based
}

// ── POLLINATIONS AI (100% FREE, NO API KEY NEEDED!) ──
// OpenAI-compatible API, supports tool calling, no signup required
// Endpoint: https://text.pollinations.ai/openai
// Anonymous: ~1 req/15sec, Free registered: ~1 req/5sec
async function callPollinations(messages, toolDefs) {
  const url = 'https://text.pollinations.ai/openai';

  const pollMessages = [
    { role: 'system', content: systemPromptFor(messages) }
  ];

  for (const msg of messages) {
    if (msg.role === 'user') {
      pollMessages.push({ role: 'user', content: msg.content });
    } else if (msg.role === 'assistant' || msg.role === 'model') {
      pollMessages.push({ role: 'assistant', content: msg.content });
    } else if (msg.role === 'tool_call') {
      pollMessages.push({ 
        role: 'assistant', 
        content: null,
        tool_calls: [{ id: `call_${msg.name}_${Date.now()}`, type: 'function', function: { name: msg.name, arguments: JSON.stringify(msg.args || {}) } }]
      });
    } else if (msg.role === 'tool_result') {
      pollMessages.push({
        role: 'tool',
        tool_call_id: `call_${msg.name}`,
        content: JSON.stringify(msg.result)
      });
    }
  }

  // Convert tool definitions to OpenAI format
  const pollTools = toolDefs.map(td => ({
    type: 'function',
    function: {
      name: td.name,
      description: td.description,
      parameters: td.parameters || { type: 'object', properties: {} }
    }
  }));

  try {
    const response = await safeFetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
        // NO API KEY NEEDED! 🎉
      },
      body: JSON.stringify({
        model: 'openai',  // Free: GPT-OSS 20B Reasoning model (supports tools!)
        messages: pollMessages,
        tools: pollTools,
        temperature: 0.7,
        max_tokens: 4096
      }),
      // timeout handled by safeFetch
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Pollinations error:', response.status, errText.substring(0, 200));
      return null;
    }

    const data = await response.json();
    const choice = data.choices?.[0];
    if (!choice) return null;

    const toolCalls = [];
    if (choice.message?.tool_calls) {
      for (const tc of choice.message.tool_calls) {
        try {
          toolCalls.push({
            name: tc.function.name,
            args: JSON.parse(tc.function.arguments)
          });
        } catch (e) {}
      }
    }

    return {
      text: choice.message?.content || '',
      toolCalls,
      finishReason: choice.finish_reason
    };
  } catch (err) {
    console.error('Pollinations fetch error:', err.message);
    return null;
  }
}

// ── DEEPSEEK API (Free tier: 5M tokens, great for code) ──
async function callDeepSeek(messages, toolDefs, apiKey) {
  const url = 'https://api.deepseek.com/v1/chat/completions';

  const dsMessages = [
    { role: 'system', content: systemPromptFor(messages) }
  ];

  for (const msg of messages) {
    if (msg.role === 'user') {
      dsMessages.push({ role: 'user', content: msg.content });
    } else if (msg.role === 'assistant' || msg.role === 'model') {
      dsMessages.push({ role: 'assistant', content: msg.content });
    } else if (msg.role === 'tool_call') {
      dsMessages.push({ 
        role: 'assistant', 
        content: null,
        tool_calls: [{ id: `call_${msg.name}_${Date.now()}`, type: 'function', function: { name: msg.name, arguments: JSON.stringify(msg.args || {}) } }]
      });
    } else if (msg.role === 'tool_result') {
      dsMessages.push({
        role: 'tool',
        tool_call_id: `call_${msg.name}`,
        content: JSON.stringify(msg.result)
      });
    }
  }

  const dsTools = toolDefs.map(td => ({
    type: 'function',
    function: {
      name: td.name,
      description: td.description,
      parameters: td.parameters || { type: 'object', properties: {} }
    }
  }));

  try {
    const response = await safeFetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: dsMessages,
        tools: dsTools,
        temperature: 0.7,
        max_tokens: 4096
      }),
      // timeout handled by safeFetch
    });

    if (!response.ok) return null;

    const data = await response.json();
    const choice = data.choices?.[0];
    if (!choice) return null;

    const toolCalls = [];
    if (choice.message?.tool_calls) {
      for (const tc of choice.message.tool_calls) {
        try {
          toolCalls.push({
            name: tc.function.name,
            args: JSON.parse(tc.function.arguments)
          });
        } catch (e) {}
      }
    }

    return {
      text: choice.message?.content || '',
      toolCalls,
      finishReason: choice.finish_reason
    };
  } catch (err) {
    console.error('DeepSeek fetch error:', err.message);
    return null;
  }
}

// ── GEMINI API ──
async function callGemini(messages, toolDefs, apiKey, model = 'gemini-2.5-pro') {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  // Convert messages to Gemini format
  const contents = [];
  for (const msg of messages) {
    if (msg.role === 'user') {
      contents.push({ role: 'user', parts: [{ text: msg.content }] });
    } else if (msg.role === 'assistant' || msg.role === 'model') {
      contents.push({ role: 'model', parts: [{ text: msg.content }] });
    } else if (msg.role === 'tool_call') {
      contents.push({ role: 'model', parts: [{ functionCall: { name: msg.name, args: msg.args || {} } }] });
    } else if (msg.role === 'tool_result') {
      contents.push({ role: 'user', parts: [{ functionResponse: { name: msg.name, response: msg.result } }] });
    }
  }

  const body = {
    contents,
    systemInstruction: { parts: [{ text: systemPromptFor(messages) }] },
    tools: [{ functionDeclarations: toolDefs }],
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 16384,
      topP: 0.95
    }
  };

  try {
    const response = await safeFetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      // timeout handled by safeFetch
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`Gemini ${model} error:`, response.status, errText.substring(0, 200));
      return null;
    }

    const data = await response.json();
    return extractGeminiResponse(data);
  } catch (err) {
    console.error(`Gemini ${model} fetch error:`, err.message);
    return null;
  }
}

// ── OPENAI API ──
async function callOpenAI(messages, toolDefs, apiKey) {
  const url = 'https://api.openai.com/v1/chat/completions';

  // Convert to OpenAI format
  const openaiMessages = [
    { role: 'system', content: systemPromptFor(messages) }
  ];

  for (const msg of messages) {
    if (msg.role === 'user') {
      openaiMessages.push({ role: 'user', content: msg.content });
    } else if (msg.role === 'assistant' || msg.role === 'model') {
      openaiMessages.push({ role: 'assistant', content: msg.content });
    } else if (msg.role === 'tool_call') {
      openaiMessages.push({ 
        role: 'assistant', 
        content: null,
        tool_calls: [{ id: `call_${msg.name}`, type: 'function', function: { name: msg.name, arguments: JSON.stringify(msg.args || {}) } }]
      });
    } else if (msg.role === 'tool_result') {
      openaiMessages.push({
        role: 'tool',
        tool_call_id: `call_${msg.name}`,
        content: JSON.stringify(msg.result)
      });
    }
  }

  // Convert tool definitions to OpenAI format
  const openaiTools = toolDefs.map(td => ({
    type: 'function',
    function: {
      name: td.name,
      description: td.description,
      parameters: td.parameters || { type: 'object', properties: {} }
    }
  }));

  try {
    const response = await safeFetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: openaiMessages,
        tools: openaiTools,
        temperature: 0.7,
        max_tokens: 4096
      }),
      // timeout handled by safeFetch
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('OpenAI error:', response.status, errText.substring(0, 200));
      return null;
    }

    const data = await response.json();
    const choice = data.choices?.[0];
    if (!choice) return null;

    const toolCalls = [];
    if (choice.message?.tool_calls) {
      for (const tc of choice.message.tool_calls) {
        try {
          toolCalls.push({
            name: tc.function.name,
            args: JSON.parse(tc.function.arguments)
          });
        } catch (e) {}
      }
    }

    return {
      text: choice.message?.content || '',
      toolCalls,
      finishReason: choice.finish_reason
    };
  } catch (err) {
    console.error('OpenAI fetch error:', err.message);
    return null;
  }
}

// ── GROQ API (Free Llama 3.3 70B) ──
async function callGroq(messages, toolDefs, apiKey) {
  const url = 'https://api.groq.com/openai/v1/chat/completions';

  const groqMessages = [
    { role: 'system', content: systemPromptFor(messages) }
  ];

  for (const msg of messages) {
    if (msg.role === 'user') {
      groqMessages.push({ role: 'user', content: msg.content });
    } else if (msg.role === 'assistant' || msg.role === 'model') {
      groqMessages.push({ role: 'assistant', content: msg.content });
    }
  }

  // Groq tool calling format (OpenAI compatible)
  const groqTools = toolDefs.map(td => ({
    type: 'function',
    function: {
      name: td.name,
      description: td.description,
      parameters: td.parameters || { type: 'object', properties: {} }
    }
  }));

  try {
    const response = await safeFetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: process.env.GROQ_MODEL || 'openai/gpt-oss-20b',
        messages: groqMessages,
        tools: groqTools,
        temperature: 0.7,
        max_tokens: 4096
      }),
      // timeout handled by safeFetch
    });

    if (!response.ok) return null;

    const data = await response.json();
    const choice = data.choices?.[0];
    if (!choice) return null;

    const toolCalls = [];
    if (choice.message?.tool_calls) {
      for (const tc of choice.message.tool_calls) {
        try {
          toolCalls.push({
            name: tc.function.name,
            args: JSON.parse(tc.function.arguments)
          });
        } catch (e) {}
      }
    }

    return {
      text: choice.message?.content || '',
      toolCalls,
      finishReason: choice.finish_reason
    };
  } catch (err) {
    console.error('Groq fetch error:', err.message);
    return null;
  }
}

// ── CEREBRAS API (Free, very fast Llama 3.3 70B) ──
async function callCerebras(messages, toolDefs, apiKey) {
  const url = 'https://api.cerebras.ai/v1/chat/completions';

  const cbrMessages = [
    { role: 'system', content: systemPromptFor(messages) }
  ];

  for (const msg of messages) {
    if (msg.role === 'user') {
      cbrMessages.push({ role: 'user', content: msg.content });
    } else if (msg.role === 'assistant' || msg.role === 'model') {
      cbrMessages.push({ role: 'assistant', content: msg.content });
    }
  }

  // Cerebras uses OpenAI-compatible API with tool calling
  const cbrTools = toolDefs.map(td => ({
    type: 'function',
    function: {
      name: td.name,
      description: td.description,
      parameters: td.parameters || { type: 'object', properties: {} }
    }
  }));

  try {
    const response = await safeFetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b',
        messages: cbrMessages,
        tools: cbrTools,
        temperature: 0.7,
        max_tokens: 4096
      }),
      // timeout handled by safeFetch
    });

    if (!response.ok) return null;

    const data = await response.json();
    const choice = data.choices?.[0];
    if (!choice) return null;

    const toolCalls = [];
    if (choice.message?.tool_calls) {
      for (const tc of choice.message.tool_calls) {
        try {
          toolCalls.push({
            name: tc.function.name,
            args: JSON.parse(tc.function.arguments)
          });
        } catch (e) {}
      }
    }

    return {
      text: choice.message?.content || '',
      toolCalls,
      finishReason: choice.finish_reason
    };
  } catch (err) {
    console.error('Cerebras fetch error:', err.message);
    return null;
  }
}

// ── OPENROUTER API (Free tier, multi-model gateway) ──
async function callOpenRouter(messages, toolDefs, apiKey) {
  const url = 'https://openrouter.ai/api/v1/chat/completions';

  const orMessages = [
    { role: 'system', content: systemPromptFor(messages) }
  ];

  for (const msg of messages) {
    if (msg.role === 'user') {
      orMessages.push({ role: 'user', content: msg.content });
    } else if (msg.role === 'assistant' || msg.role === 'model') {
      orMessages.push({ role: 'assistant', content: msg.content });
    }
  }

  const orTools = toolDefs.map(td => ({
    type: 'function',
    function: {
      name: td.name,
      description: td.description,
      parameters: td.parameters || { type: 'object', properties: {} }
    }
  }));

  try {
    const response = await safeFetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://glob-erp.vercel.app',
        'X-Title': 'Glob ERP AI Assistant'
      },
      body: JSON.stringify({
        // Use a free model — tries them in order
        model: 'google/gemini-2.5-flash-preview-05-20',
        models: ['google/gemini-2.5-flash-preview-05-20', 'meta-llama/llama-3.3-70b-instruct'],
        messages: orMessages,
        tools: orTools,
        temperature: 0.7,
        max_tokens: 4096
      }),
      // timeout handled by safeFetch
    });

    if (!response.ok) return null;

    const data = await response.json();
    const choice = data.choices?.[0];
    if (!choice) return null;

    const toolCalls = [];
    if (choice.message?.tool_calls) {
      for (const tc of choice.message.tool_calls) {
        try {
          toolCalls.push({
            name: tc.function.name,
            args: JSON.parse(tc.function.arguments)
          });
        } catch (e) {}
      }
    }

    return {
      text: choice.message?.content || '',
      toolCalls,
      finishReason: choice.finish_reason
    };
  } catch (err) {
    console.error('OpenRouter fetch error:', err.message);
    return null;
  }
}

function extractGeminiResponse(data) {
  if (!data?.candidates?.[0]?.content?.parts) return null;
  
  const parts = data.candidates[0].content.parts;
  const textParts = [];
  const toolCalls = [];

  for (const part of parts) {
    if (part.text) textParts.push(part.text);
    if (part.functionCall) {
      toolCalls.push({
        name: part.functionCall.name,
        args: part.functionCall.args || {}
      });
    }
  }

  return {
    text: textParts.join('\n'),
    toolCalls,
    finishReason: data.candidates[0].finishReason
  };
}

// ═══════════════════════════════════════════════
// QUICK ACTION ENDPOINTS
// ═══════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════
// STREAMING LAYER — token-by-token responses (SSE)
// Makes the assistant feel instant & alive instead of a 30s wait.
// ═══════════════════════════════════════════════════════════════

const sleep = ms => new Promise(r => setTimeout(r, ms));

function chunkText(text, size = 24) {
  const out = [];
  for (let i = 0; i < text.length; i += size) out.push(text.slice(i, i + size));
  return out;
}

// OpenAI-compatible SSE streaming (Groq, DeepSeek, Cerebras, OpenRouter, OpenAI, Pollinations)
async function streamOpenAICompatible({ url, apiKey, model, messages, tools, onDelta, timeoutMs = 120000 }) {
  const headers = { 'Content-Type': 'application/json' };
  if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resp = await fetch(url, {
      method: 'POST', headers,
      body: JSON.stringify({ model, messages, tools, temperature: 0.7, max_tokens: 2048, stream: true }),
      signal: controller.signal
    });
    if (!resp.ok || !resp.body) { clearTimeout(timer); return false; }
    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '', got = false;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        const t = line.trim();
        if (!t.startsWith('data:')) continue;
        const payload = t.slice(5).trim();
        if (!payload || payload === '[DONE]') continue;
        try {
          const json = JSON.parse(payload);
          const delta = json.choices?.[0]?.delta?.content;
          if (delta) { got = true; onDelta(delta); }
        } catch (e) { /* skip malformed chunk */ }
      }
    }
    clearTimeout(timer);
    return got;
  } catch (e) {
    clearTimeout(timer);
    return false;
  }
}

// Gemini SSE streaming (non-OpenAI format)
async function streamGemini({ apiKey, model, messages, onDelta, timeoutMs = 120000 }) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`;
  const contents = [];
  for (const msg of messages) {
    if (msg.role === 'user') contents.push({ role: 'user', parts: [{ text: msg.content }] });
    else if (msg.role === 'assistant' || msg.role === 'model') contents.push({ role: 'model', parts: [{ text: msg.content }] });
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents,
        systemInstruction: { parts: [{ text: systemPromptFor(messages) }] },
        generationConfig: { temperature: 0.7, maxOutputTokens: 2048 }
      }),
      signal: controller.signal
    });
    if (!resp.ok || !resp.body) { clearTimeout(timer); return false; }
    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '', got = false;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        const t = line.trim();
        if (!t.startsWith('data:')) continue;
        const payload = t.slice(5).trim();
        if (!payload) continue;
        try {
          const json = JSON.parse(payload);
          const text = json.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('');
          if (text) { got = true; onDelta(text); }
        } catch (e) { /* skip */ }
      }
    }
    clearTimeout(timer);
    return got;
  } catch (e) {
    clearTimeout(timer);
    return false;
  }
}

// Try providers in priority order and stream the FIRST one that works.
async function streamFinalAnswer(messages, onDelta) {
  const geminiKey = process.env.GEMINI_API_KEY;
  const groqKey = process.env.GROQ_API_KEY;
  const deepseekKey = process.env.DEEPSEEK_API_KEY;
  const cerebrasKey = process.env.CEREBRAS_API_KEY;
  const openrouterKey = process.env.OPENROUTER_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;

  const oaiTools = SAFE_TOOL_DEFINITIONS.map(td => ({
    type: 'function',
    function: { name: td.name, description: td.description, parameters: td.parameters || { type: 'object', properties: {} } }
  }));
  const oaiMessages = [
    { role: 'system', content: systemPromptFor(messages) },
    ...messages.filter(m => m.role === 'user' || m.role === 'assistant' || m.role === 'model')
      .map(m => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.content }))
  ];

  if (groqKey && await streamOpenAICompatible({ url: 'https://api.groq.com/openai/v1/chat/completions', apiKey: groqKey, model: process.env.GROQ_MODEL || 'openai/gpt-oss-20b', messages: oaiMessages, tools: oaiTools, onDelta })) return 'Groq';
  if (geminiKey && await streamGemini({ apiKey: geminiKey, model: 'gemini-2.5-flash', messages, onDelta })) return 'Gemini 2.5 Flash';
  if (deepseekKey && await streamOpenAICompatible({ url: 'https://api.deepseek.com/v1/chat/completions', apiKey: deepseekKey, model: 'deepseek-chat', messages: oaiMessages, tools: oaiTools, onDelta })) return 'DeepSeek V3';
  if (cerebrasKey && await streamOpenAICompatible({ url: 'https://api.cerebras.ai/v1/chat/completions', apiKey: cerebrasKey, model: 'llama-3.3-70b', messages: oaiMessages, tools: oaiTools, onDelta })) return 'Cerebras';
  if (openrouterKey && await streamOpenAICompatible({ url: 'https://openrouter.ai/api/v1/chat/completions', apiKey: openrouterKey, model: 'google/gemini-2.5-flash-preview-05-20', messages: oaiMessages, tools: oaiTools, onDelta })) return 'OpenRouter';
  if (openaiKey && await streamOpenAICompatible({ url: 'https://api.openai.com/v1/chat/completions', apiKey: openaiKey, model: 'gpt-4o', messages: oaiMessages, tools: oaiTools, onDelta })) return 'OpenAI GPT-4o';
  if (process.env.ALLOW_PUBLIC_AI === 'true' && await streamOpenAICompatible({ url: 'https://text.pollinations.ai/openai', apiKey: null, model: 'openai', messages: oaiMessages, tools: oaiTools, onDelta })) return 'Pollinations AI (Free)';
  return null;
}

// ── Call a single specific provider by name ──
async function callSingleProvider(providerName, messages, toolDefs) {
  if (/pollinations/i.test(String(providerName)) && process.env.ALLOW_PUBLIC_AI !== 'true') return null;
  switch (providerName) {
    case 'Groq':
      if (process.env.GROQ_API_KEY) {
        const r = await callGroq(messages, toolDefs, process.env.GROQ_API_KEY);
        return r ? { ...r, provider: 'Groq' } : null;
      }
      return null;
    case 'Gemini 2.5 Pro':
      if (process.env.GEMINI_API_KEY) {
        const r = await callGemini(messages, toolDefs, process.env.GEMINI_API_KEY, 'gemini-2.5-pro');
        return r ? { ...r, provider: 'Gemini 2.5 Pro' } : null;
      }
      return null;
    case 'Gemini 2.5 Flash':
      if (process.env.GEMINI_API_KEY) {
        const r = await callGemini(messages, toolDefs, process.env.GEMINI_API_KEY, 'gemini-2.5-flash');
        return r ? { ...r, provider: 'Gemini 2.5 Flash' } : null;
      }
      return null;
    case 'DeepSeek V3':
      if (process.env.DEEPSEEK_API_KEY) {
        const r = await callDeepSeek(messages, toolDefs, process.env.DEEPSEEK_API_KEY);
        return r ? { ...r, provider: 'DeepSeek V3' } : null;
      }
      return null;
    case 'Cerebras':
      if (process.env.CEREBRAS_API_KEY) {
        const r = await callCerebras(messages, toolDefs, process.env.CEREBRAS_API_KEY);
        return r ? { ...r, provider: 'Cerebras' } : null;
      }
      return null;
    case 'OpenRouter':
      if (process.env.OPENROUTER_API_KEY) {
        const r = await callOpenRouter(messages, toolDefs, process.env.OPENROUTER_API_KEY);
        return r ? { ...r, provider: 'OpenRouter' } : null;
      }
      return null;
    case 'Pollinations AI (Free)':
      const r = await callPollinations(messages, toolDefs);
      return r ? { ...r, provider: 'Pollinations AI (Free)' } : null;
    default:
      return null;
  }
}

// ── HELPER: Safe fetch with AbortController timeout ──
async function safeFetch(url, options = {}, timeoutMs = 60000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resp = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timer);
    return resp;
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}


module.exports = { callAI, callPollinations, callDeepSeek, callGemini, callOpenAI, callGroq, callCerebras, callOpenRouter, extractGeminiResponse, sleep, chunkText, streamOpenAICompatible, streamGemini, streamFinalAnswer, callSingleProvider, safeFetch };
