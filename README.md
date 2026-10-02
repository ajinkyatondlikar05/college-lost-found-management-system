# College Lost & Found Management System

A full-stack web application to help college students report, search, and recover lost items on campus.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React + Vite |
| Backend | Node.js + Express |
| Database | MongoDB + Mongoose |
| Auth | JWT + bcrypt |
| File Upload | Multer |

## Features

- 🔐 User registration & login with JWT
- 📢 Report lost or found items with image upload
- 🔍 Search & filter items by type, category, status
- 📋 User dashboard with personal report stats
- 🛡️ Admin dashboard — manage users & items
- 🔄 Status tracking: Active → Resolved / Claimed
- 📱 Fully responsive dark-themed UI

## Project Structure

```
.
├── backend/
│   ├── models/
│   │   ├── User.js
│   │   └── Item.js
│   ├── routes/
│   │   ├── auth.js
│   │   ├── items.js
│   │   └── users.js
│   ├── middleware/
│   │   ├── auth.js
│   │   └── upload.js
│   ├── uploads/          # auto-created on first upload
│   ├── server.js
│   ├── .env
│   └── package.json
│
└── frontend/
    ├── src/
    │   ├── components/   # Navbar, Footer, ItemCard, PrivateRoute
    │   ├── context/      # AuthContext
    │   ├── pages/        # All 10 pages
    │   ├── api.js        # Axios API client
    │   ├── App.jsx
    │   └── main.jsx
    ├── .env
    └── package.json
```

## Setup Instructions

### Prerequisites

- **Node.js** v18+ (v25 recommended)
- **MongoDB** running locally OR a [MongoDB Atlas](https://cloud.mongodb.com) cluster

### 1. Clone / Download

```bash
cd "COLLEGE LOST & FOUND MANAGEMENT SYSTEM"
```

### 2. Backend Setup

```bash
cd backend
npm install
```

Edit `backend/.env`:

```env
MONGO_URI=mongodb://localhost:27017/college_lost_found
JWT_SECRET=your_super_secret_jwt_key_change_in_production
PORT=5000
```

Start the backend:

```bash
npm run dev
```

> The API will be available at **http://localhost:5000**

### 3. Frontend Setup

```bash
cd ../frontend
npm install
npm run dev
```

> The app will be available at **http://localhost:3000**

### 4. Create an Admin Account

1. Register a normal account via the UI
2. Connect to MongoDB and update the user's role:

```javascript
// In MongoDB shell or Compass
db.users.updateOne(
  { email: "your@email.com" },
  { $set: { role: "admin" } }
)
```

3. Log in again — the Admin Dashboard link will appear.

## API Endpoints

### Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register user |
| POST | `/api/auth/login` | Login & get token |
| GET | `/api/auth/me` | Get current user |

### Items
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/items` | Get all items (filters: type, category, status, search, page) |
| GET | `/api/items/:id` | Get item by ID |
| POST | `/api/items` | Create item (private) |
| PUT | `/api/items/:id` | Update item (owner/admin) |
| DELETE | `/api/items/:id` | Delete item (owner/admin) |
| GET | `/api/items/user/my-reports` | Get user's own reports |

### Admin (Users)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/users` | Get all users (admin) |
| GET | `/api/users/stats` | Dashboard stats (admin) |
| PUT | `/api/users/:id/role` | Update user role (admin) |
| DELETE | `/api/users/:id` | Delete user (admin) |

## Item Categories

Electronics · Books & Notes · Clothing · Accessories · ID & Cards · Keys · Bags · Sports Equipment · Stationery · Other

## Item Status

- **Active** — Still looking / Not yet claimed
- **Resolved** — Item has been returned
- **Claimed** — Item has been picked up
