import WordOfTheDay from './WordOfTheDay.jsx';

export default function Dashboard({ onSelect }) {
  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <div className="dashboard-logo">
          <img src="/homeric.png" alt="Homeric" className="dashboard-sigil" />
          <div>
            <h1><span className="logo-greek">Η</span> Homeric</h1>
            <p>Platforma nauki przez literaturę</p>
          </div>
        </div>
      </div>

      <div className="dashboard-tiles dashboard-tiles-2">
        <div className="dashboard-tile" onClick={() => onSelect('library')}>
          <div className="tile-icon">📚</div>
          <h2>Moja Biblioteka</h2>
          <p>Twoje książki PDF do czytania i tłumaczenia oraz pisane przez ciebie powieści i rozdziały.</p>
          <button className="tile-btn">Otwórz bibliotekę</button>
        </div>

        <div className="dashboard-tile" onClick={() => onSelect('writer')}>
          <div className="tile-icon">✒</div>
          <h2>Pisarz</h2>
          <p>Twórz własną powieść, sceny, rozdziały i styl — z pomocą Homer AI oraz Słownika Lindego.</p>
          <button className="tile-btn">Rozpocznij pisanie</button>
        </div>
      </div>

      {/* Słowo dnia */}
      <div className="dashboard-wotd-section">
        <div className="dashboard-wotd-intro">
          <div className="dashboard-wotd-intro-title">Ucz się słów przy pisaniu</div>
          <div className="dashboard-wotd-intro-text">
            Homeric wydobywa z dawnych słowników słowa, które mogą wzbogacić Twój styl.
          </div>
        </div>
        <WordOfTheDay onUseInWriter={() => onSelect('writer')} />
      </div>
    </div>
  );
}
