"""MCP Server for Dojang — Claude Code가 이 도구들을 사용해서 학습 시스템과 상호작용합니다."""

import json

from mcp.server import Server
from mcp.server.stdio import stdio_server
from mcp.types import TextContent, Tool

from src.backend.tools import to_mcp_tools, handle_tool

server = Server("dojang")


@server.list_tools()
async def list_tools() -> list[Tool]:
    return to_mcp_tools()


@server.call_tool()
async def call_tool(name: str, arguments: dict) -> list[TextContent]:
    try:
        result = handle_tool(name, arguments)
        return [TextContent(type="text", text=json.dumps(result, ensure_ascii=False, indent=2))]
    except Exception as e:
        return [TextContent(type="text", text=json.dumps({"error": str(e)}, ensure_ascii=False))]


async def main():
    async with stdio_server() as (read_stream, write_stream):
        await server.run(read_stream, write_stream, server.create_initialization_options())


if __name__ == "__main__":
    import asyncio
    asyncio.run(main())
