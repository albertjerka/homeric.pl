#!/usr/bin/env python3
"""
Parser Słownika Lindego — wszystkie tomy.
Użycie:
  python3 linde_import.py <tom_nr> <plik_txt> | psql -d <db> -U <user>
"""

import re
import sys

if len(sys.argv) < 3:
    sys.stderr.write("Użycie: linde_import.py <nr_tomu> <ścieżka_do_pliku>\n")
    sys.exit(1)

VOLUME = sys.argv[1]
FILE_PATH = sys.argv[2]
TITLE = f'Słownik języka polskiego — Samuel Bogumił Linde, Tom {VOLUME} (wyd. 2)'

# Znaki polskie wielkie
POLISH_UPPER = set('ĄĆĘŁŃÓŚŹŻ')

# Wzorzec dla linii zaczynającej się od hasła ALL-CAPS
# np. "GABAC,", "GĄGA,", "MACAĆ,", "ABECADŁO,"
HEADWORD_LINE_RE = re.compile(
    r'^([A-ZĄĆĘŁŃÓŚŹŻ][A-ZĄĆĘŁŃÓŚŹŻ\-ŚŹŻ]{1,}(?:\s+[A-ZĄĆĘŁŃÓŚŹŻ\-]{2,}){0,3})'
    r'[\s,\.\(\[]'
)

# Wzorzec gramatyczny — wzmacnia pewność że to hasło (nie nagłówek strony)
GRAM_RE = re.compile(
    r'[\s,\.]\s*(?:a,?\s*[emzn]\.?|ał,|[iu],\s*[mzżńs]\.?|niedok|dok\.|Vind\.|Boh\.|Ross\.|Lat\.|cz\.|m\.|ż\.|n\.|adj\.)',
    re.IGNORECASE
)

def is_all_caps_word(word):
    for c in word:
        if c.isalpha() and not (c.isupper() or c in POLISH_UPPER):
            return False
    return True

def is_headword_line(line):
    stripped = line.lstrip()
    if len(stripped) < 3:
        return False
    m = HEADWORD_LINE_RE.match(stripped)
    if not m:
        return False
    word = m.group(1)
    if len(word) < 2 or len(word) > 80:
        return False
    return is_all_caps_word(word.replace('-','').replace(' ',''))

def extract_headword(line):
    m = HEADWORD_LINE_RE.match(line.lstrip())
    if not m:
        return None
    hw = m.group(1).strip()
    # Weź pierwsze słowo jeśli wiele
    parts = re.split(r'\s{2,}|,\s+(?=[A-ZĄĆĘŁŃÓŚŹŻ]{3,})', hw)
    hw = parts[0].strip().rstrip(',.-')
    return hw if len(hw) >= 2 else None

def normalize(text):
    text = text.lower().strip()
    for src, dst in [('ą','a'),('ć','c'),('ę','e'),('ł','l'),('ń','n'),
                     ('ó','o'),('ś','s'),('ź','z'),('ż','z')]:
        text = text.replace(src, dst)
    return text

def clean_text(text):
    text = re.sub(r'  +', ' ', text)
    return text.strip()

def escape_sql(s):
    if s is None:
        return 'NULL'
    s = s.replace("'", "''")
    s = s.replace("\\", "\\\\")
    return "'" + s + "'"

def find_skip_lines(filepath):
    """
    Auto-detekcja początku słownika: szukamy pierwszej linii z hasłem ALL-CAPS
    która ma po sobie linię z treścią (definicją po polsku lub info gramatycznym).
    Tom I ma długi wstęp (~9340 linii), Tom II-VI — krótki (~100 linii).
    """
    with open(filepath, 'r', encoding='utf-8', errors='replace') as f:
        lines = []
        for i, line in enumerate(f):
            lines.append(line.rstrip('\n'))
            if i > 15000:
                break

    # Szukaj pierwszej pary: linia headword + następna linia z treścią
    for i, line in enumerate(lines):
        if is_headword_line(line):
            hw = extract_headword(line)
            if hw and len(hw) >= 3:
                # Upewnij się że to nie nagłówek strony
                context = ' '.join(lines[i:i+3])
                # Jeśli po haśle jest jakaś treść (nie tylko kolejne hasło)
                next_lines = [l.strip() for l in lines[i+1:i+4] if l.strip()]
                if next_lines and len(next_lines[0]) > 10:
                    return max(0, i - 1)
    return 0

def parse_entries(filepath, skip_lines):
    entries = []
    current_hw = None
    current_lines = []

    with open(filepath, 'r', encoding='utf-8', errors='replace') as f:
        for lineno, raw_line in enumerate(f):
            if lineno < skip_lines:
                continue

            line = raw_line.rstrip('\n').rstrip('\r')

            if is_headword_line(line):
                # Zapisz poprzednie hasło
                if current_hw and len(current_lines) > 0:
                    body = clean_text(' '.join(current_lines))
                    if len(body) > 5:
                        raw = '\n'.join(current_lines)
                        entries.append((current_hw, normalize(current_hw), body, raw))

                hw = extract_headword(line)
                if hw and 2 <= len(hw) <= 80:
                    current_hw = hw
                    current_lines = [line.strip()]
                else:
                    current_hw = None
                    current_lines = []
            elif current_hw and line.strip():
                current_lines.append(line.strip())

    # Ostatnie hasło
    if current_hw and current_lines:
        body = clean_text(' '.join(current_lines))
        if len(body) > 5:
            raw = '\n'.join(current_lines)
            entries.append((current_hw, normalize(current_hw), body, raw))

    return entries

def main():
    skip = find_skip_lines(FILE_PATH)
    sys.stderr.write(f"Tom {VOLUME}: pomijam {skip} linii wstępu.\n")

    entries = parse_entries(FILE_PATH, skip)
    sys.stderr.write(f"Tom {VOLUME}: sparsowano {len(entries)} haseł.\n")

    print("BEGIN;")
    print()

    # Wstaw źródło (jeśli nie istnieje)
    print(f"INSERT INTO linde_sources (title, volume, local_path, format, imported_at)")
    print(f"  VALUES ({escape_sql(TITLE)}, {escape_sql(VOLUME)}, "
          f"{escape_sql(FILE_PATH)}, 'djvu_ocr_txt', NOW())"
          f"  ON CONFLICT DO NOTHING;")
    print()
    print(f"DO $LINDE$ DECLARE v_src INTEGER; BEGIN")
    print(f"  SELECT id INTO v_src FROM linde_sources"
          f" WHERE title = {escape_sql(TITLE)} AND volume = {escape_sql(VOLUME)};")
    print(f"  DELETE FROM linde_entries WHERE source_id = v_src;")
    print()

    for hw, norm_hw, body, raw in entries:
        if not hw or not norm_hw:
            continue
        print(
            f"  INSERT INTO linde_entries"
            f" (source_id, headword, normalized_headword, body, volume, raw_text)"
            f" VALUES (v_src, {escape_sql(hw)}, {escape_sql(norm_hw)},"
            f" {escape_sql(body[:4000])}, {escape_sql(VOLUME)},"
            f" {escape_sql(raw[:2000])});"
        )

    print()
    print("END $LINDE$;")
    print()
    print("COMMIT;")
    sys.stderr.write(f"Tom {VOLUME}: SQL wygenerowany.\n")

if __name__ == '__main__':
    main()
