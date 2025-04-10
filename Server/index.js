import express from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import {z} from "zod"
import  {createPost} from "./mcp.tool.js"

const server = new McpServer({
  name: "example-server",
  version: "1.0.0"
});
server.tool(
  "addtwonumber",
  "Add two numbers",
  {
    a:z.number(),
    b:z.number()
  },
  async(arg)=>{
    const {a,b}=arg;
    return {
      content: [
        {
          type: "text",
          text: `sum of ${a} and ${b} is ${a + b}`
        }
      ]
    };
    

  }
)
server.tool(
  "createPost",
  "Create a post on X formally known as Twitter", {
    status: z.string()
  },
  async (arg) => {
    const { status } = arg;
    return createPost(status);
  }
)


const app = express();

// to support multiple simultaneous connections we have a lookup object from
// sessionId to transport
const transports= {};

app.get("/sse", async (req,res)=> {
  const transport = new SSEServerTransport('/messages', res);
  transports[transport.sessionId] = transport;
  res.on("close", () => {
    delete transports[transport.sessionId];
  });
  await server.connect(transport);
});

app.post("/messages", async (req,res) => {
  const sessionId = req.query.sessionId ;
  const transport = transports[sessionId];
  if (transport) {
    await transport.handlePostMessage(req, res);
  } else {
    res.status(400).send('No transport found for sessionId');
  }
});

app.listen(3001,()=>{
    console.log("server is running on http://localhost:3001")
});