# 🏥 NurseJobFinder

Find nursing jobs at top Bay Area hospitals — fast.

## Features

- **Target specific hospitals**: Kaiser, Sutter, UCSF, Stanford, Dignity
- **Filter by unit**: ICU, PCU/Stepdown, DOU, Telemetry, ER, Med-Surg
- **Job types**: Staff, Per Diem, Travel, Contract
- **Real-time search**: Powered by Brave Search API

## Quick Start

```bash
# Install dependencies
npm install

# Add your Brave API key
echo "BRAVE_API_KEY=your_key_here" > .env.local

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Deploy to Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/AIHeartICU/nurse-job-finder)

Set the `BRAVE_API_KEY` environment variable in Vercel project settings.

## Tech Stack

- Next.js 16
- Tailwind CSS
- Brave Search API

## Built By

[Mentius](https://mentius.ai) — helping nurses find their next opportunity 🩺

---

*For nurses, by someone who knows the hustle.*
