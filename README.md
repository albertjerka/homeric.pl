# UANNA – Nauczyciel języka z Twoich ulubionych tekstów

**𒌋𒀭𒈾 · ten który pochodzi z Nieba**

Aplikacja webowa do nauki języków obcych (rosyjski, angielski) z tekstów literackich w formacie PDF.
Autor: **Albert Jerka**

---

## Co robi UANNA

- Wczytuje PDF (do 1000 stron) i tłumaczy każdą stronę przez **Claude AI**
- **4 widoki** na każdą stronę: tłumaczenie PL, oryginał interaktywny, zdanie po zdaniu, słowniczek
- **Żółte słowa** kluczowe z tooltipem tłumaczenia i syntezą mowy (głos Yuri/Milena)
- **Prompt do obrazka AI** – filmowy, ultrarealistyczny opis sceny z każdej strony
- **Batch tłumaczenie** – wgraj zakres stron, UANNA tłumaczy wszystko automatycznie
- **Eksport PDF** z przetłumaczonych stron (jsPDF)
- **Biblioteka** z zapisem pozycji czytania
- **Zapis na dysk** – PDF, cache tłumaczeń i obrazki w wybranym folderze

---

## Wymagania

- **Node.js** v18 lub nowszy → [nodejs.org](https://nodejs.org)
- **Chrome** lub Edge (Firefox nie obsługuje File System Access API)
- Klucz API Anthropic → [console.anthropic.com](https://console.anthropic.com)

---

## Instalacja

### 1. Pobierz projekt

```bash
git clone https://github.com/albertjerka/uanna.git
cd uanna
```

### 2. Zainstaluj zależności

```bash
npm install
```

### 3. Skonfiguruj klucz API

Skopiuj plik przykładowy i wpisz swój klucz:

```bash
cp .env.example .env
```

Otwórz `.env` i wklej klucz:

```
VITE_ANTHROPIC_API_KEY=sk-ant-...
```

Klucz znajdziesz na: [console.anthropic.com/settings/keys](https://console.anthropic.com/settings/keys)

### 4. Uruchom aplikację

```bash
npm run dev
```

Otwórz przeglądarkę: **http://localhost:3001**

---

## Pierwsze uruchomienie

1. Kliknij **💾 Ustaw folder** i wybierz folder na dysku (np. `Dokumenty/UANNA/ksiazki`) – tu będą zapisywane pliki
2. Wgraj plik PDF (przeciągnij lub kliknij)
3. Wpisz tytuł, wybierz język (RU/EN), ustaw od której do której strony
4. Kliknij **Zacznij czytanie** – UANNA automatycznie tłumaczy cały zakres
5. Po zakończeniu kliknij **↓ Pobierz PDF**

---

## Synteza mowy (opcjonalnie)

Żeby uzyskać lepszy głos rosyjski (Yuri):

**Ustawienia systemowe → Dostępność → Wymawiana zawartość → Zarządzaj głosami → Russian → Yuri**

---

## Licencja

Copyright © 2026 Albert Jerka. Wszelkie prawa zastrzeżone.  
Oprogramowanie własnościowe – niedozwolone kopiowanie ani dystrybucja bez zgody autora.
