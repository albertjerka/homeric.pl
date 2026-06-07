export default function WordStats({ count, loading }) {
  return (
    <div className="word-stats">
      <span className="word-stats-icon">𒀭</span>
      {loading
        ? <span className="word-stats-text">Liczę unikalne słowa...</span>
        : count != null && (
          <span className="word-stats-text">
            Dzieło zawiera{' '}
            <span className="word-stats-count">
              {count.toLocaleString('pl-PL')}
            </span>
            {' '}unikalnych słów
          </span>
        )
      }
    </div>
  );
}
