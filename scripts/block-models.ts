import { Plugin } from 'llm-hooks-sdk';

const ALLOWED_MODELS = [
  'kimi-k2',
  'qwen3-coder',
  'deepseek-v3.1',
  'glm-4.5'
];

export default {
  onFetchModelList({
    data,
  }) {
    return {
      data: data.data.filter((model: any) =>
        ALLOWED_MODELS.includes(model.id))
    };
  },
} satisfies Plugin;
