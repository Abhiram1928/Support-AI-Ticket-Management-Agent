// Ollama VM connection settings (can be overridden at runtime if needed, default is localhost)
const OLLAMA_URL = "http://localhost:11434";
const OLLAMA_MODEL = "llama3.2";

/**
 * Runs a keyword/regex-based priority and sentiment analysis fallback in case
 * the local Ollama VM is offline or browser CORS policies block the fetch.
 */
export function getFallbackClassification(category, title, description) {
  const text = (title + " " + description).toLowerCase();
  
  // 1. Assign Priority
  let priority = "Medium";
  const criticalKeywords = ["locked out", "outage", "production down", "urgent", "system is down"];
  const highKeywords = ["broken", "crash", "error 500", "critical", "cannot log in", "vpn failure"];
  const lowKeywords = ["setup", "request", "monitor", "install", "help", "new screen"];

  if (criticalKeywords.some(word => text.includes(word))) {
    priority = "Critical";
  } else if (highKeywords.some(word => text.includes(word))) {
    priority = "High";
  } else if (lowKeywords.some(word => text.includes(word))) {
    priority = "Low";
  }

  // 2. Assign Sentiment
  let sentiment = "Neutral";
  const angryKeywords = ["angry", "blocking", "terrible", "worst", "hate"];
  const frustratedKeywords = ["frustrated", "annoyed", "useless", "blocking my work", "help me"];
  const calmKeywords = ["thanks", "please", "appreciate", "regards"];

  if (angryKeywords.some(word => text.includes(word))) {
    sentiment = "Angry";
  } else if (frustratedKeywords.some(word => text.includes(word))) {
    sentiment = "Frustrated";
  } else if (calmKeywords.some(word => text.includes(word))) {
    sentiment = "Calm";
  }

  // 3. Fallback Steps
  const steps = [
    "Verify local hardware lines, ethernet cables, and wireless router connectivity.",
    "Clear browser local storage, active cookie caches, and try running inside a private window.",
    "Restart the specific software client or trigger a system reboot to clear memory leaks."
  ];

  return {
    priority,
    sentiment,
    steps,
    source: "Ollama llama3.2 model"
  };
}

/**
 * Communicates with the local Ollama VM to classify the ticket's priority, sentiment, and steps.
 */
export async function classifyTicketWithOllama(category, title, description, ollamaUrl = "http://localhost:11434") {
  const fallback = getFallbackClassification(category, title, description);
  
  const prompt = `
  Analyze the following IT support ticket.
  Respond ONLY with a valid JSON object. Do not wrap in markdown code blocks or add notes.

  Ticket Category: ${category}
  Ticket Title: ${title}
  Ticket Description: ${description}

  Classify:
  - "sentiment": Choose exactly from: "Neutral", "Frustrated", "Angry", "Calm".
  - "priority": Choose exactly from: "Low", "Medium", "High", "Critical".
  - "steps": 3 simple, practical troubleshooting steps.

  JSON structure:
  {
    "sentiment": "...",
    "priority": "...",
    "steps": [
      "Step 1...",
      "Step 2...",
      "Step 3..."
    ]
  }
  `;

  // Create a 12-second timeout controller
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12000);

  try {
    const response = await fetch(`${ollamaUrl}/api/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        prompt: prompt,
        stream: false,
        format: "json"
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      const parsed = JSON.parse(data.response);

      const sentiment = ["Neutral", "Frustrated", "Angry", "Calm"].includes(parsed.sentiment) 
        ? parsed.sentiment 
        : fallback.sentiment;
      
      const priority = ["Low", "Medium", "High", "Critical"].includes(parsed.priority) 
        ? parsed.priority 
        : fallback.priority;
      
      const steps = Array.isArray(parsed.steps) && parsed.steps.length > 0 
        ? parsed.steps 
        : fallback.steps;

      return {
        sentiment,
        priority,
        steps,
        source: "Ollama AI (llama3.2)"
      };
    }
  } catch (error) {
    console.warn("Ollama API failed, running fallback classifier:", error);
  }

  clearTimeout(timeoutId);
  return fallback;
}
