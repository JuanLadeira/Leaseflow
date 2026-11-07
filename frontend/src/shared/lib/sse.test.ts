import { createSseParser } from './sse'

describe('createSseParser', () => {
  it('parses frames split across arbitrary chunks', () => {
    const push = createSseParser()
    expect(push('event: delta\ndata: {"te')).toEqual([])
    expect(push('xt":"Hi"}\n\nevent: done\n')).toEqual([{ event: 'delta', data: '{"text":"Hi"}' }])
    expect(push('data: {}\n\n')).toEqual([{ event: 'done', data: '{}' }])
  })

  it('normalizes CRLF line endings', () => {
    const push = createSseParser()
    expect(push('event: delta\r\ndata: x\r\n\r\n')).toEqual([{ event: 'delta', data: 'x' }])
  })
})
