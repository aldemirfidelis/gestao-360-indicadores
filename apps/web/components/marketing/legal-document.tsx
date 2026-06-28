import type { ReactNode } from 'react';

export interface LegalSection {
  title: string;
  paragraphs?: ReactNode[];
  items?: ReactNode[];
}

export function LegalDocument({
  version,
  updatedAt,
  sections,
}: {
  version: string;
  updatedAt: string;
  sections: LegalSection[];
}) {
  return (
    <section className="bg-white py-16">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <div className="mb-10 flex flex-wrap gap-x-6 gap-y-2 border-b border-slate-200 pb-5 text-sm text-slate-600">
          <span><strong className="text-slate-900">Versão:</strong> {version}</span>
          <span><strong className="text-slate-900">Última atualização:</strong> {updatedAt}</span>
        </div>
        <div className="space-y-10">
          {sections.map((section) => (
            <section key={section.title}>
              <h2 className="text-2xl font-semibold tracking-tight text-slate-950">{section.title}</h2>
              {section.paragraphs?.map((paragraph, index) => (
                <p key={index} className="mt-3 text-base leading-8 text-slate-700">{paragraph}</p>
              ))}
              {section.items && (
                <ul className="mt-4 list-disc space-y-2 pl-6 text-base leading-7 text-slate-700">
                  {section.items.map((item, index) => <li key={index}>{item}</li>)}
                </ul>
              )}
            </section>
          ))}
        </div>
      </div>
    </section>
  );
}
