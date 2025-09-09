import { Plugin } from 'llm-hooks-sdk';
import { estimateTokenCount } from 'tokenx';

const TOKEN_ESTIMATE_ERROR_RATE = 1.1;

export default {
  beforeUpstreamRequest({ data, logger, metadata }) {
    const model = data.requestParams.model;
    if (!metadata[model]) {
      return null;
    }

    let modelContextThreshold: number;
    try {
      modelContextThreshold = Number.parseInt(metadata[model] as string);
    } catch {
      return null;
    }

    const messages = data.requestParams.messages;
    const messageContents = messages
      .filter(message => message.content &&
              typeof message.content === 'string')
      .map(message => message.content as string)
      .join('');
    const totalTokens = estimateTokenCount(messageContents);
    logger.info(`Total tokens: ${totalTokens}`);

    if (totalTokens * TOKEN_ESTIMATE_ERROR_RATE < modelContextThreshold) {
      const freeModelId = model + ':free';
      logger.info(`Routed to free model: ${freeModelId}`)
      return {
        requestParams: {
          ...data.requestParams,
          model: freeModelId,
        },
      };
    }
    return null;
  },
} satisfies Plugin;
