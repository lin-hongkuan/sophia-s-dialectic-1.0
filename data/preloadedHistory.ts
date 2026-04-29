import { HistoryEntry } from '../types';
import antinatalismAvatar from './reference-avatars/antinatalism-grok-imagine-image-lite.jpg';
import existentialismAvatar from './reference-avatars/existentialism-grok-imagine-image-lite.jpg';

const REFERENCE_AVATAR_STYLE = 'Sophia editorial portrait style: square museum-catalog avatar, warm ivory and charcoal palette, muted ink-wash texture, subtle paper grain, soft directional light, restrained philosophical atmosphere, elegant, non-cartoon, non-photorealistic, no text, no logos, no UI elements.';
const REFERENCE_AVATAR_MODEL = 'grok-imagine-image-lite';
const REFERENCE_AVATAR_GENERATED_AT = '2026-04-29T00:00:00.000Z';

const antinatalismAvatarPrompt = [
  REFERENCE_AVATAR_STYLE,
  'Subject: a fictional, representative thinker embodying the temperament of this school of thought; symbolic, archetypal, never a real person.',
  'Voice name (semantic anchor only, do NOT render as text): 反出生主义',
  'Voice kind: school',
  'Role in this analysis: 质询者',
  'Core concept: 未经同意的风险',
  'One-line stance: 让一个人来到世界，需要被证明是正当的。',
  'User question being analyzed: 我们应该生孩子吗？',
  'Big question: 在不确定的世界里，生育是一种责任、冒险，还是自我安慰？',
  'Analytical mode: 两难困境 + 圆桌辩论',
  'Mood / atmosphere: sober, ethically severe, withdrawn yet attentive; quiet weight of unresolved consent; ink-wash shadow tones with restrained ivory highlights.',
  'Composition: square 1:1 framing, head-and-shoulders or symbolic chest-up vignette, centered, soft directional light, calm museum-catalog atmosphere.',
  'no text, no Chinese characters, no captions, no titles, no logos, no watermark, no UI elements, no signature, avoid distorted facial features, avoid extra limbs, avoid celebrity photo likeness.',
].join('\n');

const existentialismAvatarPrompt = [
  REFERENCE_AVATAR_STYLE,
  'Subject: a fictional, representative thinker embodying the temperament of this school of thought; symbolic, archetypal, never a real person.',
  'Voice name (semantic anchor only, do NOT render as text): 存在主义',
  'Voice kind: school',
  'Role in this analysis: 辩护者',
  'Core concept: 意义的创造',
  'One-line stance: 生命没有预设保证，但意义可以在存在中被创造。',
  'User question being analyzed: 我们应该生孩子吗？',
  'Big question: 在不确定的世界里，生育是一种责任、冒险，还是自我安慰？',
  'Analytical mode: 两难困境 + 圆桌辩论',
  'Mood / atmosphere: lucid, resolute, quietly hopeful in the absence of guarantees; warm ivory light glancing off charcoal shadow; the figure poised on the edge of choice.',
  'Composition: square 1:1 framing, head-and-shoulders or symbolic chest-up vignette, centered, soft directional light, calm museum-catalog atmosphere.',
  'no text, no Chinese characters, no captions, no titles, no logos, no watermark, no UI elements, no signature, avoid distorted facial features, avoid extra limbs, avoid celebrity photo likeness.',
].join('\n');

export const PRELOADED_HISTORY_ENTRY: HistoryEntry = {
  id: 'preset-should-we-have-children',
  topic: '我们应该生孩子吗？',
  title: '在不确定的世界里，生育是一种责任、冒险，还是自我安慰？',
  mode: 'dilemma',
  modeLabel: '两难困境 + 圆桌辩论',
  createdAt: '2026-04-29T00:00:00.000Z',
  isPreset: true,
  result: {
    id: 'preset-should-we-have-children-result',
    createdAt: '2026-04-29T00:00:00.000Z',
    topic: '我们应该生孩子吗？',
    philosophical_title: '在不确定的世界里，生育是一种责任、冒险，还是自我安慰？',
    mode: 'dilemma',
    modeLabel: '两难困境 + 圆桌辩论',
    introduction: '本期要讨论的问题不是一句简单的“要不要生孩子”。它真正触及的是：当一个生命无法同意自己被带到世界上时，另一个人是否有资格替他开启人生？这既不是纯粹私人选择，也不是能被传统家庭伦理一笔带过的自然过程。它牵涉爱、责任、痛苦、希望、代际关系和人是否有权把风险交给另一个尚未存在的人。',
    questionFrame: {
      original: '我们应该生孩子吗？',
      bigQuestion: '把一个生命带进世界，是否需要被辩护？',
      plainTranslation: '我到底是在创造幸福的可能，还是把无法保证的风险交给另一个人？',
      keywords: ['反出生主义', '责任', '同意', '痛苦', '代际伦理'],
    },
    programStructure: [
      { id: 'section-1', title: '开题', description: '先把“要不要生”从私人偏好提升为伦理问题。' },
      { id: 'section-2', title: '两难', description: '生育既可能是爱的给予，也可能是不经同意的风险转移。' },
      { id: 'section-3', title: '圆桌', description: '让几种思想声音围绕同一个问题互相咬合。' },
      { id: 'section-4', title: '收束', description: '不替用户裁决，而是整理每种立场要求你承担的代价。' },
    ],
    routeMap: [
      {
        id: 'route-1',
        title: '直觉答案',
        role: '开场',
        plain: '许多人会说，生孩子当然是个人选择。只要父母愿意承担责任、给孩子爱和照顾，别人没有资格干涉。',
        philosophical: '但哲学问题恰恰从这里开始：一个决定越是影响另一个人的全部人生，它就越难被简单归入私人偏好。',
        tension: '私人自由与对未出生者的责任发生冲突。',
      },
      {
        id: 'route-2',
        title: '问题开始摇晃',
        role: '反例',
        plain: '孩子无法同意来到世界，也无法提前知道自己会面对什么样的痛苦、家庭和时代。',
        philosophical: '同意原则在这里失效了：最受影响的人无法参与决定，而决定者却以爱、传统或希望为理由替他开启人生。',
        nextQuestion: '不能同意的生命，是否就不能被创造？',
      },
      {
        id: 'route-3',
        title: '两难形成',
        role: '分歧',
        plain: '如果不生，我们似乎否定了生命的可能；如果生，我们又把不确定的风险交给了孩子。',
        philosophical: '这不是“悲观还是乐观”的争论，而是对生命价值、苦难权重和父母责任边界的争论。',
      },
    ],
    voices: [
      {
        id: 'voice-1',
        name: '反出生主义',
        kind: 'school',
        role: '质询者',
        coreConcept: '未经同意的风险',
        oneLine: '让一个人来到世界，需要被证明是正当的。',
        stance: '生育不是默认正当，而是需要承担伦理辩护。',
        thesis: '如果生命不可避免包含痛苦，那么创造生命就不能只凭父母愿望来正当化。',
        critique: '它会被批评为过度放大痛苦，低估生命中积极经验的价值。',
        argument: '反出生主义首先会把这个问题从“父母想不想要孩子”扭转为“孩子是否有理由被带到世界”。它不否认许多父母真诚地爱孩子，也不否认生命中可能有快乐、亲密和创造，但它会追问：这些好处能不能替代那个最根本的事实——孩子本人没有同意出生。生育的特殊之处在于，受影响最大的人无法参与决定，而决定一旦发生，他就必须承担整个生命过程中的疾病、焦虑、失败、孤独和死亡。反出生主义因此认为，生育不是一个自然到无需辩护的行为，而是一个把风险交给他人的行为。它最尖锐的地方在于拒绝把“生命通常值得活”当成前提。父母可能说，我会尽力给孩子幸福；但反出生主义会说，尽力并不等于保证，而你没有权利替另一个人押下这场赌注。它对传统家庭伦理的批判也在这里：许多文化把生育包装成责任、延续、孝道或爱，但这些词常常掩盖了孩子作为独立主体的处境。孩子不是父母意义感的容器，也不是家族延续的工具。如果一个人必须通过制造另一个生命来完成自己的人生，那这个生命从一开始就背负了不属于他的目的。当然，接受反出生主义也要付出代价：你必须承认许多被视为温暖、自然、神圣的家庭叙事都需要重新审判。它会让人变得冷峻，甚至显得不近人情。但它的价值正在于迫使我们停止把“生”当作默认善，而把它重新放回伦理审判席。',
        summaryForSynthesis: '反出生主义认为生育是未经同意地把风险交给另一个生命，因此需要被辩护。它强调痛苦、死亡和不可撤销性，挑战传统家庭伦理对生育的默认正当化。',
        avatar: {
          imageUrl: antinatalismAvatar,
          prompt: antinatalismAvatarPrompt,
          style: REFERENCE_AVATAR_STYLE,
          model: REFERENCE_AVATAR_MODEL,
          alt: '反出生主义思想声音的方形博物馆目录式头像，象征性虚构思想者。',
          generatedAt: REFERENCE_AVATAR_GENERATED_AT,
          subjectType: 'school',
        },
        status: 'completed',
      },
      {
        id: 'voice-2',
        name: '存在主义',
        kind: 'school',
        role: '辩护者',
        coreConcept: '意义的创造',
        oneLine: '生命没有预设保证，但意义可以在存在中被创造。',
        stance: '不能因为生命没有保证，就否定生命的可能性。',
        thesis: '人不是被给予意义的物，而是在不确定中创造意义的存在。',
        critique: '它会被批评为把孩子未来的负担浪漫化为自由。',
        argument: '存在主义会承认反出生主义提出了一个真实难题：没有人能替孩子保证幸福，也没有人能证明一个尚未出生者必然会感谢自己的出生。但存在主义不会因此得出生育必然不正当的结论。因为在存在主义看来，人的生命并不是一件需要先有保证书才值得开启的产品。人之所以为人，恰恰在于他不是被一个固定本质预先定义的东西，而是在世界中通过选择、行动、关系和承担逐渐成为自己。生育当然把一个生命带入风险，但它也把一个生命带入可能性。问题不是父母能不能预先证明孩子的一生将幸福，而是他们是否愿意承认这个生命不是自己的附属品，并为他打开尽可能真实的自由空间。存在主义会批评反出生主义过于把痛苦当成压倒性证据，好像只要生命中有不可避免的痛苦，生命就不该开始。但如果这样理解人生，我们就把生命看成一场必须净收益为正才值得参与的交易。存在主义不接受这种账本式人生观。人的尊严不在于免于痛苦，而在于即使没有预设意义，也仍能在处境中作出选择。可是，存在主义也会给父母施加很重的判断压力：你不能一边说生命的意义要由孩子自己创造，一边又用自己的期待、焦虑和未完成愿望去替他规定道路。真正存在主义式的生育，不是“我需要一个孩子来完成我的人生”，而是“我愿意迎接一个终将离开我、反驳我、成为他自己的自由存在”。这比传统意义上的养育更难，因为它要求父母不把孩子当答案，而把孩子当成另一个问题。',
        summaryForSynthesis: '存在主义承认生命没有保证，但认为意义不是出生前可证明的东西，而是在存在中被创造的。它要求父母尊重孩子作为自由存在，而不是把孩子当作自身意义的工具。',
        avatar: {
          imageUrl: existentialismAvatar,
          prompt: existentialismAvatarPrompt,
          style: REFERENCE_AVATAR_STYLE,
          model: REFERENCE_AVATAR_MODEL,
          alt: '存在主义思想声音的方形博物馆目录式头像，象征性虚构思想者。',
          generatedAt: REFERENCE_AVATAR_GENERATED_AT,
          subjectType: 'school',
        },
        status: 'completed',
      },
    ],
    tensions: [
      {
        id: 'tension-1',
        title: '争的是“生命是否需要被同意”',
        content: '反出生主义把无法同意视为生育的根本问题；存在主义则认为，生命不是合同，不能用事前同意完全衡量。两者真正分歧不在于爱不爱孩子，而在于生命是否必须先被证明安全，才有资格开始。',
        relatedVoiceIds: ['voice-1', 'voice-2'],
      },
    ],
    keywords: [
      {
        id: 'keyword-1',
        term: '同意',
        meaning: '一个决定是否需要当事人的认可。',
        importance: '孩子无法同意出生，所以生育的伦理性质变得尖锐。',
      },
      {
        id: 'keyword-2',
        term: '可能性',
        meaning: '生命不是已经写好的剧本，而是尚未展开的开放过程。',
        importance: '存在主义用可能性回应反出生主义对风险的强调。',
      },
    ],
    followUps: [
      { id: 'follow-1', question: '如果孩子未来很幸福，出生是否就被证明正当？', reason: '这会检验结果能否反过来正当化最初的决定。' },
      { id: 'follow-2', question: '父母的爱能不能弥补未经同意的出生？', reason: '这会把问题带回亲密关系和责任。' },
    ],
    conclusion: {
      summary: '这场争论没有一个轻松答案。反出生主义迫使我们承认，生育不是天然无辜的自然事件，而是一个把风险交给他人的伦理决定。存在主义则提醒我们，生命并不是必须先获得担保才值得展开；人的意义常常是在没有保证的处境中被创造出来的。二者的分歧，不在于要不要爱孩子，而在于爱是否足以承担一个生命的不可撤销性。',
      openQuestion: '当你无法替另一个生命保证幸福时，你凭什么仍然把他带进世界？',
      realLifeReturn: '如果这个问题最终落回现实，它要求的也许不是一个统一答案，而是一种更诚实的父母意识：不要把孩子当作传统、养老、意义感或自我修复的工具。',
    },
    reasoning_trace: ['识别为两难困境', '建立生育伦理的问题框架', '选择反出生主义与存在主义作为核心冲突', '生成会议总结'],
  },
};
