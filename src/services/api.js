import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({
  apiKey: import.meta.env.VITE_ANTHROPIC_API_KEY,
  dangerouslyAllowBrowser: true,
});

export async function analyzePage(text, language, pageNumber) {
  const langName = language === 'ru' ? 'rosyjskim' : 'angielskim';

  const message = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
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
  "image_prompt": "ultra-realistic cinematic photography prompt in English"
}

Zasady:
- vocabulary: wybierz 8-12 najważniejszych słów do nauki
- key_words w sentences: oznacz słowa kluczowe z vocabulary
- notes w context: wyjaśnij nazwy bogów, miejsc, archaizmy, trudne wyrazy
- polish_translation ma być eleganckie i literackie
- image_prompt: opisz po ANGIELSKU najbardziej dramatyczną, wizualnie porażającą scenę z tej strony. Prompt musi być ultra-realistyczny i filmowy – jakby ktoś kręcił film i fotograf zrobił zdjęcie na planie. Opisz konkretnych ludzi z tej sceny: ich twarze, emocje, gesty, ubrania, fryzury. Styl obowiązkowo: "cinematic photography, shot on 35mm film, shallow depth of field, dramatic natural lighting, dust particles in the air, photorealistic textures, hyper-detailed faces and expressions, ancient Mesopotamian historical setting with accurate period details". Unikaj ogólników – pisz o konkretnych postaciach i konkretnym momencie akcji. Prompt powinien mieć 80-120 słów.

TEKST:
${text}`
    }]
  });

  const raw = message.content[0].text;
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('Nieprawidłowa odpowiedź od Claude');
  return JSON.parse(jsonMatch[0]);
}

export async function countWords(texts, language) {
  const joined = texts.join(' ').toLowerCase();
  const wordPattern = language === 'ru' ? /[а-яёa-z'-]{2,}/g : /[a-z'-]{2,}/g;
  const words = joined.match(wordPattern) || [];
  return { count: new Set(words).size };
}
