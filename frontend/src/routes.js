// Which screen a URL shows. The app has four kinds of address:
//   /              a new, empty chat
//   /chat/<id>     a saved chat
//   /documents     the document library
//   /upload        the upload form
// Anything else is "unknown" and the app sends the user back to /.
export function parseRoute(pathname) {
  if (pathname === '/') return { view: 'chat', conversationId: null, known: true }
  if (pathname === '/documents') return { view: 'documents', conversationId: null, known: true }
  if (pathname === '/upload') return { view: 'upload', conversationId: null, known: true }

  const match = pathname.match(/^\/chat\/([^/]+)\/?$/)
  if (match) {
    try {
      return { view: 'chat', conversationId: decodeURIComponent(match[1]), known: true }
    } catch {
      // malformed %-escape in the address: treat like any unknown address
    }
  }
  return { view: 'chat', conversationId: null, known: false }
}
