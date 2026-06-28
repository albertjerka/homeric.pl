import { useRef } from 'react';

export default function Header({ language, onLanguageChange, headerImage, onHeaderImageChange, exportButton, onBackToDashboard }) {
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
            ? <img src={headerImage} alt="Homeric" />
            : <img src="/homeric.png" alt="Homeric" style={{ opacity: 0.85 }} />
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
          <h1>
            <span className="logo-greek">Η</span>
            Homeric
          </h1>
          <p>Platforma nauki przez literaturę &nbsp;·&nbsp; Albert Jerka</p>
        </div>
      </div>

      <div className="header-right">
        {onBackToDashboard && (
          <button className="btn-ghost-sm" onClick={onBackToDashboard} style={{ marginRight: '8px' }}>← Menu</button>
        )}
        {exportButton}
        <div className="lang-switch">
          <button className={language === 'ru' ? 'active' : ''} onClick={() => onLanguageChange('ru')}>RU</button>
          <button className={language === 'uk' ? 'active' : ''} onClick={() => onLanguageChange('uk')}>UA</button>
          <button className={language === 'en' ? 'active' : ''} onClick={() => onLanguageChange('en')}>EN</button>
        </div>
      </div>
    </header>
  );
}
