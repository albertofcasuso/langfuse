import {
  LLMAdapter,
  supportedModels,
  type UIModelParams,
} from "@langfuse/shared";
import { useCallback, useEffect, useMemo, useState } from "react";

import { type ModelParamsContext } from "@/src/components/ModelParameters";
import useProjectIdFromURL from "@/src/hooks/useProjectIdFromURL";
import { api } from "@/src/utils/api";

const DEFAULT_ASSISTANT_MODEL_PARAMS: UIModelParams = {
  provider: { value: "", enabled: true },
  model: { value: "", enabled: true },
  adapter: { value: LLMAdapter.OpenAI, enabled: true },
  temperature: { value: 0, enabled: false },
  maxTemperature: { value: 2, enabled: false },
  max_tokens: { value: 4096, enabled: false },
  top_p: { value: 1, enabled: false },
  maxReasoningTokens: { value: 0, enabled: false },
  providerOptions: { value: {}, enabled: false },
};

export const useAssistantModelParams = () => {
  const [modelParams, setModelParams] = useState<UIModelParams>(
    DEFAULT_ASSISTANT_MODEL_PARAMS,
  );
  const projectId = useProjectIdFromURL();

  const availableLLMApiKeys = api.llmApiKey.all.useQuery(
    { projectId: projectId as string },
    { enabled: Boolean(projectId) },
  );

  const availableProviders = useMemo(() => {
    const keys = availableLLMApiKeys.data?.data ?? [];
    return keys.map((key) => key.provider);
  }, [availableLLMApiKeys.data?.data]);

  const selectedProviderApiKey = availableLLMApiKeys.data?.data.find(
    (key) => key.provider === modelParams.provider.value,
  );

  const availableModels = useMemo(
    () =>
      !selectedProviderApiKey
        ? []
        : selectedProviderApiKey.withDefaultModels
          ? [
              ...selectedProviderApiKey.customModels,
              ...supportedModels[selectedProviderApiKey.adapter],
            ]
          : selectedProviderApiKey.customModels,
    [selectedProviderApiKey],
  );

  const providerModelCombinations =
    availableLLMApiKeys.data?.data.reduce((acc, key) => {
      if (key.withDefaultModels) {
        acc.push(
          ...supportedModels[key.adapter].map((m) => `${key.provider}: ${m}`),
        );
      }
      acc.push(...key.customModels.map((m) => `${key.provider}: ${m}`));
      return acc;
    }, [] as string[]) ?? [];

  const updateModelParamValue = useCallback<
    ModelParamsContext["updateModelParamValue"]
  >((key, value) => {
    setModelParams((prev) => ({
      ...prev,
      [key]: { ...prev[key], value },
    }));
  }, []);

  const setModelParamEnabled = useCallback<
    NonNullable<ModelParamsContext["setModelParamEnabled"]>
  >((key, enabled) => {
    setModelParams((prev) => ({
      ...prev,
      [key]: { ...prev[key], enabled },
    }));
  }, []);

  useEffect(() => {
    if (
      availableProviders.length > 0 &&
      !availableProviders.includes(modelParams.provider.value)
    ) {
      updateModelParamValue("provider", availableProviders[0]);
    }
  }, [availableProviders, modelParams.provider.value, updateModelParamValue]);

  useEffect(() => {
    if (
      availableModels.length > 0 &&
      !availableModels.includes(modelParams.model.value)
    ) {
      updateModelParamValue("model", availableModels[0]);
    }
  }, [availableModels, modelParams.model.value, updateModelParamValue]);

  useEffect(() => {
    if (selectedProviderApiKey?.adapter) {
      setModelParams((prev) => ({
        ...prev,
        adapter: {
          value: selectedProviderApiKey.adapter,
          enabled: true,
        },
      }));
    }
  }, [selectedProviderApiKey?.adapter]);

  return {
    modelParams,
    setModelParams,
    availableProviders,
    availableModels,
    providerModelCombinations,
    updateModelParamValue,
    setModelParamEnabled,
  };
};
