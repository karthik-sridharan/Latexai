export const providerName = 'gemini';
export const requestContract = {
  route: 'POST /api/lumina/ai',
  schema: 'lumina-latex-ai-request-v1',
  secretLocation: 'backend environment only',
  requiredEnv: ['GEMINI_API_KEY', 'GOOGLE_API_KEY', 'GOOGLE_GENERATIVE_AI_API_KEY', 'GOOGLE_AI_API_KEY']
};
