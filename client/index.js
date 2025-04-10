import { config } from "dotenv";
import readline from "readline/promises";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";

config();

let tools = [];

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const ai = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });

const mcpClient = new Client({
  name: "example-client",
  version: "1.0.0",
});

const chatHistory = [];

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

mcpClient.connect(new SSEClientTransport(new URL("http://localhost:3001/sse"))).then(async () => {
  console.log("connected to server");
  const toolList = await mcpClient.listTools();
  tools = toolList.tools.map(tool => ({
    name: tool.name,
    description: tool.description,
    parameters: {
      type: tool.inputSchema.type,
      properties: tool.inputSchema.properties,
      required: tool.inputSchema.required
    }
  }));
  chatLoop();
});

async function chatLoop(toolCall) {
  if (toolCall) {
    chatHistory.push({
      role: "model",
      parts: [
          {
              text: `calling tool ${toolCall.name}`,
              type: "text"
          }
      ]
  });
  
    const toolResult = await mcpClient.callTool({
      name: toolCall.name,
      arguments: toolCall.args,
    });
    
    const content = toolResult.content?.[0]?.text || "No output from tool.";
    console.log(`🛠️ Tool Result: ${content}`);
    chatHistory.push({ role: "tool", parts: [{ text: content }] });
  }

  const question = await rl.question("You: ");
  chatHistory.push({ role: "user", parts: [{ text: question }] });

  const result = await ai.generateContent({
    contents: chatHistory,
    generationConfig: {},
    tools: [{ functionDeclarations: tools }],
  });

  const candidate = result.response?.candidates?.[0];
  const part = candidate?.content?.parts?.[0];

  if (!part) {
    console.log("❌ No response from model.");
    return chatLoop();
  }

  const functionCall = part.functionCall;
  const responseText = part.text;

  if (functionCall) {
    return chatLoop(functionCall);
  }

  chatHistory.push({ role: "model", parts: [{ text: responseText }] });
  console.log(`AI: ${responseText}`);
  chatLoop();
}
