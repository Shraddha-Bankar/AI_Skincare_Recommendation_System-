const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;

// Get working key from Supabase
async function getWorkingKey() {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/api_keys?is_active=eq.true&order=last_used.asc.nullsfirst&limit=1`,
    {
      headers: {
        "apikey": SUPABASE_KEY,
        "Authorization": `Bearer ${SUPABASE_KEY}`,
      }
    }
  );
  const keys = await res.json();
  return keys?.[0] || null;
}

// Mark key as failed
async function markKeyFailed(id) {
  await fetch(`${SUPABASE_URL}/rest/v1/api_keys?id=eq.${id}`, {
    method: "PATCH",
    headers: {
      "apikey": SUPABASE_KEY,
      "Authorization": `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      is_active: false,
      fail_count: 99,
      reset_at: new Date(Date.now() + 3600000).toISOString()
    })
  });
}

// Update last used time
async function updateKeyUsed(id) {
  await fetch(`${SUPABASE_URL}/rest/v1/api_keys?id=eq.${id}`, {
    method: "PATCH",
    headers: {
      "apikey": SUPABASE_KEY,
      "Authorization": `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      last_used: new Date().toISOString()
    })
  });
}

// Reset expired keys
async function resetExpiredKeys() {
  await fetch(
    `${SUPABASE_URL}/rest/v1/api_keys?reset_at=lt.${new Date().toISOString()}`,
    {
      method: "PATCH",
      headers: {
        "apikey": SUPABASE_KEY,
        "Authorization": `Bearer ${SUPABASE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        is_active: true,
        fail_count: 0,
        reset_at: null
      })
    }
  );
}

// Call OpenRouter with auto key rotation
async function callOpenRouter(body, attempt = 0) {
  if (attempt >= 4) {
    throw new Error(
      "All API keys are rate limited. Please wait 1 hour and try again."
    );
  }

  await resetExpiredKeys();
  const keyRecord = await getWorkingKey();

  if (!keyRecord) {
    throw new Error(
      "No API keys available right now. Please wait 1 hour."
    );
  }

  const response = await fetch(
    "https://openrouter.ai/api/v1/chat/completions",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${keyRecord.key_value}`,
        "HTTP-Referer": "https://lumiere-app.vercel.app",
        "X-Title": "Lumiere Skincare AI",
      },
      body: JSON.stringify(body),
    }
  );

  const data = await response.json();

  // If rate limited mark key and retry
  if (
    response.status === 429 ||
    data.error?.message?.toLowerCase().includes("quota") ||
    data.error?.message?.toLowerCase().includes("rate") ||
    data.error?.message?.toLowerCase().includes("limit") ||
    data.error?.message?.toLowerCase().includes("credit") ||
    data.error?.message?.toLowerCase().includes("balance")
  ) {
    console.log(`Key ${keyRecord.id} rate limited, switching...`);
    await markKeyFailed(keyRecord.id);
    return callOpenRouter(body, attempt + 1);
  }

  if (!response.ok) {
    throw new Error(data.error?.message || `HTTP ${response.status}`);
  }

  await updateKeyUsed(keyRecord.id);
  return data;
}

export default async function handler(req, res) {
  // Handle CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: { message: "Method not allowed" } });
  }

  try {
    const messages = req.body.messages || [];
    const system = req.body.system || "";
    const maxTokens = req.body.max_tokens || 800;

    // Check if request has image
    const hasImage = messages.some(m =>
      Array.isArray(m.content) &&
      m.content.some(c => c.type === "image")
    );

    // Best free models for each use case
    const model = hasImage
      ? "meta-llama/llama-4-maverick:free"
      : "meta-llama/llama-3.1-8b-instruct:free";

    const allMessages = system
      ? [{ role: "system", content: system }, ...messages]
      : messages;

    // Convert Anthropic format to OpenRouter format
    const converted = allMessages.map(m => {
      if (Array.isArray(m.content)) {
        const parts = m.content.map(c => {
          if (c.type === "image") {
            return {
              type: "image_url",
              image_url: {
                url: `data:${c.source.media_type};base64,${c.source.data}`
              }
            };
          }
          return { type: "text", text: c.text || "" };
        });
        return { role: m.role, content: parts };
      }
      return {
        role: m.role,
        content: typeof m.content === "string" ? m.content : ""
      };
    });

    const data = await callOpenRouter({
      model,
      max_tokens: maxTokens,
      messages: converted,
    });

    const text = data.choices?.[0]?.message?.content || "";

    if (!text) {
      throw new Error("Empty response from AI. Please try again.");
    }

    res.status(200).json({
      content: [{ type: "text", text }]
    });

  } catch (e) {
    console.error("API Error:", e.message);
    res.status(500).json({
      error: { message: e.message }
    });
  }
}