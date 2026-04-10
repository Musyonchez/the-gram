# The Gram

An African-focused social media platform for discovering and sharing art, fashion, and culture. Built with Django REST Framework and React.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, Vite, TailwindCSS v4, React Router v7 |
| Backend | Django 4.2, Django REST Framework |
| Auth | JWT (djangorestframework-simplejwt) |
| Payments | M-Pesa Daraja API (STK Push) |
| Database | SQLite (development) |

---

## Project Structure

```
the-gram/
├── client/          # React frontend
│   └── src/
│       ├── components/
│       ├── pages/
│       └── services/
└── server/          # Django backend
    ├── oauth/       # Auth & user management
    ├── posts/       # Posts, likes, comments, collections
    ├── payments/    # M-Pesa donations
    └── the_gram/    # Django settings & URLs
```

---

## Prerequisites

- Python 3.10+
- Node.js 18+
- npm 9+

---

## Setup After Cloning

### 1. Clone the repo

```bash
git clone https://github.com/Musyonchez/the-gram.git
cd the-gram
```

### 2. Backend setup

```bash
cd server
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```

The API will be available at `http://localhost:8000`.

> **Optional:** create a superuser to access the Django admin panel at `/admin/`
> ```bash
> python manage.py createsuperuser
> ```

### 3. Frontend setup

Open a new terminal:

```bash
cd client
npm install
npm run dev
```

The app will be available at `http://localhost:5173`.

---

## Environment Variables

The backend reads M-Pesa credentials from `server/the_gram/settings.py`. For local development the defaults work out of the box, but for real M-Pesa integration set these in a `.env` file (never commit it):

```
MPESA_CONSUMER_KEY=your_consumer_key
MPESA_CONSUMER_SECRET=your_consumer_secret
MPESA_SHORTCODE=your_shortcode
MPESA_PASSKEY=your_passkey
MPESA_CALLBACK_URL=https://yourdomain.com/api/payments/mpesa/callback/
```

---

## Running the App

Both servers must run at the same time. Use two separate terminals:

**Terminal 1 — Backend:**
```bash
cd server
python manage.py runserver
```

**Terminal 2 — Frontend:**
```bash
cd client
npm run dev
```

| Service | URL |
|---------|-----|
| Frontend | http://localhost:5173 |
| Backend API | http://localhost:8000/api |
| Django Admin | http://localhost:8000/admin |

---

## Key Features

- **Auth** — Register/login via email, username, or phone number. JWT tokens, age gate (13+), Africa-only registration.
- **Posts** — Images, videos, reels, carousels. Visibility controls (public / followers / private).
- **Engagement** — Likes, nested comments, saves, collections, follow/unfollow, user suggestions.
- **Donations** — Tip creators via M-Pesa STK Push with real-time status polling.
- **Reporting** — Report posts and comments with categorized reasons.

---

## API Reference

See [server/Readme.md](server/Readme.md) for full endpoint documentation.

---

## Development Scripts

### Frontend

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server |
| `npm run build` | Production build |
| `npm run lint` | Run ESLint |
| `npm run preview` | Preview production build |

### Backend

| Command | Description |
|---------|-------------|
| `python manage.py runserver` | Start dev server |
| `python manage.py migrate` | Apply migrations |
| `python manage.py makemigrations` | Create new migrations |
| `python manage.py createsuperuser` | Create admin user |
| `python -m flake8 . --max-line-length=120 --exclude=migrations,__pycache__` | Run linter |

---

## Contributing

1. Fork the repo
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Commit your changes
4. Push and open a pull request against `main`
