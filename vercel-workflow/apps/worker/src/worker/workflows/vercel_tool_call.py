"""Call one Vercel MCP connector tool per execution.

The workflow runs on behalf of the triggering user, so the Vercel OAuth credential
stored for that user in Studio is used. It exists to inspect deployments and trigger
a production redeploy of the Chatbot project.
"""

from typing import Any

import mistralai.workflows as workflows
import pydantic
from mistralai.workflows import Depends
from mistralai.workflows.plugins.mistralai.connectors import (
    ToolCallClient,
    connector,
    uses_connectors,
)

vercel_connector = connector("vercel_03a9")


class VercelToolCallInput(pydantic.BaseModel):
    tool_name: str
    arguments: dict[str, Any] = pydantic.Field(default_factory=dict)


class VercelToolCallOutput(pydantic.BaseModel):
    tool_name: str
    ok: bool
    content: Any = None
    error: str | None = None


def _serialize(response: Any) -> Any:
    if response is None:
        return None
    for attribute in ("model_dump", "dict"):
        method = getattr(response, attribute, None)
        if callable(method):
            try:
                return method(mode="json") if attribute == "model_dump" else method()
            except TypeError:
                pass
    if isinstance(response, (str, int, float, bool, list, dict)):
        return response
    return str(response)


@workflows.activity(name="vercel-call-tool")
async def call_vercel_tool(
    tool_name: str,
    arguments: dict[str, Any],
    client: ToolCallClient = Depends(vercel_connector),
) -> dict[str, Any]:
    response = await client.call_tool(tool_name=tool_name, arguments=arguments)
    return _serialize(response)


@workflows.workflow.define(
    name="vercel-tool-call",
    on_behalf_of=True,
)
@uses_connectors(vercel_connector)
class VercelToolCallWorkflow:
    @workflows.workflow.entrypoint
    async def run(self, input: VercelToolCallInput) -> VercelToolCallOutput:
        try:
            content = await call_vercel_tool(input.tool_name, input.arguments)
        except Exception as error:
            return VercelToolCallOutput(
                tool_name=input.tool_name, ok=False, error=str(error)
            )
        return VercelToolCallOutput(tool_name=input.tool_name, ok=True, content=content)
