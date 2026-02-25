# Manager Effectiveness Scoring

This project is an AI-powered Manager Effectiveness Scoring system.

## Project info

A MERN stack application featuring:
- AI-driven manager effectiveness scoring
- Sentiment analysis on employee feedback
- Personalized coaching suggestions for managers
- Secure authentication for Managers and Employees
- Role-based dashboard experiences

## Tech Stack

- **Frontend**: Vite, React, TypeScript, Tailwind CSS, shadcn/ui, Framer Motion
- **Backend**: Node.js, Express, MongoDB, Mongoose
- **AI Integration**: OpenRouter (DeepSeek, Gemini, Llama)

## Getting Started

### Prerequisites

- Node.js & npm
- MongoDB Atlas URI
- OpenRouter API Key

### Installation

1. Clone the repository.
```sh
git clone <repository-url>
```

2. Setup Backend:
```sh
cd server
npm install
cp .env.example .env # Add your MONGO_URI and OPENROUTER_API_KEY
node seed_scenarios.js # Seed the database with Darwinbox demo data
npm start
```

3. Setup Frontend:
```sh
cd client
npm install
npm run dev
```

### Demo Credentials

| Role | Email | Password |
| :--- | :--- | :--- |
| **Manager** | `jordan.lee@company.com` | `password123` |
| **Employee** | `sam.wilson@company.com` | `password123` |

---
© 2026 Manager Effectiveness Analytics
