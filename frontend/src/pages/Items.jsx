import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getAllItems } from '../api';
import ItemCard from '../components/ItemCard';
import { FiSearch, FiFilter, FiX } from 'react-icons/fi';
import './Items.css';

const CATEGORIES = ['', 'Electronics', 'Books & Notes', 'Clothing', 'Accessories', 'ID & Cards', 'Keys', 'Bags', 'Sports Equipment', 'Stationery', 'Other'];

export default function Items() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);

  const search = searchParams.get('search') || '';
  const type = searchParams.get('type') || '';
  const category = searchParams.get('category') || '';
  const status = searchParams.get('status') || '';
  const page = parseInt(searchParams.get('page') || '1');

  const [searchInput, setSearchInput] = useState(search);

  useEffect(() => {
    setLoading(true);
    getAllItems({ search, type, category, status, page, limit: 12 })
      .then((res) => {
        setItems(res.data.items);
        setTotal(res.data.total);
        setPages(res.data.pages);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [search, type, category, status, page]);

  const updateFilter = (key, value) => {
    const params = new URLSearchParams(searchParams);
    if (value) params.set(key, value); else params.delete(key);
    params.delete('page');
    setSearchParams(params);
  };

  const handleSearch = (e) => {
    e.preventDefault();
    updateFilter('search', searchInput);
  };

  const clearAll = () => {
    setSearchInput('');
    setSearchParams({});
  };

  const hasFilters = search || type || category || status;

  return (
    <div className="page">
      <div className="container">
        {/* Page header */}
        <div className="items-page-header">
          <div>
            <h1>Browse <span className="gradient-text">All Items</span></h1>
            <p className="text-secondary">{total} item{total !== 1 ? 's' : ''} reported by the community</p>
          </div>
        </div>

        {/* Filters */}
        <div className="filters-bar">
          <form onSubmit={handleSearch} className="search-form">
            <div className="search-input-wrap">
              <FiSearch className="search-icon" />
              <input
                type="text"
                className="form-input search-input"
                placeholder="Search items, locations..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
              />
              {searchInput && (
                <button type="button" className="search-clear" onClick={() => { setSearchInput(''); updateFilter('search', ''); }}>
                  <FiX />
                </button>
              )}
            </div>
            <button type="submit" className="btn btn-primary">Search</button>
          </form>

          <div className="filter-chips">
            <div className="filter-group">
              <button onClick={() => updateFilter('type', '')} className={`chip ${!type ? 'chip-active' : ''}`}>All</button>
              <button onClick={() => updateFilter('type', 'lost')} className={`chip chip-lost ${type === 'lost' ? 'chip-active' : ''}`}>🔴 Lost</button>
              <button onClick={() => updateFilter('type', 'found')} className={`chip chip-found ${type === 'found' ? 'chip-active' : ''}`}>🟢 Found</button>
            </div>

            <select
              className="form-select filter-select"
              value={category}
              onChange={(e) => updateFilter('category', e.target.value)}
            >
              <option value="">All Categories</option>
              {CATEGORIES.filter(Boolean).map((c) => <option key={c} value={c}>{c}</option>)}
            </select>

            <select
              className="form-select filter-select"
              value={status}
              onChange={(e) => updateFilter('status', e.target.value)}
            >
              <option value="">All Status</option>
              <option value="active">Active</option>
              <option value="resolved">Resolved</option>
              <option value="claimed">Claimed</option>
            </select>

            {hasFilters && (
              <button className="btn btn-secondary btn-sm" onClick={clearAll}>
                <FiX /> Clear All
              </button>
            )}
          </div>
        </div>

        {/* Items Grid */}
        {loading ? (
          <div className="loading-page"><div className="spinner"></div><p>Loading items...</p></div>
        ) : items.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">🔍</div>
            <h3>No items found</h3>
            <p>Try adjusting your filters or search terms</p>
            <button className="btn btn-secondary mt-2" onClick={clearAll}>Clear Filters</button>
          </div>
        ) : (
          <>
            <div className="items-grid">
              {items.map((item) => <ItemCard key={item._id} item={item} />)}
            </div>

            {/* Pagination */}
            {pages > 1 && (
              <div className="pagination">
                <button
                  className="btn btn-secondary btn-sm"
                  disabled={page <= 1}
                  onClick={() => updateFilter('page', String(page - 1))}
                >
                  ← Previous
                </button>
                <span className="page-info">Page {page} of {pages}</span>
                <button
                  className="btn btn-secondary btn-sm"
                  disabled={page >= pages}
                  onClick={() => updateFilter('page', String(page + 1))}
                >
                  Next →
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
