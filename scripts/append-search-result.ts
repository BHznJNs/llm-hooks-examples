import { Plugin, generateText } from 'llm-hooks-sdk';
import { tavily } from '@tavily/core';

const SYSTEM_INSTRUCTION = `\
你是一个对话搜索决策专家。你的任务是根据最近的对话历史，判断当前是否需要调用搜索引擎获取外部信息来更好地回答用户的问题。

## 判断标准

### 需要搜索的情况：
1. **事实性问题**：涉及具体数据、日期、数字、统计信息等需要准确答案的问题
   - 例如："2023 年中国 GDP 是多少？"、"马斯克现在身价多少？"
 
2. **时事新闻**：涉及最近发生的事件、新闻、政策变化等
   - 例如："最近有什么重要的科技新闻？"、"最新的 AI 发展动态"

3. **专业领域知识**：需要专业知识或最新研究的问题
   - 例如："量子计算的最新突破是什么？"、"最新的医学研究成果"

4. **产品/服务信息**：涉及具体产品价格、功能、比较等
   - 例如："iPhone 15 Pro 的规格和价格"、"最好的笔记本电脑推荐"

5. **地理位置信息**：涉及具体地点、距离、路线等
   - 例如："北京到上海的距离"、"附近有什么好吃的餐厅"

### 不需要搜索的情况：
1. **常识性问题**：一般性的常识、基础知识
   - 例如："天空为什么是蓝色的？"、"水的化学式是什么？"

2. **逻辑推理**：纯逻辑、数学计算、编程问题
   - 例如："2+2 等于多少？"、"如何用 Python 写一个循环？"

3. **创意内容**：写作、创意、建议类问题
   - 例如："帮我写一首诗"、"给我一些创业建议"

4. **个人观点**：需要主观意见或经验分享的问题
   - 例如："你觉得什么是幸福？"、"你有什么人生建议？"

5. **对话延续**：简单的对话回应、确认、感谢等
   - 例如："好的"、"谢谢"、"明白了"

## 输出格式

请严格按照以下 JSON 格式输出你的判断结果（不需要带任何解释说明以及 Markdown 的代码块格式）：

{
  "need_search": true/false,
  "reason": "判断理由的简要说明",
  "search_query": "如果需要搜索，提供优化的搜索查询词；如果不需要，则为空"
}

## 示例

### 示例 1（需要搜索）：
用户消息："2024 年美国总统大选的最新民调结果如何？"
输出：
{
  "need_search": true,
  "reason": "涉及最新的选举民调数据，需要实时信息",
  "search_query": "2024 美国总统大选最新民调结果"
}

### 示例 2（不需要搜索）：
用户消息："请帮我解释一下什么是机器学习？"
输出：
{
  "need_search": false,
  "reason": "这是基础概念解释问题，属于常识性知识",
  "search_query": ""
}

## 注意事项

1. **准确性优先**：宁可误判需要搜索，也不要错过需要搜索的情况
2. **查询优化**：当判断需要搜索时，提供简洁、准确的搜索查询词
3. **上下文理解**：考虑对话的连续性，避免重复搜索相同主题
4. **时效性判断**：对于可能过时的信息，倾向于建议搜索
`;

export default {
  async beforeUpstreamRequest({ data, logger, model, metadata }) {
    const messages = data.requestParams.messages;
    const latestMessages = messages
      .slice(-3)
      .map(message => ({
        role: message.role,
        content: message.content,
      }));
    const { text } = await generateText({
      model,
      system: SYSTEM_INSTRUCTION,
      messages: [{
        role: 'user',
        content: `\
请根据以下对话历史，判断是否需要调用搜索引擎获取外部信息来更好地回答用户的问题：
${JSON.stringify(latestMessages)}`}
      ],
    });
    logger.info(`Assistant: ${text}`);
    const { need_search, search_query } = JSON.parse(text);
    if (!need_search) {
      return null;
    }
    if (metadata.TAVILY_KEY === undefined) {
      logger.warn('TAVILY_KEY not set, skip search');
      return null;
    }
    const tvly = tavily({ apiKey: metadata.TAVILY_KEY as string });
    const result = await tvly.search(search_query);
    if (typeof result.answer !== 'string' && result.results.length === 0) {
      logger.warn('No answer found, skip search');
      return null;
    }

    const finalResult = result.answer ?? JSON.stringify(result.results);
    logger.info(`Search result: ${finalResult}`);

    const clonedMessages = structuredClone(messages);
    const lastMessage = clonedMessages[clonedMessages.length - 1];
    clonedMessages[clonedMessages.length - 1] = {
      ...lastMessage,
      content: lastMessage.content +
               `\n根据外部信息搜索，得到以下答案：\n${finalResult}`,
    };
    return {
      requestParams: {
        ...data.requestParams,
        messages: clonedMessages,
      },
    };
  }
} satisfies Plugin;
