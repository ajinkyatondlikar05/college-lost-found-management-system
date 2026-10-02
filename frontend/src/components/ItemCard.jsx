import { Link } from 'react-router-dom';
import { FiMapPin, FiCalendar, FiUser } from 'react-icons/fi';
import './ItemCard.css';

const categoryIcons = {
  Electronics: '💻',
  'Books & Notes': '📚',
  Clothing: '👕',
  Accessories: '⌚',
  'ID & Cards': '🪪',
  Keys: '🔑',
  Bags: '🎒',
  'Sports Equipment': '⚽',
  Stationery: '✏️',
  Other: '📦',
};

export default function ItemCard({ item }) {
  const isLost = item.type === 'lost';
  const icon = categoryIcons[item.category] || '📦';

  return (
    <Link to={`/items/${item._id}`} className="item-card">
      <div className="item-card-image">
        {item.image ? (
          <img src={item.image} alt={item.title} />
        ) : (
          <div className="item-card-placeholder">
            <span>{icon}</span>
          </div>
        )}
        <span className={`item-type-badge ${isLost ? 'lost' : 'found'}`}>
          {isLost ? '🔴 Lost' : '🟢 Found'}
        </span>
        <span className={`item-status-chip status-${item.status}`}>{item.status}</span>
      </div>

      <div className="item-card-body">
        <div className="item-category">{icon} {item.category}</div>
        <h3 className="item-title">{item.title}</h3>
        <p className="item-desc">{item.description}</p>

        <div className="item-meta">
          <span className="item-meta-row">
            <FiMapPin /> {item.location}
          </span>
          <span className="item-meta-row">
            <FiCalendar /> {new Date(item.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
          </span>
          {item.reportedBy && (
            <span className="item-meta-row">
              <FiUser /> {item.reportedBy.name || 'Anonymous'}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
