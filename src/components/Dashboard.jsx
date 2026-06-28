export default function Dashboard({ onSelect }) {
  const tiles = [
    {
      key: 'library',
      icon: '📚',
      title: 'Moja Biblioteka',
      desc: 'Twoje książki, PDF-y, tłumaczenia i słowniczki.',
      btn: 'Otwórz bibliotekę',
    },
    {
      key: 'reading',
      icon: '🏛',
      title: 'Czytaj w oryginale',
      desc: 'Tłumacz stronę po stronie, zdanie po zdaniu, ucz się języka z literatury.',
      btn: 'Zacznij czytać',
    },
    {
      key: 'writer',
      icon: '✒',
      title: 'Pisarz',
      desc: 'Twórz własną powieść, sceny, rozdziały i styl — z pomocą AI oraz Słownika Lindego.',
      btn: 'Rozpocznij pisanie',
    },
  ];

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

      <div className="dashboard-tiles">
        {tiles.map(t => (
          <div key={t.key} className="dashboard-tile" onClick={() => onSelect(t.key)}>
            <div className="tile-icon">{t.icon}</div>
            <h2>{t.title}</h2>
            <p>{t.desc}</p>
            <button className="tile-btn">{t.btn}</button>
          </div>
        ))}
      </div>
    </div>
  );
}
