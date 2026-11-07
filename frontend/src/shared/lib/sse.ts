export interface SseEvent {
  event: string
  data: string
}

/**
 * Incremental Server-Sent Events parser. Network chunks can split a frame
 * anywhere, so we keep the unfinished tail in a buffer between calls.
 */
export function createSseParser() {
  let buffer = ''
  return function push(chunk: string): SseEvent[] {
    buffer += chunk.replace(/\r\n/g, '\n')
    const frames = buffer.split('\n\n')
    buffer = frames.pop() ?? ''
    return frames.flatMap((frame) => {
      let event = 'message'
      const data: string[] = []
      for (const line of frame.split('\n')) {
        if (line.startsWith('event:')) event = line.slice(6).trim()
        else if (line.startsWith('data:')) data.push(line.slice(5).trimStart())
      }
      return data.length ? [{ event, data: data.join('\n') }] : []
    })
  }
}
