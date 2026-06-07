import { useRef } from 'react';

export default function Header({ language, onLanguageChange, headerImage, onHeaderImageChange, exportButton }) {
  const fileRef = useRef();

  return (
    <header className="header">
      <div className="header-left">
        <div
          className="header-sigil"
          title="Kliknij aby zmienić obrazek"
          style={{ cursor: 'pointer' }}
          onClick={() => fileRef.current?.click()}
        >
          {headerImage
            ? <img src={headerImage} alt="UANNA sigil" />
            : <span className="header-sigil-placeholder">𒀭</span>
          }
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={e => {
              const f = e.target.files?.[0];
              if (!f) return;
              const reader = new FileReader();
              reader.onload = ev => onHeaderImageChange(ev.target.result);
              reader.readAsDataURL(f);
            }}
          />
        </div>

        <div className="header-titles">
          <span className="cuneiform">𒌋𒀭𒈾 · 𒄑𒂅𒀭</span>
          <h1>UANNA – ten który pochodzi z Nieba</h1>
          <p>Nauczyciel języka z Twoich ulubionych tekstów &nbsp;·&nbsp; Autor: Albert Jerka</p>
        </div>
      </div>

      <div className="header-right">
        {exportButton}
        <div className="lang-switch">
          <button
            className={language === 'ru' ? 'active' : ''}
            onClick={() => onLanguageChange('ru')}
          >
            RU
          </button>
          <button
            className={language === 'en' ? 'active' : ''}
            onClick={() => onLanguageChange('en')}
          >
            EN
          </button>
        </div>
      </div>
    </header>
  );
}
