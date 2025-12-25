export interface Philosopher {
  name: string;
  school: string; // e.g., "German Idealism"
  avatar_desc: string; // Description for image placeholder
  core_concept: string; // e.g., "Categorical Imperative"
  argument: string; // Their specific take on the user's issue
  quote: string; // A relevant quote (real or synthesized style)
}

export interface DialecticLayers {
  common_sense: {
    title: string;
    content: string;
    keywords: string[];
  };
  theoretical: {
    title: string;
    content: string;
    concepts: string[];
  };
  ontological: {
    title: string;
    content: string;
    question: string;
  };
}

export interface AnalysisResult {
  philosophical_title: string; // The "Big Question" version of the user input
  introduction: string;
  philosophers: Philosopher[];
  layers: DialecticLayers;
  reasoning_trace?: string[]; // To simulate the "Thinking Process"
}

export interface Message {
  role: 'user' | 'assistant';
  content: string;
}
