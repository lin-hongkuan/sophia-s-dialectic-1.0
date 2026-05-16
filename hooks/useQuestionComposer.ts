import { useState, type FormEvent } from 'react';
import { generateQuestionSuggestions } from '../services/sophiaService';
import { reframeUserTopic, type ReframeCandidate } from '../services/topicReframe';
import { validateUserPrompt } from '../utils/inputValidation';
import type { ContinuationContext } from '../types/pipeline';

const DEFAULT_QUESTION_SUGGESTIONS = [
  '女性主义有道理吗？',
  '如何克服虚无主义？',
  '如何证明你不是缸中之脑？',
  '我们应该生孩子吗？',
  '为什么有性别不止有两个？',
];

const DIRECT_QUESTION_MARKERS = [
  '?',
  '？',
  '吗',
  '呢',
  '什么',
  '为什么',
  '为何',
  '如何',
  '怎么',
  '怎样',
  '是否',
  '能不能',
  '有没有',
  '该不该',
  '应不应该',
];

interface UseQuestionComposerOptions {
  topic: string;
  setTopic: (value: string) => void;
  activeRunIsRunning: boolean;
  startAnalysis: (nextTopic: string, continuationContext?: ContinuationContext, isPresetRegeneration?: boolean) => void;
}

const looksLikeDirectQuestion = (value: string): boolean => {
  const trimmed = value.trim();
  if (!trimmed) return false;
  return DIRECT_QUESTION_MARKERS.some((marker) => trimmed.includes(marker));
};

export const useQuestionComposer = ({
  topic,
  setTopic,
  activeRunIsRunning,
  startAnalysis,
}: UseQuestionComposerOptions) => {
  const [topicHint, setTopicHint] = useState<{ message: string; suggestions?: string[] } | null>(null);
  const [questionSuggestions, setQuestionSuggestions] = useState<string[]>(DEFAULT_QUESTION_SUGGESTIONS);
  const [isGeneratingSuggestions, setIsGeneratingSuggestions] = useState(false);
  const [suggestionError, setSuggestionError] = useState('');
  const [reframeState, setReframeState] = useState<{
    open: boolean;
    originalTopic: string;
    candidates: ReframeCandidate[];
    continuationContext?: ContinuationContext;
  } | null>(null);
  const [isReframing, setIsReframing] = useState(false);

  const setTopicAndClearHint = (value: string) => {
    setTopic(value);
    if (topicHint) setTopicHint(null);
  };

  const handleAnalyze = async (e?: FormEvent, explicitTopic?: string, continuationContext?: ContinuationContext) => {
    e?.preventDefault();
    const candidate = (explicitTopic || topic).trim();
    const validation = validateUserPrompt(candidate, { mode: 'topic' });
    if (!validation.ok) {
      setTopicHint({ message: validation.hint || '', suggestions: validation.suggestions });
      return;
    }
    setTopicHint(null);

    if (continuationContext || looksLikeDirectQuestion(candidate)) {
      startAnalysis(candidate, continuationContext);
      return;
    }

    if (isReframing) return;
    setIsReframing(true);
    try {
      const reframe = await reframeUserTopic(candidate);
      if (reframe.shouldReframe && reframe.candidates.length > 0) {
        setReframeState({
          open: true,
          originalTopic: candidate,
          candidates: reframe.candidates,
          continuationContext,
        });
        return;
      }
      startAnalysis(candidate, continuationContext);
    } finally {
      setIsReframing(false);
    }
  };

  const handleReframePick = (title: string) => {
    const trimmed = title.trim();
    if (!trimmed) return;
    setTopic(trimmed);
    setReframeState(null);
    startAnalysis(trimmed);
  };

  const handleReframeKeepOriginal = () => {
    if (!reframeState) return;
    const original = reframeState.originalTopic;
    setReframeState(null);
    startAnalysis(original, reframeState.continuationContext);
  };

  const handleReframeCancel = () => {
    setReframeState(null);
  };

  const handleGenerateQuestionSuggestions = async () => {
    if (activeRunIsRunning || isGeneratingSuggestions) return;

    setIsGeneratingSuggestions(true);
    setSuggestionError('');
    try {
      const generatedQuestions = await generateQuestionSuggestions(topic);
      if (generatedQuestions.length > 0) {
        setQuestionSuggestions(generatedQuestions);
      } else {
        setSuggestionError('这次没有生成出新问题，请稍后再试。');
      }
    } catch (error) {
      console.error('[Sophia] question suggestion generation failed:', error);
      setSuggestionError(error instanceof Error ? error.message : 'AI 暂时没有生成出问题。');
    } finally {
      setIsGeneratingSuggestions(false);
    }
  };

  return {
    topicHint,
    questionSuggestions,
    isGeneratingSuggestions,
    suggestionError,
    reframeState,
    isReframing,
    setTopicAndClearHint,
    handleAnalyze,
    handleReframePick,
    handleReframeKeepOriginal,
    handleReframeCancel,
    handleGenerateQuestionSuggestions,
  };
};
