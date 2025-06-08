<template>
  <div class="p-6 flex flex-col h-full">
    <h2 class="text-xl font-semibold text-gray-800 mb-2">Step 3: Execute Prompt</h2>
    <p class="text-gray-600 mb-2">
      You can paste a diff directly into the textarea below, or use the 'Get Diff from OpenRouter' button to generate it using the prompt from Step 2.
    </p>
    <p class="text-gray-600 mb-2">
    <hr class="my-4"/>
      <strong>Prepare the Diff to Apply</strong>
      <br>
      This tool will split the diff into smaller parts to make it easier to apply.
    </p>

    <div class="my-4 grid grid-cols-1 md:grid-cols-2 gap-4">
      <div>
        <label for="openrouter-api-key" class="block text-sm font-bold text-gray-700 mb-1">OpenRouter API Key:</label>
        <input
          type="password"
          id="openrouter-api-key"
          v-model="localOpenRouterApiKey"
          class="w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 text-sm"
          placeholder="sk-or-..."
        />
      </div>
      <div>
        <label for="model-name" class="block text-sm font-bold text-gray-700 mb-1">Model Name:</label>
        <input
          type="text"
          id="model-name"
          v-model="localModelName"
          class="w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 text-sm"
          placeholder="e.g., openai/gpt-3.5-turbo"
        />
      </div>
    </div>

    <div class="my-4">
        <label for="final-prompt" class="block text-sm font-bold text-gray-700 mb-1">Final Prompt (from Step 2):</label>
        <textarea
          id="final-prompt"
          :value="props.finalPrompt"
          rows="5"
          class="w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 text-sm font-mono bg-gray-100"
          readonly
        ></textarea>
    </div>

    <div class="my-4">
      <button
        @click="fetchDiffFromOpenRouter"
        :disabled="isLoading || !localOpenRouterApiKey"
        class="px-4 py-2 mr-2 bg-green-600 text-white font-semibold rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-50 self-start disabled:bg-gray-400"
      >
        {{ isLoading ? 'Fetching Diff...' : 'Get Diff from OpenRouter' }}
      </button>
      <p v-if="errorMessage" class="text-red-500 text-sm mt-2">{{ errorMessage }}</p>
    </div>
    <div class="mb-4">
      <label for="shotgun-git-diff-input" class="block text-sm font-bold text-gray-700 mb-1">Git Diff Output:</label>
      <textarea
        id="shotgun-git-diff-input"
        v-model="localShotgunGitDiffInput"
        rows="15"
        class="w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 text-sm font-mono"
        placeholder="Paste the git diff output here, e.g., diff --git a/file.txt b/file.txt..."
      ></textarea>
    </div>

    <div class="mb-4">
      <label for="split-line-limit" class="block text-sm font-bold text-gray-700 mb-1">Approx. Lines per Split:</label>
      <p class="text-gray-600 mb-2 text-xs">
        ⓘ This will attempt to split the diff into the specified number of lines, while keeping the original structure and the hunks.
        The exact number of lines per split is not guaranteed, but the diff will be split into as many parts as possible.
        <br>
        Leave this unchanged if you don't want to split the diff.
      </p>
      <input
        type="number"
        id="split-line-limit"
        v-model.number="localSplitLineLimit"
        min="50"
        step="50"
        class="w-1/8 p-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 text-sm"
      />
      <p class="text-gray-600 mb-2 text-xs mt-2">
        Total number of lines: {{ shotgunGitDiffInputLines }} <a href="#" class="text-blue-500" title="Reset to this value" @click="resetSplitLineLimit">(reset to this value)</a>
      </p>
    </div>

    <button
      @click="handleSplitDiff"
      :disabled="!localShotgunGitDiffInput.trim() || localSplitLineLimit <= 0"
      class="px-6 py-2 bg-blue-600 text-white font-semibold rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 self-start disabled:bg-gray-400"
    >
      {{ localSplitLineLimit === shotgunGitDiffInputLines ? 'Proceed to Apply' : 'Split Diff & Proceed to Apply' }}
    </button>
  </div>
</template>

<script setup>
import { ref, defineEmits, watch, computed, onMounted, onBeforeUnmount } from 'vue';
import { LogInfo as LogInfoRuntime, LogError as LogErrorRuntime } from '../../../wailsjs/runtime/runtime';
import { CallOpenRouter } from '../../../wailsjs/go/main/App';

const emit = defineEmits(['action', 'update:shotgunGitDiff', 'update:splitLineLimit', 'update:openRouterApiKey']);

const props = defineProps({
  initialGitDiff: {
    type: String,
    default: ''
  },
  initialSplitLineLimit: {
    type: Number,
    default: 0
  },
  finalPrompt: {
    type: String,
    default: ''
  },
  openRouterApiKey: {
    type: String,
    default: ''
  }
});

const isLoading = ref(false);
const errorMessage = ref('');
const localShotgunGitDiffInput = ref(props.initialGitDiff);

const localOpenRouterApiKey = ref(props.openRouterApiKey);
const localModelName = ref('openai/gpt-3.5-turbo'); // Default model

const localSplitLineLimit = ref(props.initialSplitLineLimit > 0 ? props.initialSplitLineLimit : 500);

watch(() => props.openRouterApiKey, (newVal) => {
  if (newVal !== localOpenRouterApiKey.value) {
    localOpenRouterApiKey.value = newVal;
  }
});

watch(localOpenRouterApiKey, (newVal) => {
  emit('update:openRouterApiKey', newVal);
});


onMounted(() => {
    
  localShotgunGitDiffInput.value = props.initialGitDiff;
  localOpenRouterApiKey.value = props.openRouterApiKey;

    
  if (props.initialSplitLineLimit > 0) {
    localSplitLineLimit.value = props.initialSplitLineLimit;
  } else if (localSplitLineLimit.value <= 0) {
    localSplitLineLimit.value = 500;
  }
});

const shotgunGitDiffInputLines = computed(() => {
  return localShotgunGitDiffInput.value ? localShotgunGitDiffInput.value.split('\n').length : 0;
});

watch(() => props.initialGitDiff, (newVal, oldVal) => {
        if (newVal !== localShotgunGitDiffInput.value) {
                localShotgunGitDiffInput.value = newVal;
            }
});

watch(() => props.initialSplitLineLimit, (newVal, oldVal) => {
        if (newVal > 0 && newVal !== localSplitLineLimit.value) {
        localSplitLineLimit.value = newVal;
    } else if (newVal <= 0 && localSplitLineLimit.value !== 500 && props.initialGitDiff === '') {
        localSplitLineLimit.value = 500;
    }
});

let diffInputDebounceTimer = null;
watch(localShotgunGitDiffInput, (newVal, oldVal) => {
    
    clearTimeout(diffInputDebounceTimer);
    
    diffInputDebounceTimer = setTimeout(() => {
                if (newVal !== props.initialGitDiff) {
                        emit('update:shotgunGitDiff', newVal);
        } else {
                    }
        if (newVal && newVal.trim() !== '') {
            const lines = newVal.split('\n').length;
            const currentLimit = localSplitLineLimit.value;

            if (currentLimit === 500 || (currentLimit !== lines && currentLimit === (newVal.substring(0, newVal.length - (newVal.split('\n').pop().length +1)).split('\n').length))) {
                if (lines > 0 && lines !== currentLimit) {
                    localSplitLineLimit.value = lines;
                }
            } else if (lines === 0 && currentLimit !== 500){
                 localSplitLineLimit.value = 500;
            }
        } else if ((!newVal || newVal.trim() === '') && localSplitLineLimit.value !== 500) {
            localSplitLineLimit.value = 500;
        }
    }, 300);
});

let limitDebounceTimer = null;
watch(localSplitLineLimit, (newVal) => {
    clearTimeout(limitDebounceTimer);
    limitDebounceTimer = setTimeout(() => {
        if (newVal > 0 && newVal !== props.initialSplitLineLimit) { 
            emit('update:splitLineLimit', newVal);
        } else if (newVal <= 0 && props.initialSplitLineLimit > 0) {
        }
    }, 300);
});

onBeforeUnmount(() => {
    // Clear any pending debounced updates
  clearTimeout(diffInputDebounceTimer);
  clearTimeout(limitDebounceTimer);
  
  // Immediately emit the current value of localShotgunGitDiffInput if it's different from the prop
    if (localShotgunGitDiffInput.value !== props.initialGitDiff) {
        emit('update:shotgunGitDiff', localShotgunGitDiffInput.value);
  } else {
       }

  // Immediately emit the current value of localSplitLineLimit if it's valid and different from the prop
    if (localSplitLineLimit.value > 0 && localSplitLineLimit.value !== props.initialSplitLineLimit) {
        emit('update:splitLineLimit', localSplitLineLimit.value);
  } else {
      }
});

function handleSplitDiff() {
  if (!localShotgunGitDiffInput.value.trim() || localSplitLineLimit.value <= 0) {
    return;
  }
  emit('action', 'executePromptAndSplitDiff', {
    gitDiff: localShotgunGitDiffInput.value,
    lineLimit: localSplitLineLimit.value
  });
}

const resetSplitLineLimit = () => {
  if (shotgunGitDiffInputLines.value > 0) {
    localSplitLineLimit.value = shotgunGitDiffInputLines.value;
  } else {
    localSplitLineLimit.value = 500;
  }
};

const fetchDiffFromOpenRouter = async () => {
  LogInfoRuntime("fetchDiffFromOpenRouter called");
  isLoading.value = true;
  errorMessage.value = '';

  if (!localOpenRouterApiKey.value) {
    errorMessage.value = "OpenRouter API Key is not set. Please enter it above.";
    isLoading.value = false;
    LogErrorRuntime(errorMessage.value);
    return;
  }

  if (!props.finalPrompt) {
    errorMessage.value = "The prompt from Step 2 is empty.";
    isLoading.value = false;
    LogErrorRuntime(errorMessage.value);
    return;
  }

  const systemPrompt = "You are an AI assistant that generates Git diffs based on user requests. Ensure the output is only the diff in standard Git format, without any explanations or conversational text. Start the diff directly with 'diff --git ...' or the equivalent for the type of change requested.";

  try {
    LogInfoRuntime(`Calling OpenRouter with model: ${localModelName.value}, prompt: "${props.finalPrompt}"`);
    const response = await CallOpenRouter(localOpenRouterApiKey.value, localModelName.value, props.finalPrompt, systemPrompt);
    localShotgunGitDiffInput.value = response;
    LogInfoRuntime("Successfully fetched diff from OpenRouter.");
    // Automatically update line limit if the new diff has different line count
    const lines = response ? response.split('\n').length : 0;
    if (lines > 0 && lines !== localSplitLineLimit.value) {
        localSplitLineLimit.value = lines;
    } else if (lines === 0) {
        localSplitLineLimit.value = 500; // Reset to default if diff is empty
    }

  } catch (error) {
    const errorMsg = `Error fetching diff from OpenRouter: ${error}`;
    LogErrorRuntime(errorMsg);
    errorMessage.value = errorMsg;
  } finally {
    isLoading.value = false;
  }
};
</script> 