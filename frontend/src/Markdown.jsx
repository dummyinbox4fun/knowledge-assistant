import ReactMarkdown from 'react-markdown'

// Answers come from a model reading uploaded documents, so nothing in them is
// trusted: react-markdown never renders raw HTML, links open in a new tab
// without leaking the opener, and images are dropped (they would let a document
// make the browser fetch an address of its choosing).
const components = {
  p: (props) => <p className="my-2 first:mt-0 last:mb-0" {...stripNode(props)} />,
  ul: (props) => <ul className="my-2 list-disc space-y-1 pl-5" {...stripNode(props)} />,
  ol: (props) => <ol className="my-2 list-decimal space-y-1 pl-5" {...stripNode(props)} />,
  li: (props) => <li className="pl-0.5" {...stripNode(props)} />,
  strong: (props) => <strong className="font-semibold" {...stripNode(props)} />,
  em: (props) => <em className="italic" {...stripNode(props)} />,
  blockquote: (props) => (
    <blockquote
      className="my-2 border-l-4 border-slate-200 pl-3 text-slate-600"
      {...stripNode(props)}
    />
  ),
  // Headings become bold paragraphs so the page's own heading levels stay intact.
  h1: (props) => <p className="mb-1 mt-3 font-semibold" {...stripNode(props)} />,
  h2: (props) => <p className="mb-1 mt-3 font-semibold" {...stripNode(props)} />,
  h3: (props) => <p className="mb-1 mt-3 font-semibold" {...stripNode(props)} />,
  h4: (props) => <p className="mb-1 mt-3 font-semibold" {...stripNode(props)} />,
  h5: (props) => <p className="mb-1 mt-3 font-semibold" {...stripNode(props)} />,
  h6: (props) => <p className="mb-1 mt-3 font-semibold" {...stripNode(props)} />,
  hr: () => <hr className="my-3 border-slate-200" />,
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-indigo-600 underline hover:text-indigo-800"
    >
      {children}
    </a>
  ),
  pre: (props) => (
    <pre
      className="my-2 overflow-x-auto rounded-lg bg-slate-900 p-3 text-xs text-slate-100 [&>code]:bg-transparent [&>code]:p-0 [&>code]:text-inherit"
      {...stripNode(props)}
    />
  ),
  code: (props) => (
    <code className="rounded bg-slate-100 px-1 py-0.5 text-[0.85em]" {...stripNode(props)} />
  ),
  img: () => null,
}

// react-markdown passes its syntax-tree node to every component; it is not a DOM attribute.
// eslint-disable-next-line no-unused-vars
function stripNode({ node, ...rest }) {
  return rest
}

export default function Markdown({ children }) {
  return <ReactMarkdown components={components}>{children}</ReactMarkdown>
}
