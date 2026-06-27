import Anthropic from '@anthropic-ai/sdk';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = 3002;

app.use(cors({ origin: ['http://localhost:3001'] }));
app.use(express.json({ limit: '10mb' }));

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

app.post('/api/analyze-page', async (req, res) => {
  const { text, language, pageNumber } = req.body;
  if (!text || !text.trim()) return res.status(400).json({ error: 'Brak tekstu' });

  const langName = language === 'ru' ? 'rosyjskim' : language === 'uk' ? 'ukraińskim' : 'angielskim';

  const userPrompt = `Przeanalizuj następujący tekst literacki (strona ${pageNumber}) w języku ${langName}.
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
  }
}

Zasady:
- vocabulary: wybierz 8-12 najważniejszych słów do nauki
- key_words w sentences: pogrub słowa kluczowe z vocabulary
- notes w context: wyjaśnij nazwy bogów, miejsc, archaizmy, trudne wyrazy
- tłumaczenie polish_translation ma być eleganckie, literackie

TEKST:
${text}`;

  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      system: 'Jesteś ekspertem w nauczaniu języków obcych dla polskich uczniów. Analizujesz strony literackie i tworzysz materiały edukacyjne. Odpowiadasz wyłącznie w formacie JSON.',
      messages: [{ role: 'user', content: userPrompt }]
    });

    const raw = message.content[0].text;
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('Nieprawidłowa odpowiedź JSON od Claude');

    res.json(JSON.parse(jsonMatch[0]));
  } catch (err) {
    console.error('Błąd Claude API:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/count-words', (req, res) => {
  const { texts, language } = req.body;
  if (!texts || !texts.length) return res.json({ count: 0 });

  const joined = texts.join(' ').toLowerCase();
  const wordPattern = language === 'ru'
    ? /[а-яёa-z'-]{2,}/g
    : language === 'uk'
    ? /[а-яіїєґa-z'-]{2,}/g
    : /[a-z'-]{2,}/g;

  const words = joined.match(wordPattern) || [];
  const unique = new Set(words);
  res.json({ count: unique.size });
});

app.listen(PORT, () => {
  console.log(`UANNA backend działa na porcie ${PORT}`);
});
