import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import OpenRouterPanel from '../OpenRouterPanel.vue'; // Adjust path as necessary

// Mock Wails Go functions
const mockCallOpenRouter = vi.fn();

vi.mock('../../../wailsjs/go/main/App', () => ({ // Adjusted path for mocks
  CallOpenRouter: mockCallOpenRouter,
}));

describe('OpenRouterPanel.vue', () => {
  beforeEach(() => {
    // Reset mocks before each test
    mockCallOpenRouter.mockReset();
  });

  it('Renders correctly and does not display inputText', () => {
    const wrapper = mount(OpenRouterPanel, {
      props: {
        inputText: 'Sample input text for testing',
      },
    });

    // Check for presence of key input elements
    expect(wrapper.find('input[type="password"]#apiKey').exists()).toBe(true);
    expect(wrapper.find('input[type="text"]#modelName').exists()).toBe(true);
    expect(wrapper.find('textarea#systemPrompt').exists()).toBe(true);
    expect(wrapper.find('button').exists()).toBe(true);
    expect(wrapper.find('button').text()).toContain('Get Suggestions');

    // Assert that the display area for inputText is not present
    // This checks if the <pre class="diff-display"> or similar structure is gone
    expect(wrapper.find('pre.diff-display').exists()).toBe(false);
    // Or more generally, check if the inputText prop is rendered anywhere directly (it shouldn't be)
    expect(wrapper.html()).not.toContain('Sample input text for testing');
  });

  it('Calls CallOpenRouter and emits llm-success on successful API call', async () => {
    mockCallOpenRouter.mockResolvedValue('Mocked LLM suggestion');
    const wrapper = mount(OpenRouterPanel, {
      props: {
        inputText: 'Detailed diff or prompt text',
      },
    });

    await wrapper.find('input[type="password"]#apiKey').setValue('test-api-key');
    await wrapper.find('input[type="text"]#modelName').setValue('test-model');
    await wrapper.find('button').trigger('click');

    expect(mockCallOpenRouter).toHaveBeenCalledTimes(1);
    expect(mockCallOpenRouter).toHaveBeenCalledWith(
      'test-api-key',
      'test-model',
      'Detailed diff or prompt text', // Expecting props.inputText
      wrapper.vm.systemPrompt // Default system prompt or whatever is set
    );

    expect(wrapper.emitted()['llm-success']).toBeTruthy();
    expect(wrapper.emitted()['llm-success'][0]).toEqual(['Mocked LLM suggestion']);
  });

  it('Calls CallOpenRouter and emits llm-error on failed API call', async () => {
    const MOCK_ERROR_MESSAGE = 'API call failed';
    mockCallOpenRouter.mockRejectedValue(new Error(MOCK_ERROR_MESSAGE));
    const wrapper = mount(OpenRouterPanel, {
      props: {
        inputText: 'Some input',
      },
    });

    await wrapper.find('input[type="password"]#apiKey').setValue('test-api-key');
    // No need to set modelName if it has a default and isn't part of this test's core logic
    await wrapper.find('button').trigger('click');

    expect(mockCallOpenRouter).toHaveBeenCalledTimes(1);
    expect(wrapper.emitted()['llm-error']).toBeTruthy();
    // The error message emitted includes "Failed to get suggestions: " prefix
    expect(wrapper.emitted()['llm-error'][0][0]).toContain(MOCK_ERROR_MESSAGE);
    // Check if the error message is also displayed in the component
    expect(wrapper.find('.error-message').exists()).toBe(true);
    expect(wrapper.find('.error-message').text()).toContain(MOCK_ERROR_MESSAGE);
  });

  it('Button is disabled if API key is missing, enabled when provided', async () => {
    const wrapper = mount(OpenRouterPanel, {
      props: {
        inputText: 'Some input text', // inputText must be present for button to be enabled
      }
    });

    // Initially, API key is empty
    const button = wrapper.find('button');
    expect(button.attributes('disabled')).toBeDefined(); // Or .toBe('') depending on how Vue handles boolean attributes

    // Simulate entering an API key
    await wrapper.find('input[type="password"]#apiKey').setValue('test-api-key');

    // Button should now be enabled as API key and inputText are present
    expect(button.attributes('disabled')).toBeUndefined();
  });

  // TODO: Test for when inputText prop is missing - button should be disabled.
  // TODO: Test for loading state display on button while API call is in progress.
});
