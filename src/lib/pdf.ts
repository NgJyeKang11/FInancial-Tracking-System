import { parseStatementRows, type PdfTextItem } from './pdfRows'

export type PdfProblem = 'password' | 'invalid' | 'no-text' | 'no-transactions'

/** An error with a reason the import dialog can turn into a helpful message. */
export class PdfImportError extends Error {
  readonly problem: PdfProblem

  constructor(problem: PdfProblem) {
    super(problem)
    this.problem = problem
  }
}

/**
 * Reads a PDF statement in the browser and returns its transactions as a CSV-style table
 * (header row first). pdf.js is loaded on demand so it doesn't weigh down the rest of the app.
 */
export async function readPdfStatement(file: File): Promise<string[][]> {
  const pdfjs = await import('pdfjs-dist')
  const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url')
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default

  const items: PdfTextItem[] = []
  try {
    const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise
    for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber++) {
      const content = await (await doc.getPage(pageNumber)).getTextContent()
      for (const item of content.items) {
        if (!('str' in item)) continue
        items.push({
          str: item.str,
          x: item.transform[4],
          y: item.transform[5],
          width: item.width,
          height: item.height,
          page: pageNumber,
        })
      }
    }
  } catch (error) {
    const name = error instanceof Error ? error.name : ''
    throw new PdfImportError(name === 'PasswordException' ? 'password' : 'invalid')
  }

  if (!items.some((i) => i.str.trim() !== '')) throw new PdfImportError('no-text')
  const table = parseStatementRows(items)
  if (table.length < 2) throw new PdfImportError('no-transactions')
  return table
}

export function describePdfProblem(problem: PdfProblem): string {
  switch (problem) {
    case 'password':
      return 'This PDF is password-protected. Remove the password (or download an unlocked copy from your bank) and try again.'
    case 'invalid':
      return "That file couldn't be opened as a PDF."
    case 'no-text':
      return "This PDF has no readable text, so it's probably a scan or photo. Download the statement as a CSV from your bank instead."
    case 'no-transactions':
      return "I couldn't find a table of transactions in this PDF. Its layout may be one I can't read yet. Try the CSV download from your bank instead."
  }
}
