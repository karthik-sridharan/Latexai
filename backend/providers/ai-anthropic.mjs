export const providerName = 'anthropic';
export const requestContract = {
  route: 'POST /api/lumina/ai',
  schema: 'lumina-latex-ai-request-v1',
  secretLocation: 'backend environment only',
  requiredEnv: ['ANTHROPIC_API_KEY']
};
