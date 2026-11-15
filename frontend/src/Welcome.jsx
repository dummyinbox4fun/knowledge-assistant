import { ChatIcon, FolderIcon, UploadIcon } from './icons'

export default function Welcome({ summary, onNavigate, onAsk }) {
  const cards = [
    {
      id: 'upload',
      title: 'Upload a document',
      text: 'Drop in a .md, .txt or .pdf file and it becomes searchable in seconds.',
      tag: 'Get started',
      tint: 'bg-indigo-50 text-indigo-600',
      Icon: UploadIcon,
      onClick: () => onNavigate('upload'),
    },
    {
      id: 'ask',
      title: 'Ask your notes',
      text: 'Get answers grounded in your own documents, with the sources shown.',
      tag: 'Chat',
      tint: 'bg-emerald-50 text-teal-700',
      Icon: ChatIcon,
      onClick: onAsk,
    },
    {
      id: 'library',
      title: 'Browse your library',
      text: summary,
      extra: 'Open any file to read its chunks.',
      tag: 'Library',
      tint: 'bg-orange-50 text-amber-700',
      Icon: FolderIcon,
      onClick: () => onNavigate('documents'),
    },
  ]

  return (
    <div>
      <h1 className="text-3xl font-semibold leading-tight tracking-tight sm:text-4xl md:text-[42px] md:short:text-[30px]">
        <span className="text-indigo-600">Hi there,</span>
        <br />
        What are you looking for in your notes?
      </h1>

      <div className="mt-6 grid gap-3 md:mt-10 md:grid-cols-3 md:gap-4 md:short:mt-5">
        {cards.map(({ id, title, text, extra, tag, tint, Icon, onClick }) => (
          <button
            key={id}
            type="button"
            onClick={onClick}
            className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 text-left text-slate-900 shadow-sm hover:border-indigo-300 hover:bg-white md:min-h-48 md:flex-col md:items-start md:gap-2.5 md:p-5 md:short:min-h-0 md:short:gap-2 md:short:p-4"
          >
            <span
              className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl md:short:h-9 md:short:w-9 ${tint}`}
            >
              <Icon size={22} />
            </span>
            <span className="block">
              <span className="block text-base font-semibold leading-snug">{title}</span>
              <span className="mt-1 block text-sm font-normal leading-relaxed text-slate-600">
                {text}
                {extra && <span className="hidden md:inline md:short:hidden"> {extra}</span>}
              </span>
            </span>
            <span className="mt-auto hidden text-xs font-normal text-slate-500 md:block md:short:hidden">
              {tag}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}