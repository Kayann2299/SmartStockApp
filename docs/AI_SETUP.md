# AI Setup
# Current provider: Groq

### Install Dependencies (Backend)

```bash
cd backend
npm install groq-sdk
```

### Get API Key

1. Go to [Console Groq](https://console.groq.com/keys)
2. Create a new API key
3. Copy it

### Configure Environment

Edit `backend/.env` and add:

```env
GROQ_API_KEY=your_key_here
GROQ_MODEL=llama-3.3-70b-versatile
```

### Start Development

```bash
# Terminal 1 - Backend
cd backend
npm run dev

# Terminal 2 - Frontend
cd frontend
npm run dev
```

### Test the Chatbot

1. Open http://localhost:5173
2. Go to "AI Insights" page
3. Ask a question:
   - "How can I improve products availability?"
   - "Which products need attention?"
   - "What should I prioritize this week?"


## Related Files

- `backend/src/services/AIService.js`
- `backend/src/controllers/insightController.js`
- `frontend/src/pages/Insights.jsx`
- `frontend/src/services/insightService.js`

## Optional: Public Access with ngrok

The application works normally in local development.

ngrok is only needed if you want to expose your local backend to external services or remote users.

```bash
# Install ngrok
brew install ngrok  # or download from ngrok.com

# Setup auth
ngrok config add-authtoken YOUR_TOKEN

# Start tunnel
ngrok http 5000

# Use the provided URL for external access
```

## Troubleshooting

- Verify `GROQ_API_KEY` is configured.
- Check backend logs when requests fail.
- Confirm internet connectivity.
- Review AI API usage limits.


