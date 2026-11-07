import { suggestionReducer, type SuggestionState } from './useReplySuggestion'

describe('suggestionReducer', () => {
  it('accumulates deltas only while streaming', () => {
    let state: SuggestionState = { status: 'idle' }
    state = suggestionReducer(state, { type: 'delta', text: 'ignored' })
    expect(state).toEqual({ status: 'idle' })
    state = suggestionReducer(state, { type: 'start' })
    state = suggestionReducer(state, { type: 'delta', text: 'Hello ' })
    state = suggestionReducer(state, { type: 'delta', text: 'there ' })
    state = suggestionReducer(state, { type: 'done', model: 'm' })
    expect(state).toEqual({ status: 'done', text: 'Hello there', model: 'm' })
  })

  it('keeps partial text when an error arrives mid-stream', () => {
    let state: SuggestionState = suggestionReducer({ status: 'idle' }, { type: 'start' })
    state = suggestionReducer(state, { type: 'delta', text: 'Partial' })
    state = suggestionReducer(state, { type: 'error', error: 'Stopped' })
    expect(state).toEqual({ status: 'error', text: 'Partial', error: 'Stopped' })
  })
})
