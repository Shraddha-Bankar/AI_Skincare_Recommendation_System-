import express from "express";
import cors from "cors";
import fetch from "node-fetch";

const app = express();
app.use(cors());
app.use(express.json({ limit: "20mb" }));

const API_KEY = "sk-or-YOUR-OPENROUTER-KEY-HERE";

app.post("/api/chat", async (req, res) => {
  try {
    const messages = req.body.messages || [];
    const system = req.body.system || "";
    const maxTokens = req.body.max_tokens || 800;

    // Check if any message has an image
    const hasImage = messages.some(m =>
      Array.isArray(m.content) &&
      m.content.some(c => c.type === "image")
    );

    // Use vision model for images, text model for chat
    const model = hasImage
      ? "meta-llama/llama-3.2-11b-vision-instruct:free"
      : "meta-llama/llama-3.1-8b-instruct:free";

    const allMessages = system
      ? [{ role: "system", content: system }, ...messages]
      : messages;

    // Convert messages for OpenRouter
    const convertedMessages = allMessages.map(m => {
      if (Array.isArray(m.content)) {
        // Has image content
        const parts = m.content.map(c => {
          if (c.type === "image") {
            return {
              type: "image_url",
              image_url: {
                url: `data:${c.source.media_type};base64,${c.source.data}`
              }
            };
          }
          if (c.type === "text") {
            return { type: "text", text: c.text };
          }
          return { type: "text", text: "" };
        });
        return { role: m.role, content: parts };
      }
      // Text only message
      return {
        role: m.role,
        content: typeof m.content === "string" ? m.content : ""
      };
    });

    const body = {
      model,
      max_tokens: maxTokens,
      messages: convertedMessages,
    };

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${API_KEY}`,
        "HTTP-Referer": "http://localhost:5173",
        "X-Title": "Lumiere Skincare",
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error: { message: data.error?.message || "OpenRouter error" }
      });
    }

    const text = data.choices?.[0]?.message?.content || "";
    res.json({
      content: [{ type: "text", text }]
    });

  } catch (e) {
    console.error("Proxy error:", e.message);
    res.status(500).json({ error: { message: e.message } });
  }
});

app.get("/test", (req, res) => {
  res.json({ status: "✅ Proxy working with vision support!" });
});

app.listen(3001, () => {
  console.log("✅ Proxy running on http://localhost:3001");
});