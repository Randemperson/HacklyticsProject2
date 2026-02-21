import { useState, useEffect } from 'react';
import Papa from 'papaparse';
import Globe from './components/Globe';
import Controls from './components/Controls';
import Legend from './components/Legend';
import './App.css';

const DEFAULT_CSV = '/world_problems.csv';
const DEFAULT_CATEGORY = 'conflict';

export default function App() {
  const [data, setData] = useState([]);
  const [category, setCategory] = useState(DEFAULT_CATEGORY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Load the default CSV on mount
  useEffect(() => {
    fetch(DEFAULT_CSV)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load default dataset');
        return res.text();
      })
      .then((csv) => {
        const result = Papa.parse(csv, { header: true, skipEmptyLines: true });
        setData(result.data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  function handleDataLoad(newData) {
    setData(newData);
  }

  if (error) {
    return (
      <div className="error-screen">
        <p>⚠️ {error}</p>
      </div>
    );
  }

  return (
    <div className="app-layout">
      <Controls
        category={category}
        onCategoryChange={setCategory}
        onDataLoad={handleDataLoad}
        rowCount={data.length}
      />
      <main className="globe-container">
        {loading ? (
          <div className="loading-screen">
            <div className="spinner" />
            <p>Loading globe data…</p>
          </div>
        ) : (
          <Globe data={data} category={category} />
        )}
      </main>
      <Legend category={category} />
    </div>
  );
}
