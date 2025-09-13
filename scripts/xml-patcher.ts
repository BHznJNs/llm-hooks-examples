import { LlmModel, OpenAI, Plugin, streamText, StreamTextResult, aiSdkStreamToOpenAI } from 'llm-hooks-sdk';
import { XMLValidator } from "fast-xml-parser";

const RooCode_ToolUse_Instruct = `\
# Tool Use Formatting

Tool uses are formatted using XML-style tags. The tool name itself becomes the XML tag name. Each parameter is enclosed within its own set of tags. Here's the structure:

<actual_tool_name>
<parameter1_name>value1</parameter1_name>
<parameter2_name>value2</parameter2_name>
...
</actual_tool_name>

For example, to use the new_task tool:

<new_task>
<mode>code</mode>
<message>Implement a new feature for the application.</message>
</new_task>

Always use the actual tool name as the XML tag name for proper parsing and execution.

# Tools

## read_file
Description: Request to read the contents of one or more files. The tool outputs line-numbered content (e.g. "1 | const x = 1") for easy reference when creating diffs or discussing code. Supports text extraction from PDF and DOCX files, but may not handle other binary files properly.

**IMPORTANT: You can read a maximum of 6 files in a single request.** If you need to read more files, use multiple sequential read_file requests.


Parameters:
- args: Contains one or more file elements, where each file contains:
  - path: (required) File path (relative to workspace directory d:\MyPrograms\workers\roo-xml-correct)
  

Usage:
<read_file>
<args>
  <file>
    <path>path/to/file</path>
    
  </file>
</args>
</read_file>

Examples:

1. Reading a single file:
<read_file>
<args>
  <file>
    <path>src/app.ts</path>
    
  </file>
</args>
</read_file>

2. Reading multiple files (within the 6-file limit):
<read_file>
<args>
  <file>
    <path>src/app.ts</path>
    
  </file>
  <file>
    <path>src/utils.ts</path>
    
  </file>
</args>
</read_file>

3. Reading an entire file:
<read_file>
<args>
  <file>
    <path>config.json</path>
  </file>
</args>
</read_file>

IMPORTANT: You MUST use this Efficient Reading Strategy:
- You MUST read all related files and implementations together in a single operation (up to 6 files at once)
- You MUST obtain all necessary context before proceeding with changes

- When you need to read more than 6 files, prioritize the most critical files first, then use subsequent read_file requests for additional files

## fetch_instructions
Description: Request to fetch instructions to perform a task
Parameters:
- task: (required) The task to get instructions for.  This can take the following values:
  create_mode

Example: Requesting instructions to create a Mode

<fetch_instructions>
<task>create_mode</task>
</fetch_instructions>

## search_files
Description: Request to perform a regex search across files in a specified directory, providing context-rich results. This tool searches for patterns or specific content across multiple files, displaying each match with encapsulating context.
Parameters:
- path: (required) The path of the directory to search in (relative to the current workspace directory d:\MyPrograms\workers\roo-xml-correct). This directory will be recursively searched.
- regex: (required) The regular expression pattern to search for. Uses Rust regex syntax.
- file_pattern: (optional) Glob pattern to filter files (e.g., '*.ts' for TypeScript files). If not provided, it will search all files (*).
Usage:
<search_files>
<path>Directory path here</path>
<regex>Your regex pattern here</regex>
<file_pattern>file pattern here (optional)</file_pattern>
</search_files>

Example: Requesting to search for all .ts files in the current directory
<search_files>
<path>.</path>
<regex>.*</regex>
<file_pattern>*.ts</file_pattern>
</search_files>

## list_files
Description: Request to list files and directories within the specified directory. If recursive is true, it will list all files and directories recursively. If recursive is false or not provided, it will only list the top-level contents. Do not use this tool to confirm the existence of files you may have created, as the user will let you know if the files were created successfully or not.
Parameters:
- path: (required) The path of the directory to list contents for (relative to the current workspace directory d:\MyPrograms\workers\roo-xml-correct)
- recursive: (optional) Whether to list files recursively. Use true for recursive listing, false or omit for top-level only.
Usage:
<list_files>
<path>Directory path here</path>
<recursive>true or false (optional)</recursive>
</list_files>

Example: Requesting to list all files in the current directory
<list_files>
<path>.</path>
<recursive>false</recursive>
</list_files>

## list_code_definition_names
Description: Request to list definition names (classes, functions, methods, etc.) from source code. This tool can analyze either a single file or all files at the top level of a specified directory. It provides insights into the codebase structure and important constructs, encapsulating high-level concepts and relationships that are crucial for understanding the overall architecture.
Parameters:
- path: (required) The path of the file or directory (relative to the current working directory d:\MyPrograms\workers\roo-xml-correct) to analyze. When given a directory, it lists definitions from all top-level source files.
Usage:
<list_code_definition_names>
<path>Directory path here</path>
</list_code_definition_names>

Examples:

1. List definitions from a specific file:
<list_code_definition_names>
<path>src/main.ts</path>
</list_code_definition_names>

2. List definitions from all files in a directory:
<list_code_definition_names>
<path>src/</path>
</list_code_definition_names>

## use_mcp_tool
Description: Request to use a tool provided by a connected MCP server. Each MCP server can provide multiple tools with different capabilities. Tools have defined input schemas that specify required and optional parameters.
Parameters:
- server_name: (required) The name of the MCP server providing the tool
- tool_name: (required) The name of the tool to execute
- arguments: (required) A JSON object containing the tool's input parameters, following the tool's input schema
Usage:
<use_mcp_tool>
<server_name>server name here</server_name>
<tool_name>tool name here</tool_name>
<arguments>
{
  "param1": "value1",
  "param2": "value2"
}
</arguments>
</use_mcp_tool>

Example: Requesting to use an MCP tool

<use_mcp_tool>
<server_name>weather-server</server_name>
<tool_name>get_forecast</tool_name>
<arguments>
{
  "city": "San Francisco",
  "days": 5
}
</arguments>
</use_mcp_tool>

## access_mcp_resource
Description: Request to access a resource provided by a connected MCP server. Resources represent data sources that can be used as context, such as files, API responses, or system information.
Parameters:
- server_name: (required) The name of the MCP server providing the resource
- uri: (required) The URI identifying the specific resource to access
Usage:
<access_mcp_resource>
<server_name>server name here</server_name>
<uri>resource URI here</uri>
</access_mcp_resource>

Example: Requesting to access an MCP resource

<access_mcp_resource>
<server_name>weather-server</server_name>
<uri>weather://san-francisco/current</uri>
</access_mcp_resource>

## ask_followup_question
Description: Ask the user a question to gather additional information needed to complete the task. This tool should be used when you encounter ambiguities, need clarification, or require more details to proceed effectively. It allows for interactive problem-solving by enabling direct communication with the user. Use this tool judiciously to maintain a balance between gathering necessary information and avoiding excessive back-and-forth.
Parameters:
- question: (required) The question to ask the user. This should be a clear, specific question that addresses the information you need.
- follow_up: (required) A list of 2-4 suggested answers that logically follow from the question, ordered by priority or logical sequence. Each suggestion must:
  1. Be provided in its own <suggest> tag
  2. Be specific, actionable, and directly related to the completed task
  3. Be a complete answer to the question - the user should not need to provide additional information or fill in any missing details. DO NOT include placeholders with brackets or parentheses.
  4. Optionally include a mode attribute to switch to a specific mode when the suggestion is selected: <suggest mode="mode-slug">suggestion text</suggest>
     - When using the mode attribute, focus the suggestion text on the action to be taken rather than mentioning the mode switch, as the mode change is handled automatically and indicated by a visual badge
Usage:
<ask_followup_question>
<question>Your question here</question>
<follow_up>
<suggest>
Your suggested answer here
</suggest>
<suggest mode="code">
Implement the solution
</suggest>
</follow_up>
</ask_followup_question>

Example: Requesting to ask the user for the path to the frontend-config.json file
<ask_followup_question>
<question>What is the path to the frontend-config.json file?</question>
<follow_up>
<suggest>./src/frontend-config.json</suggest>
<suggest>./config/frontend-config.json</suggest>
<suggest>./frontend-config.json</suggest>
</follow_up>
</ask_followup_question>

Example: Asking a question with mode switching options
<ask_followup_question>
<question>How would you like to proceed with this task?</question>
<follow_up>
<suggest mode="code">Start implementing the solution</suggest>
<suggest mode="architect">Plan the architecture first</suggest>
<suggest>Continue with more details</suggest>
</follow_up>
</ask_followup_question>

## attempt_completion
Description: After each tool use, the user will respond with the result of that tool use, i.e. if it succeeded or failed, along with any reasons for failure. Once you've received the results of tool uses and can confirm that the task is complete, use this tool to present the result of your work to the user. The user may respond with feedback if they are not satisfied with the result, which you can use to make improvements and try again.
IMPORTANT NOTE: This tool CANNOT be used until you've confirmed from the user that any previous tool uses were successful. Failure to do so will result in code corruption and system failure. Before using this tool, you must ask yourself in <thinking></thinking> tags if you've confirmed from the user that any previous tool uses were successful. If not, then DO NOT use this tool.
Parameters:
- result: (required) The result of the task. Formulate this result in a way that is final and does not require further input from the user. Don't end your result with questions or offers for further assistance.
Usage:
<attempt_completion>
<result>
Your final result description here
</result>
</attempt_completion>

Example: Requesting to attempt completion with a result
<attempt_completion>
<result>
I've updated the CSS
</result>
</attempt_completion>

## switch_mode
Description: Request to switch to a different mode. This tool allows modes to request switching to another mode when needed, such as switching to Code mode to make code changes. The user must approve the mode switch.
Parameters:
- mode_slug: (required) The slug of the mode to switch to (e.g., "code", "ask", "architect")
- reason: (optional) The reason for switching modes
Usage:
<switch_mode>
<mode_slug>Mode slug here</mode_slug>
<reason>Reason for switching here</reason>
</switch_mode>

Example: Requesting to switch to code mode
<switch_mode>
<mode_slug>code</mode_slug>
<reason>Need to make code changes</reason>
</switch_mode>

## new_task
Description: This will let you create a new task instance in the chosen mode using your provided message.

Parameters:
- mode: (required) The slug of the mode to start the new task in (e.g., "code", "debug", "architect").
- message: (required) The initial user message or instructions for this new task.

Usage:
<new_task>
<mode>your-mode-slug-here</mode>
<message>Your initial instructions here</message>
</new_task>

Example:
<new_task>
<mode>code</mode>
<message>Implement a new feature for the application.</message>
</new_task>


## update_todo_list

**Description:**
Replace the entire TODO list with an updated checklist reflecting the current state. Always provide the full list; the system will overwrite the previous one. This tool is designed for step-by-step task tracking, allowing you to confirm completion of each step before updating, update multiple task statuses at once (e.g., mark one as completed and start the next), and dynamically add new todos discovered during long or complex tasks.

**Checklist Format:**
- Use a single-level markdown checklist (no nesting or subtasks).
- List todos in the intended execution order.
- Status options:
	 - [ ] Task description (pending)
	 - [x] Task description (completed)
	 - [-] Task description (in progress)

**Status Rules:**
- [ ] = pending (not started)
- [x] = completed (fully finished, no unresolved issues)
- [-] = in_progress (currently being worked on)

**Core Principles:**
- Before updating, always confirm which todos have been completed since the last update.
- You may update multiple statuses in a single update (e.g., mark the previous as completed and the next as in progress).
- When a new actionable item is discovered during a long or complex task, add it to the todo list immediately.
- Do not remove any unfinished todos unless explicitly instructed.
- Always retain all unfinished tasks, updating their status as needed.
- Only mark a task as completed when it is fully accomplished (no partials, no unresolved dependencies).
- If a task is blocked, keep it as in_progress and add a new todo describing what needs to be resolved.
- Remove tasks only if they are no longer relevant or if the user requests deletion.

**Usage Example:**
<update_todo_list>
<todos>
[x] Analyze requirements
[x] Design architecture
[-] Implement core logic
[ ] Write tests
[ ] Update documentation
</todos>
</update_todo_list>

*After completing "Implement core logic" and starting "Write tests":*
<update_todo_list>
<todos>
[x] Analyze requirements
[x] Design architecture
[x] Implement core logic
[-] Write tests
[ ] Update documentation
[ ] Add performance benchmarks
</todos>
</update_todo_list>
`;

const SYSTEM_INSTRUCT = `\
<tool_use_instruct>
${RooCode_ToolUse_Instruct}
</tool_use_instruct>

============

## Task Description
1. **Detection**: Scan the text in order and locate every \`<tool_name>...</tool_name>\` block.
2. **Validation**: For each block, perform the following checks:
   a. Check for escaped characters (\`&lt;\`, \`&gt;\`, \`&amp;\`, \`&quot;\`, \`&apos;\`, \`&#x2F;\`, etc.); if any exist, decode them first.
   b. After decoding, verify that:
      - Every opening tag has a matching closing tag in the correct order.
      - There is no cross-nesting.
3. **Response**:
   - If a tool call exists but is malformed: \
return the corrected XML instructions (XML portion only, do not include any prompt or explanation, do not wrap the XML within \`\`\`).
   - If a tool call exists and is well-formed: \
return "Model correctly invoked the tool".
   - If no tool call exists: \
return "Model did not invoke any tool".

## Repair Principles (in priority order)
1. **Format repair**: Fix only syntax errors, do not alter logic.
2. **Preserve parameters**: All original parameters must be retained.
3. **Tag completeness**: Ensure every opening tag has a matching closing tag.
4. **Clean output**: The final output must not contain leading or trailing spaces or line breaks.

### Escaped Character Quick Reference

| Escaped Character | Actual Character |
|-------------------|------------------|
| \`&lt;\`            | \`<\`              |
| \`&gt;\`            | \`>\`              |
| \`&quot;\`          | \`"\`              |
| \`&apos;\`          | \`'\`              |
| \`&amp;\`           | \`&\`              |
| \`&#x2F;\`          | \`/\`              |

## Common Errors Quick Reference
| Error Type   | Original Example        | Corrected Example           |
|--------------|-------------------------|-----------------------------|
| Unclosed     | \`<tool>\`                | \`<tool></tool>\`             |
| Cross-nested | \`<a><b></a></b>\`        | \`<a><b></b></a>\`            |
| Escaped      | \`&lt;tool&gt;\`          | \`<tool>\`                    |
| Tag typo     | \`<readfile>\`            | \`<read_file>\`               |
| Extra text   | \`<tool>abc</path>\`      | \`<tool>abc</tool>\`          |

## Error Examples & Corrections

### Example 1: Basic Format Error

**Incorrect:**
\`\`\`
I am going to read the main.go file to get more information.

read_file>
args>
<file>
<path>main.gopath>
</file>
args>
read_file>
\`\`\`

**Corrected:**
\`\`\`
I am going to read the file to get more information.

<read_file>
<args>
<file>
<path>main.go</path>
</file>
</args>
</read_file>
\`\`\`

### Example 2: XML Escaped Character Error

**Incorrect:**
\`\`\`
&lt;ask_followup_question&gt;
&lt;question&gt;Your question here&lt;&#x2F;question&gt;
&lt;follow_up&gt;
&lt;suggest&gt;Option 1&lt;&#x2F;suggest&gt;
&lt;suggest&gt;Option 2&lt;&#x2F;suggest&gt;
&lt;&#x2F;follow_up&gt;
&lt;&#x2F;ask_followup_question&gt;
\`\`\`

**Corrected:**
\`\`\`
<ask_followup_question>
<question>Your question here</question>
<follow_up>
<suggest>Option 1</suggest>
<suggest>Option 2</suggest>
</follow_up>
</ask_followup_question>
\`\`\`
`;

function extractFirstToLastContent(input: string): string | null {
  const startTag = '<content>';
  const endTag = '</content>';

  const firstStartIndex = input.indexOf(startTag);
  if (firstStartIndex === -1) {
    return null;
  }

  const lastEndIndex = input.lastIndexOf(endTag);
  if (lastEndIndex === -1 || lastEndIndex <= firstStartIndex) {
    return null;
  }

  const contentStart = firstStartIndex + startTag.length;
  const content = input.substring(contentStart, lastEndIndex);

  return content;
}

function validateRooCodeResponse(text: string): true | string {
  let processedText = text;

  // remove <think>...</think> and <thinking>...</thinking>
  processedText = processedText.replace(/<think(?:ing)?>([\s\S]*?)<\/think(?:ing)?>/gi, '');
  // remove unclosed <think> or <thinking> tags
  processedText = processedText.replace(/<\/?think(?:ing)?>/gi, '');

  const hasXMLTags = /<[^>]+>/.test(processedText);
  if (!hasXMLTags) return 'Has no XML tags';

  let extractContentTags = extractFirstToLastContent(processedText);
  if (extractContentTags !== null) {
    // escape the possible XML tags in the content tag
    const escapedText = extractContentTags
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    // replace the original content tag with the escaped version
    processedText = processedText.replace(extractContentTags, escapedText);
  }

  // To make the text valid XML, we need to wrap it in a root element
  const wrappedText = `<root>${processedText}</root>`;

  const validationResult = XMLValidator.validate(wrappedText, {
    allowBooleanAttributes: true,
    unpairedTags: [
      "br", "hr", "img", "input", "meta", "link", "area", "base", "col", "embed", "source", "track", "wbr"
    ], // allow common self-closing tags
  });

  if (validationResult !== true) {
    return validationResult.err.msg;
  }
  return true;
}


function xmlPatcher(raw: string, model: LlmModel): StreamTextResult<{}, string> {
  const result = streamText({
    model,
    system: SYSTEM_INSTRUCT,
    messages: [
      {
        role: "user",
        content: raw,
      },
    ],
  })
  return result;
}

export default {
  async afterUpstreamResponse({
    data,
    logger,
    model,
  }, isStream) {
    const modelMessage = isStream
      ? data as string
      : (data as OpenAI.ChatCompletionResponse).choices[0].message.content;
    if (!modelMessage) return null;

    const isValid = validateRooCodeResponse(modelMessage);
    if (isValid) return null;

    logger.info("Response not valid, try to patching...");

    const patched = xmlPatcher(modelMessage, model);
    if (!isStream) {
      const corrected = await patched.text;
      return { ...(data as OpenAI.ChatCompletionResponse), text: corrected };
    }
    return aiSdkStreamToOpenAI(model.modelId, patched);
  },
} satisfies Plugin;
