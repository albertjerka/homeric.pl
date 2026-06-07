import Anthropic from '@anthropic-ai/sdk';
import { jsonrepair } from 'jsonrepair';

const client = new Anthropic({
  apiKey: import.meta.env.VITE_ANTHROPIC_API_KEY,
  dangerouslyAllowBrowser: true,
});

export async function analyzePage(text, language, pageNumber) {
  const langName = language === 'ru' ? 'rosyjskim' : 'angielskim';

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 8192,
    system: 'Jesteś ekspertem w nauczaniu języków obcych dla polskich uczniów. Analizujesz strony literackie i tworzysz materiały edukacyjne. Odpowiadasz wyłącznie w formacie JSON.',
    messages: [{
      role: 'user',
      content: `Przeanalizuj następujący tekst literacki (strona ${pageNumber}) w języku ${langName}.
Odpowiedz WYŁĄCZNIE w formacie JSON (bez żadnego tekstu przed ani po JSON):

{
  "polish_translation": "pełne, literackie tłumaczenie całego tekstu na język polski",
  "sentences": [
    {
      "original": "zdanie w oryginale",
      "key_words": ["słowo1", "słowo2"],
      "polish": "tłumaczenie zdania"
    }
  ],
  "vocabulary": [
    {
      "word": "słowo w oryginale",
      "translation": "tłumaczenie",
      "note": "krótka nota gramatyczna lub kulturowa"
    }
  ],
  "context": {
    "summary": "2-3 zdania co się dzieje na tej stronie fabularnie",
    "notes": ["wyjaśnienie odniesienia kulturowego lub archaizmu"]
  },
  "word_translations": {
    "słowo_w_oryginale": "polskie_tłumaczenie"
  },
  "image_prompt": "ultra-realistic cinematic photography prompt in English"
}

Zasady:
- vocabulary: wybierz 8-12 NAJWAŻNIEJSZYCH słów do nauki (te które uczeń powinien zapamiętać)
- key_words w sentences: oznacz słowa kluczowe z vocabulary
- notes w context: wyjaśnij nazwy bogów, miejsc, archaizmy, trudne wyrazy
- polish_translation ma być eleganckie i literackie
- word_translations: słownik WSZYSTKICH znaczących słów z tej strony (40-80 słów). Dla każdego słowa podaj jego podstawową formę (mianownik/bezokolicznik) i polskie tłumaczenie. Pomiń tylko oczywiste przyimki i spójniki (и, в, на, с, но, а, то, же). Uwzględnij czasowniki, rzeczowniki, przymiotniki, przysłówki, imiona własne.
- image_prompt: opisz po ANGIELSKU najbardziej dramatyczną scenę z tej strony, ultra-realistycznie, filmowo. Styl: "cinematic photography, shot on 35mm film, shallow depth of field, dramatic natural lighting, dust particles in the air, photorealistic textures, hyper-detailed faces, ancient Mesopotamian historical setting". 80-100 słów.

TEKST:
${text}`
    }]
  });

  const raw = message.content[0].text;
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('Brak JSON w odpowiedzi Claude');
  try {
    return JSON.parse(jsonMatch[0]);
  } catch {
    // Obcięty lub uszkodzony JSON – próba naprawy
    return JSON.parse(jsonrepair(jsonMatch[0]));
  }
}

export async function generateImagePrompt(text, language, pageNumber) {
  const langName = language === 'ru' ? 'rosyjskim' : 'angielskim';
  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 300,
    system: 'You write ultra-realistic cinematic photography prompts in English. Respond with the prompt text only — no JSON, no explanation.',
    messages: [{
      role: 'user',
      content: `Write a cinematic photography prompt (80-100 words) for the most dramatic scene from this ${langName} literary text (page ${pageNumber}). Style: shot on 35mm film, shallow depth of field, dramatic natural lighting, ancient historical setting, hyper-detailed faces and expressions, photorealistic textures, dust particles in air. Describe specific characters, their emotions, gestures, clothing.\n\nTEXT:\n${text.slice(0, 1200)}`
    }]
  });
  return message.content[0].text.trim();
}

export async function countWords(texts, language) {
  const joined = texts.join(' ').toLowerCase();
  const wordPattern = language === 'ru' ? /[а-яёa-z'-]{2,}/g : /[a-z'-]{2,}/g;
  const words = joined.match(wordPattern) || [];
  return { count: new Set(words).size };
}
