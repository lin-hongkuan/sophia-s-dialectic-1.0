import type { AnalysisResult } from '../types/domain';

const clean = (value?: string | null) => (value || '').trim();
const controlCharsPattern = new RegExp('[\\u0000-\\u001f]', 'g');

const bulletList = (items: string[]) => items
  .map(clean)
  .filter(Boolean)
  .map((item) => `- ${item}`)
  .join('\n');

const section = (title: string, content: string) => {
  const body = clean(content);
  return body ? `## ${title}\n\n${body}` : '';
};

const subsection = (title: string, content: string) => {
  const body = clean(content);
  return body ? `### ${title}\n\n${body}` : '';
};

const formatDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('zh-CN');
};

const formatQuestionFrame = (result: AnalysisResult) => [
  subsection('原始困惑', result.questionFrame.original),
  subsection('核心问题', result.questionFrame.bigQuestion),
  subsection('现实翻译', result.questionFrame.plainTranslation),
  result.questionFrame.keywords.length > 0 ? subsection('关键词', bulletList(result.questionFrame.keywords)) : '',
].filter(Boolean).join('\n\n');

const formatKeywords = (result: AnalysisResult) => result.keywords
  .map((keyword) => [
    `### ${keyword.term}`,
    clean(keyword.meaning),
    clean(keyword.importance) ? `重要性：${clean(keyword.importance)}` : '',
  ].filter(Boolean).join('\n\n'))
  .join('\n\n');

const formatProgramStructure = (result: AnalysisResult) => result.programStructure
  .map((item, index) => `${index + 1}. ${item.title}\n\n${clean(item.description)}`)
  .join('\n\n');

const formatRouteMap = (result: AnalysisResult) => result.routeMap
  .map((node, index) => [
    `### ${index + 1}. ${node.title}`,
    clean(node.role) ? `角色：${clean(node.role)}` : '',
    clean(node.plain),
    clean(node.philosophical) ? `哲学表述：${clean(node.philosophical)}` : '',
    clean(node.tension) ? `张力：${clean(node.tension)}` : '',
    clean(node.nextQuestion) ? `下一问：${clean(node.nextQuestion)}` : '',
  ].filter(Boolean).join('\n\n'))
  .join('\n\n');

const formatThoughtVoices = (result: AnalysisResult) => result.voices
  .filter((voice) => voice.status !== 'queued' && voice.status !== 'generating' && voice.status !== 'failed')
  .map((voice, index) => {
    const meta = [
      clean(voice.school) ? `- 谱系：${clean(voice.school)}` : '',
      clean(voice.role) ? `- 身份：${clean(voice.role)}` : '',
      clean(voice.coreConcept) ? `- 核心概念：${clean(voice.coreConcept)}` : '',
      clean(voice.oneLine) ? `- 一句话立场：${clean(voice.oneLine)}` : '',
      clean(voice.stance) ? `- 立场：${clean(voice.stance)}` : '',
      clean(voice.diagnosis) ? `- 诊断：${clean(voice.diagnosis)}` : '',
      clean(voice.prescription) ? `- 处方：${clean(voice.prescription)}` : '',
      clean(voice.thesis) ? `- 主张：${clean(voice.thesis)}` : '',
      clean(voice.critique) ? `- 批评：${clean(voice.critique)}` : '',
      clean(voice.addedByUserPrompt) ? `- 用户追加：${clean(voice.addedByUserPrompt)}` : '',
      clean(voice.addedAt) ? `- 追加时间：${formatDate(voice.addedAt || '')}` : '',
    ].filter(Boolean).join('\n');

    return [
      `### ${index + 1}. ${voice.name}`,
      meta,
      clean(voice.argument),
      clean(voice.quote) ? `> ${clean(voice.quote)}` : '',
      voice.challenges?.length ? `挑战：\n${bulletList(voice.challenges)}` : '',
      clean(voice.summaryForSynthesis) ? `综合摘要：\n${clean(voice.summaryForSynthesis)}` : '',
    ].filter(Boolean).join('\n\n');
  })
  .join('\n\n');

const formatTensions = (result: AnalysisResult) => result.tensions
  .map((tension, index) => `### ${index + 1}. ${tension.title}\n\n${clean(tension.content)}`)
  .join('\n\n');

const formatConclusion = (result: AnalysisResult) => [
  clean(result.conclusion.summary),
  clean(result.conclusion.openQuestion) ? `### 仍然悬着的问题\n\n${clean(result.conclusion.openQuestion)}` : '',
  clean(result.conclusion.realLifeReturn) ? `### 回到现实\n\n${clean(result.conclusion.realLifeReturn)}` : '',
].filter(Boolean).join('\n\n');

const formatFollowUps = (result: AnalysisResult) => result.followUps
  .map((followUp, index) => [
    `${index + 1}. ${followUp.question}`,
    clean(followUp.reason) ? `   - ${clean(followUp.reason)}` : '',
  ].filter(Boolean).join('\n'))
  .join('\n');

const formatDiagnosisFrame = (result: AnalysisResult) => {
  const frame = result.diagnosisFrame;
  if (!frame) return '';

  const doctors = frame.doctors.map((doctor, index) => [
    `### ${index + 1}. 诊断声音`,
    clean(doctor.diagnosis) ? `诊断：${clean(doctor.diagnosis)}` : '',
    clean(doctor.prescription) ? `处方：${clean(doctor.prescription)}` : '',
  ].filter(Boolean).join('\n\n')).join('\n\n');

  return [
    clean(frame.symptomTitle),
    frame.symptoms.length ? `症状：\n${bulletList(frame.symptoms)}` : '',
    clean(frame.framing) ? `框定方式：\n${clean(frame.framing)}` : '',
    doctors,
  ].filter(Boolean).join('\n\n');
};

const formatThoughtExperiment = (result: AnalysisResult) => {
  const frame = result.thoughtExperiment;
  if (!frame) return '';

  const responses = frame.responseMap.map((item, index) => `${index + 1}. ${clean(item.route)}`).join('\n');

  return [
    clean(frame.poeticVersion) ? `诗性版本：\n${clean(frame.poeticVersion)}` : '',
    clean(frame.unsettlingVersion) ? `不安版本：\n${clean(frame.unsettlingVersion)}` : '',
    clean(frame.coreChallenge) ? `核心挑战：\n${clean(frame.coreChallenge)}` : '',
    clean(frame.stakes) ? `利害关系：\n${clean(frame.stakes)}` : '',
    responses ? `回应路线：\n${responses}` : '',
  ].filter(Boolean).join('\n\n');
};

const formatSeminarMatrix = (result: AnalysisResult) => {
  const matrix = result.seminarMatrix;
  if (!matrix) return '';

  const cells = matrix.cells.map((cell, index) => [
    `${index + 1}. ${cell.label}`,
    `事实选项：${cell.factualOption}`,
    `价值选项：${cell.valueOption}`,
    clean(cell.description),
  ].filter(Boolean).join('\n')).join('\n\n');

  return [
    clean(matrix.factualQuestion) ? `事实问题：${clean(matrix.factualQuestion)}` : '',
    clean(matrix.valueQuestion) ? `价值问题：${clean(matrix.valueQuestion)}` : '',
    matrix.factualOptions.length ? `事实选项：\n${bulletList(matrix.factualOptions)}` : '',
    matrix.valueOptions.length ? `价值选项：\n${bulletList(matrix.valueOptions)}` : '',
    cells,
  ].filter(Boolean).join('\n\n');
};

export const buildResultMarkdown = (result: AnalysisResult) => [
  `# ${result.philosophical_title}`,
  [
    `- 原始问题：${result.topic}`,
    `- 模式：${result.modeLabel}`,
    `- 生成时间：${formatDate(result.createdAt)}`,
  ].join('\n'),
  section('导言', result.introduction),
  section('问题图谱', formatQuestionFrame(result)),
  result.keywords.length ? section('概念标记', formatKeywords(result)) : '',
  result.programStructure.length ? section('阅读路径', formatProgramStructure(result)) : '',
  result.diagnosisFrame ? section('诊断框架', formatDiagnosisFrame(result)) : '',
  result.thoughtExperiment ? section('思想实验', formatThoughtExperiment(result)) : '',
  result.seminarMatrix ? section('研讨矩阵', formatSeminarMatrix(result)) : '',
  result.routeMap.length ? section('论证路线图', formatRouteMap(result)) : '',
  result.voices.length ? section('思想声音', formatThoughtVoices(result)) : '',
  result.tensions.length ? section('分歧焦点', formatTensions(result)) : '',
  result.conclusion.summary ? section('暂时的合流', formatConclusion(result)) : '',
  result.followUps.length ? section('后续追问', formatFollowUps(result)) : '',
].filter(Boolean).join('\n\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';

export const copyMarkdown = async (content: string): Promise<boolean> => {
  try {
    if (!navigator.clipboard?.writeText) return false;
    await navigator.clipboard.writeText(content);
    return true;
  } catch {
    return false;
  }
};

export const downloadMarkdown = (filename: string, content: string): boolean => {
  try {
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    return true;
  } catch {
    return false;
  }
};

export const buildMarkdownFilename = (result: AnalysisResult) => {
  const date = result.createdAt.slice(0, 10) || new Date().toISOString().slice(0, 10);
  const base = clean(result.philosophical_title) || clean(result.topic) || 'analysis';
  const safeBase = base
    .replace(/[<>:"/\\|?*]/g, '-')
    .replace(controlCharsPattern, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80) || 'analysis';

  return `sophia-${safeBase}-${date}.md`;
};
