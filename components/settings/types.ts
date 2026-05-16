export type SectionId = 'provider' | 'profile' | 'prompts' | 'avatars' | 'options' | 'tokens' | 'data';

export type TestConnectionState =
  | { status: 'idle' }
  | { status: 'testing' }
  | { status: 'ok'; latencyMs: number }
  | { status: 'failed'; message: string };
