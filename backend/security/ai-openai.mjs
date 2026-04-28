export const providerName = 'openai';
export const requestContract = {
  route: 'POST /api/lumina/ai',
  schema: 'lumina-latex-ai-request-v1',
  secretLocation: 'backend environment only',
  requiredEnv: ['OPENAI_API_KEY']
};
