# Lumière AI: A Conversational LLM-Based System for Personalized Skincare Recommendation

### Shraddha Bankar
Computer Science Engineering (Data Science)

🔗 Live Demo: https://ai-skincare-recommendation-system.vercel.app/

---

## Abstract

Choosing skincare products that genuinely suit an individual's skin remains a difficult, trial-and-error process for most consumers, who are often guided by social media trends rather than their actual skin type, concerns, or budget. This paper presents **Lumière AI**, a single-page web application that collects structured user input (skin type, primary concerns, age range, climate, and budget) through an interactive quiz and an optional live camera scan, and uses a Large Language Model (LLM) to generate a personalized skin report, a step-by-step routine, and product recommendations in real time. The system is implemented as a React/Vite front end communicating with a serverless backend that forwards requests to free-tier LLMs hosted on OpenRouter, with a Supabase-backed key-rotation layer to maintain availability under per-key rate limits. Supporting modules include an ingredient safety checker, a product comparison tool, a skin-progress tracker, a skin journal, an analytics dashboard, and a free-form AI chat assistant. The system is deployed on Vercel and demonstrates that a practical, responsive skincare recommendation experience can be built entirely on free-tier infrastructure.

**Keywords:** Artificial Intelligence, Large Language Models, Personalized Skincare, Recommender Systems, Serverless Architecture, React, Human-Computer Interaction.

---

## I. Introduction

Skincare product selection is typically driven by advertising, influencer recommendations, or informal trial and error, which frequently leads to products that are mismatched to a user's actual skin type or concerns, resulting in irritation, wasted spending, or worsened skin conditions. While dermatologist consultation is the most reliable solution, it is not always accessible, affordable, or convenient for routine guidance.

Lumière AI addresses this gap by combining a short structured questionnaire with an LLM-driven recommendation engine, producing a personalized skin report, a daily routine, and curated product suggestions within seconds. The system additionally allows users to scan their skin live via webcam, check whether a product's ingredient list contains items suited (or unsuited) to their skin, compare products side by side, and track how their skin changes over time through a journal and progress tracker.

---

## II. Literature Review

Traditional skincare recommendation tools generally fall into two categories: (1) static, rule-based quizzes that map a small set of predefined inputs to a fixed catalogue of product suggestions, and (2) e-commerce-style recommender systems built on collaborative or content-based filtering over historical purchase/review data. Both approaches struggle to generate explanatory, conversational guidance (e.g., *why* a routine is structured a certain way, or how an ingredient interacts with a stated concern) because they are not designed to reason over open-ended natural language.

The emergence of capable, low-cost/free-tier LLMs accessible through aggregator APIs such as OpenRouter has made it feasible for small or student-built projects to generate this kind of explanatory, personalized content without training a custom model or maintaining a large product dataset. Lumière AI builds on this shift, using an LLM as the core recommendation and explanation engine rather than a traditional filtering algorithm, while still relying on a small curated dataset (an ingredient safety dictionary) for facts that should not be left to model generation alone.

---

## III. Proposed System (Methodology)

The system follows this workflow:

1. **Input collection** — The user completes a guided quiz capturing:
   - Skin type (dry, oily, combination, sensitive, normal)
   - Skin concerns (acne, aging, hyperpigmentation, dullness, redness, large pores, dehydration, dark circles, uneven texture, sensitivity)
   - Age range
   - Climate (humid, dry, temperate, cold, polluted)
   - Budget tier
   - *Optionally*, a live webcam capture for a visual skin scan

2. **AI analysis** — The collected profile (and image, if provided) is sent to an LLM in two phases to manage response size and latency:
   - Phase 1 generates the core report — a skin score, key metrics, and a routine.
   - Phase 2 generates product recommendations and ingredient pairings.

3. **Output generation** — The system renders:
   - A personalized skin report and score
   - A daily/weekly skincare routine
   - Product recommendations within the stated budget
   - Climate-specific skincare tips

4. **Supporting tools** — Independent of the main quiz flow, the user can:
   - Check whether ingredients in a product are safe, caution-worthy, or best avoided for their profile
   - Compare two or more products side by side
   - Log skin condition over time in a journal (with emoji-based ratings)
   - Track progress against the recommended routine
   - Chat freely with the AI assistant for follow-up skincare questions

---

## IV. System Architecture

```text
┌─────────────────────────┐
│   React + Vite SPA      │   Quiz / Camera Scan / Results / Ingredients /
│   (src/App.jsx)         │   Compare / Analytics / Tracker / Journal / Chat
└────────────┬─────────────┘
             │ POST /api/chat   (Anthropic-style message format)
             ▼
┌─────────────────────────┐
│   Backend proxy layer    │
│  • server.js (local dev) │
│  • api/chat.js (Vercel)  │
└────────────┬─────────────┘
             │ converts message format
             ▼
┌─────────────────────────┐        ┌──────────────────────────┐
│   Supabase "api_keys"    │◄──────►│   Key rotation logic     │
│   table (key store)      │        │  (api/chat.js only)      │
└────────────┬─────────────┘        └──────────────────────────┘
             │ active OpenRouter key
             ▼
┌─────────────────────────┐
│   OpenRouter API         │
│  Meta Llama 3.1 / 3.2 /  │
│  4 (free-tier models)    │
└────────────┬─────────────┘
             │ generated text / vision response
             ▼
     Rendered back into the
     relevant React page/component
```

The production deployment (Vercel) uses `api/chat.js`, which checks a Supabase table of OpenRouter API keys, automatically rotates to the next available key when one is rate-limited, and retries up to four times before failing gracefully. The local development setup (`server.js`) is a simpler Express proxy intended for quick iteration without requiring a Supabase project.

---

## V. Technologies Used

| Category | Technology |
|---|---|
| Frontend | React 18, Vite 5 (single-page application, no router library) |
| Local backend | Node.js, Express |
| Production backend | Vercel Serverless Functions |
| API key management | Supabase (PostgreSQL) |
| LLM provider | OpenRouter — Meta Llama 3.1 / 3.2 / 4 (free-tier models) |
| Styling | CSS-in-JS theme tokens (light/dark mode) |
| Deployment | Vercel |

---

## VI. Implementation

The front end is implemented as a single React component tree (`src/App.jsx`) with a lightweight, state-based router (no external routing library) that switches between pages: Hero, Quiz, Analyzing, Camera, Results, Ingredients, Compare, Analytics, Tracker, Journal, and Chat.

Key implementation details:

- **Token-conscious API layer** — All AI calls go through `fetchWithRetry`, which retries on HTTP 529 (model overload) with exponential backoff, hard-truncates prompts, and caps `max_tokens` per call type to stay within free-tier limits.
- **Two-phase analysis** — Splitting the AI report generation into a "core report" call followed by a "products + pairings" call reduces the chance of truncated or incomplete responses from free-tier models with smaller output budgets.
- **Resilient key rotation** — In production, `api/chat.js` queries Supabase for the least-recently-used active key, marks a key inactive (with a one-hour cooldown) if OpenRouter reports a quota/rate-limit error, and automatically retries with the next key.
- **Ingredient safety checker** — A curated dictionary (`KNOWN_INGREDIENTS`) classifies common skincare ingredients as *safe*, *caution*, or *avoid*, giving deterministic, trustworthy answers for well-known ingredients rather than relying solely on model output.
- **Live camera scan** — The browser's webcam feed is captured and sent as a base64-encoded image to a vision-capable model for analysis alongside the user's quiz profile.
- **Persistence** — User preferences such as dark mode are persisted to `localStorage`; the system does not currently use a database for user profiles or journal entries.

---

## VII. Results and Discussion

The implemented system successfully takes a short questionnaire (and optional photo) and returns a structured, personalized skin report, routine, and product list within a few seconds on free-tier models. The two-phase generation strategy noticeably reduces incomplete or truncated AI responses compared to a single large call. The Supabase-backed key rotation has proven effective at maintaining uptime despite the strict per-key rate limits of free OpenRouter models, since a single exhausted key no longer causes total service failure.

### Key Features Demonstrated
- Personalized, AI-generated skin report and routine
- Budget-aware product recommendations
- Live webcam-based skin scan
- Ingredient safety lookup
- Side-by-side product comparison
- Skin progress tracker and journal
- Conversational AI follow-up chat
- Resilient operation under free-tier API rate limits

---

## VIII. Limitations

- Not a substitute for professional dermatological consultation.
- Recommendation quality depends on the behavior of free-tier LLMs, which can vary in availability and output quality.
- The ingredient safety dictionary is manually curated and not exhaustive.
- No persistent backend database for user profiles, journal entries, or tracker history — current session data lives only in browser state/`localStorage`.
- Live camera scan accuracy is bounded by the underlying vision model rather than a dedicated, dermatology-trained image classifier.

---

## IX. Future Scope

- Persistent storage of user profiles, journal entries, and tracker history (e.g., extending the existing Supabase project beyond key storage).
- A dedicated, dermatology-trained image classification model for the camera scan, rather than a general-purpose vision LLM.
- Multi-language support (English, Hindi, Marathi).
- Optional integration with licensed dermatologists for escalation of flagged concerns.
- Native mobile application.
- Expanded and community-verified ingredient safety database.

---

## X. Conclusion

Lumière AI demonstrates that a practical, conversational skincare recommendation system can be built using a React front end, a thin serverless backend, and free-tier LLMs accessed through OpenRouter — without requiring a custom-trained model or paid infrastructure. By combining structured user input with LLM-generated explanations, and pairing it with supporting tools such as an ingredient checker, tracker, and journal, the system offers a more personalized and transparent alternative to generic skincare advice, while the Supabase-based key rotation layer shows a practical pattern for keeping such free-tier-dependent systems reliably available.

---

## References

[1] React Documentation. Available: https://react.dev/

[2] Vite Documentation. Available: https://vitejs.dev/

[3] Express.js Documentation. Available: https://expressjs.com/

[4] OpenRouter API Documentation. Available: https://openrouter.ai/docs

[5] Supabase Documentation. Available: https://supabase.com/docs

[6] Vercel Serverless Functions Documentation. Available: https://vercel.com/docs/functions

[7] American Academy of Dermatology (AAD). Available: https://www.aad.org/

[8] Mayo Clinic — Skin Care Basics. Available: https://www.mayoclinic.org/

[9] Lumière AI (Live Demo). Available: https://ai-skincare-recommendation-system.vercel.app/

---

### ⭐ Support

If you found this project helpful, please consider giving it a **Star ⭐** on GitHub.
