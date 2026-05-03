const strategy = strategize(message, history.map(h => h.content));
const instruction = buildStrategyInstruction(strategy.type);

const systemParts = [
  AXIS_SYSTEM_PROMPT,
  VOICE_BEHAVIOR,
  instruction,
  knowledgeContext
];