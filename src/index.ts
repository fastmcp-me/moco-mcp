#!/usr/bin/env node

/**
 * MoCo MCP Server
 * Provides Model Context Protocol access to MoCo API for time tracking,
 * project management, holiday tracking, and presence monitoring
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListPromptsRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

// Import all MCP tools
import { getActivitiesTool } from './tools/activitiesTools.js';
import { getProjectsTool, getProjectTasksTool } from './tools/projectsTools.js';
import { getUserHolidaysTool } from './tools/userHolidaysTools.js';
import { getUserPresencesTool } from './tools/userPresencesTools.js';
import { getUserSickDaysTool } from './tools/userSickDaysTools.js';

/**
 * Available MCP tools for MoCo API access
 */
const AVAILABLE_TOOLS = [
  getActivitiesTool,
  getProjectsTool,
  getProjectTasksTool,
  getUserHolidaysTool,
  getUserPresencesTool,
  getUserSickDaysTool
];

const server = new Server(
  {
    name: "moco-mcp",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {}, // We support tools
      resources: {}, // No resources currently
      prompts: {}, // No prompts currently
    },
  }
);

/**
 * Handle resource listing - currently no resources provided
 */
server.setRequestHandler(ListResourcesRequestSchema, async () => {
  return {
    resources: [],
  };
});

/**
 * Handle resource reading - currently no resources provided
 */
server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  throw new Error(`Resource not found: ${request.params.uri}`);
});

/**
 * Handle prompt listing - currently no prompts provided
 */
server.setRequestHandler(ListPromptsRequestSchema, async () => {
  return {
    prompts: [],
  };
});

/**
 * Handle tool listing - return all available MoCo tools
 */
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: AVAILABLE_TOOLS.map(tool => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema
    }))
  };
});

/**
 * Handle tool execution - dispatch to appropriate tool handler
 */
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  
  // Find the requested tool
  const tool = AVAILABLE_TOOLS.find(t => t.name === name);
  
  if (!tool) {
    throw new Error(`Tool not found: ${name}`);
  }

  try {
    // Execute the tool with provided arguments
    const result = await tool.handler(args as any || {});
    
    return {
      content: [
        {
          type: "text",
          text: result
        }
      ]
    };
  } catch (error) {
    // Return error as text response rather than throwing
    return {
      content: [
        {
          type: "text", 
          text: `Error executing tool ${name}: ${error instanceof Error ? error.message : 'Unknown error'}`
        }
      ]
    };
  }
});

/**
 * Main server initialization and startup
 */
async function main() {
  try {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("MoCo MCP Server running on stdio");
    console.error(`Available tools: ${AVAILABLE_TOOLS.map(t => t.name).join(', ')}`);
  } catch (error) {
    console.error("Failed to start MCP server:", error);
    process.exit(1);
  }
}

// Start the server
main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});