import Papa from 'papaparse';

const CATEGORIES = [
  { key: 'conflict', label: '⚔️ Conflict', color: '#e74c3c' },
  { key: 'climate', label: '🌡️ Climate', color: '#f39c12' },
  { key: 'food_insecurity', label: '🌾 Food', color: '#e67e22' },
  { key: 'poverty', label: '💰 Poverty', color: '#9b59b6' },
  { key: 'disease', label: '🦠 Disease', color: '#27ae60' },
];

export default function Controls({ category, onCategoryChange, onDataLoad, rowCount }) {
  function handleFileUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        onDataLoad(results.data);
      },
    });
    // Reset input so same file can be re-uploaded
    e.target.value = '';
  }

  return (
    <aside className="controls-panel">
      <h1 className="app-title">🌍 World Crisis Globe</h1>
      <p className="app-subtitle">
        Interactive heatmap of global challenges
      </p>

      <section className="control-section">
        <h2 className="section-title">Select Category</h2>
        <div className="category-buttons">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.key}
              className={`category-btn ${category === cat.key ? 'active' : ''}`}
              style={{ '--cat-color': cat.color }}
              onClick={() => onCategoryChange(cat.key)}
              aria-pressed={category === cat.key}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </section>

      <section className="control-section">
        <h2 className="section-title">Load Custom CSV</h2>
        <p className="hint-text">
          Upload a CSV with columns: <code>country, lat, lng, category, value, description</code>
        </p>
        <label className="upload-btn" htmlFor="csv-upload">
          📂 Choose CSV File
        </label>
        <input
          id="csv-upload"
          type="file"
          accept=".csv"
          onChange={handleFileUpload}
          style={{ display: 'none' }}
        />
      </section>

      <section className="control-section stats-section">
        <h2 className="section-title">Dataset Info</h2>
        <p className="stats-text">
          <span className="stat-number">{rowCount}</span> data points loaded
        </p>
        <p className="hint-text">
          Hover over hotspots on the globe to see details. Drag to rotate, scroll to zoom.
        </p>
      </section>
    </aside>
  );
}
