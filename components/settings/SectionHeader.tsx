import React from 'react';

export const SectionHeader: React.FC<{ icon: React.ReactNode; title: string; description?: string }> = ({ icon, title, description }) => (
  <div className="mb-4 flex items-start gap-3">
    <div className="mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded-full border border-museum-300/80 bg-museum-50 text-museum-700">
      {icon}
    </div>
    <div className="min-w-0 flex-1">
      <h2 className="font-serif text-xl text-museum-900">{title}</h2>
      {description && <p className="mt-1 text-[13px] leading-relaxed text-museum-600">{description}</p>}
    </div>
  </div>
);
