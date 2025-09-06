import { generateText, Plugin } from 'llm-hooks-sdk';

const SYSTEM_INSTRUCT = `\
你是一名意图分类器。  
下面有多项模型特长描述，每项前面有数字编号：  
<model-list>

请根据输入的消息，选择最匹配的一项，只输出对应数字，不要解释。
`;

export default {
  onFetchModelList({
    data,
  }) {
    const originalModelList = data.data;
    return {
      data: [
        ...originalModelList,
        {
          id: 'model-router',
          created: Date.now(),
          object: 'model',
          owned_by: 'llm-hooks',
        }
      ]
    };
  },
  async beforeUpstreamRequest({
    data,
    model,
    logger,
    metadata,
  }) {
    logger.info(`received model: ${data.requestParams.model}`);
    if (data.requestParams.model !== 'model-router') {
      return null;
    }
    const options = Object.keys(metadata);
    const injected_instruct = SYSTEM_INSTRUCT.replace(
      '<model-list>',
      options.map((option, index) => `${index}. ${option}\n`).join(''),
    );
    const lastMessage = data.requestParams.messages[data.requestParams.messages.length - 1];
    const result = await generateText({
      model,
      system: injected_instruct,
      messages: [{
        role: 'user',
        content: lastMessage.content,
      }],
    });
    const selectedModelIndex = Number.parseInt(result.text);
    const selectedModel = Object.values(metadata)[selectedModelIndex];
    logger.info(`Selected index: ${selectedModelIndex}; Selected model: ${selectedModel}`);
    return {
      requestParams: {
        ...data.requestParams,
        model: selectedModel as string,
      },
    };
  }
} satisfies Plugin;
