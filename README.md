# 🤖 Support AI — AI-Powered IT Support Desk

Support AI is a modern, high-fidelity IT Support Ticket Management System featuring an interactive **Llama 3.2 AI Assistant**, secure technician routing queues, and detailed **AI Admin Analytics**.

---

## 🚀 Key Features

* **🎨 Premium Matte UI:** Sleek, modern peach-colored canvas (`#fff7ed`) with solid black borders, custom pill badges, and micro-hover transitions.
* **🔑 Multi-Role Navigation:** Seamlessly toggles between **Employee Mode** (raising tickets), **Technician Mode** (assigning, managing, and resolving queue issues), and **AI Admin Analytics** (dashboard stats).
* **💬 Llama 3.2 AI Assistant:** Interactive chatbot panel embedded directly inside the ticket detail view to answer employee queries.
* **📚 On-Demand Context Engine:** Feeds similar historical resolved tickets and their fix remarks into the chat context *on-the-fly* only when the user sends a message.
* **🛡️ Robust Offline Fallbacks:** Warns users of database/Ollama VM status, using backup regex classifiers and keyword database logs search if Ollama is unreachable.
* **🍩 High-Fidelity Donut & Bar Charts:** Premium custom SVG charts for Admin dashboard:
  * **Priority Distribution:** Thick segment ring (`36px` stroke width) with rounded linecaps and linear color gradients.
  * **Category Breakdown:** Vertical bar graph with rounded top corners, dashed gridlines, and warm orange-gradient fills.

---

## 🛠️ Technology Stack

* **Client:** React (Vite, custom Vanilla CSS tokens).
* **Server:** Node.js, Express REST API.
* **Database:** SQLite (local persistent ticketing log storage).
* **AI Model:** Local Ollama VM running `llama3.2`.

---

## ⚙️ How to Setup & Run

### 1. Start Ollama Server (With CORS Enabled)
Because the React client runs in the browser, you **MUST** enable CORS origins for Ollama.

**On Windows (PowerShell):**
1. Right-click the Ollama llama icon in your system tray (bottom-right taskbar) and click **Quit**.
2. Open your VS Code terminal (or standard PowerShell) and run:
   ```powershell
   $env:OLLAMA_ORIGINS="*"; ollama serve
   ```
*(For Command Prompt: `set OLLAMA_ORIGINS=* && ollama serve`)*

### 2. Install Project Dependencies
Run this command in the project root folder:
```bash
npm install
```

### 3. Run the Express Backend Server
Start the Express API server (connects to the SQLite database):
```bash
node server/index.js
```
*(Make sure this is running so the database logs can load!)*

### 4. Run the React Frontend
In a new terminal window, start the local Vite development server:
```bash
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## 📚 Evaluation & Offline Resilience
If the local Ollama VM is turned off or unreachable:
1. **Category/Priority Router Fallback:** Auto-categorizes incoming tickets using rule-based local keyword mappings.
2. **AI Chatbot Fallback:** If you ask the chatbot a question like *"tell me about the ticket raised"* or *"brief me"*, it detects your intent and outputs the active ticket's fields + similar resolved logs from SQLite automatically without crashing.
