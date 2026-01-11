# How to Make Your IPL Auction Simulator Accessible to Everyone

## ✅ Changes Made
- Server now listens on all network interfaces (0.0.0.0)
- Client automatically detects server URL (no hardcoded localhost)
- Works for localhost, LAN, and cloud deployments

## 🌐 Option 1: Local Network (Same WiFi)
**Best for:** Testing with friends on the same network

1. Find your computer's IP address:
   - **Mac/Linux:** Run `ifconfig` or `ip addr` in terminal
   - **Windows:** Run `ipconfig` in command prompt
   - Look for IPv4 address (e.g., `192.168.1.100`)

2. Start the server:
   ```bash
   node server.js
   ```

3. Share the URL with others:
   - Your URL: `http://YOUR_IP:3000` (e.g., `http://192.168.1.100:3000`)
   - They can access it from any device on the same WiFi

4. **Important:** Make sure your firewall allows connections on port 3000

---

## ☁️ Option 2: Cloud Deployment (Free Options)

### A. Render.com (Recommended - Free Tier)
1. Create account at [render.com](https://render.com)
2. Create new "Web Service"
3. Connect your GitHub repo (or upload files)
4. Settings:
   - Build Command: `npm install`
   - Start Command: `node server.js`
   - Environment: Node
5. Deploy! Get a free URL like `https://your-app.onrender.com`

### B. Railway.app (Free Tier)
1. Sign up at [railway.app](https://railway.app)
2. Create new project → Deploy from GitHub
3. Add `package.json` if not present
4. Deploy automatically gets a URL

### C. Heroku (Free Tier Available)
1. Install Heroku CLI
2. Run:
   ```bash
   heroku create your-app-name
   git push heroku main
   ```
3. Get URL: `https://your-app-name.herokuapp.com`

---

## 🔧 Option 3: Temporary Public URL (ngrok)
**Best for:** Quick testing without deployment

1. Install ngrok: `npm install -g ngrok` or download from [ngrok.com](https://ngrok.com)
2. Start your server: `node server.js`
3. In another terminal: `ngrok http 3000`
4. Share the ngrok URL (e.g., `https://abc123.ngrok.io`)
5. **Note:** Free ngrok URLs expire after 2 hours

---

## 📝 Environment Variables (Optional)
You can customize the port and host:
```bash
PORT=8080 HOST=0.0.0.0 node server.js
```

---

## 🔒 Security Notes
- Current setup allows all origins (CORS: "*")
- For production, consider restricting CORS to your domain
- Add authentication if needed for public deployment

---

## ✅ Quick Test
1. Start server: `node server.js`
2. Open browser: `http://localhost:3000`
3. Check console - it will show your local IP for LAN access
4. Share that IP with others on your network!





