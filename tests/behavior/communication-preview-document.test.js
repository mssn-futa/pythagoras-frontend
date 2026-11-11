import { describe, expect, test } from 'vitest'
import { buildPreviewDocument, PREVIEW_CSP } from '../../src/features/communication/editor/previewDocument.js'

const CSP = `<meta http-equiv="Content-Security-Policy" content="${PREVIEW_CSP}">`

describe('buildPreviewDocument', () => {
  test('wraps fragments with the app style', () => {
    const doc = buildPreviewDocument('<p>Hi</p>')
    expect(doc).toContain('<body><p>Hi</p></body>')
    expect(doc).toContain('padding:16px')
    expect(doc).toContain(CSP)
  })

  test('injects metas right after <head> of a full document, CSP first, no wrapper or app style', () => {
    const html = '<!DOCTYPE html>\n<html lang="en"><head data-x="1"><meta charset="utf-8"><title>A &amp; B</title></head><body style="margin:0"><p>Hi</p></body></html>'
    const doc = buildPreviewDocument(html)
    expect(doc.startsWith('<!DOCTYPE html>\n<html lang="en"><head data-x="1">' + CSP)).toBe(true)
    expect(doc).toContain('<meta name="referrer" content="no-referrer"><base target="_blank"><meta charset="utf-8"><title>A &amp; B</title>')
    expect(doc).toContain('<body style="margin:0"><p>Hi</p></body></html>')
    expect(doc).not.toContain('padding:16px')
    expect(doc.match(/<html/gi)).toHaveLength(1)
  })

  test('is case-insensitive and tolerates leading whitespace', () => {
    const doc = buildPreviewDocument('  \n<!doctype HTML><HTML><HEAD></HEAD><BODY>x</BODY></HTML>')
    expect(doc).toContain('<HEAD>' + CSP)
    expect(doc).not.toContain('padding:16px')
  })

  test('falls back to a new <head> after <html> when the document has none', () => {
    const doc = buildPreviewDocument('<!doctype html><html lang="en"><body>x</body></html>')
    expect(doc).toBe(`<!doctype html><html lang="en"><head>${CSP}<meta name="referrer" content="no-referrer"><base target="_blank"></head><body>x</body></html>`)
  })
})
