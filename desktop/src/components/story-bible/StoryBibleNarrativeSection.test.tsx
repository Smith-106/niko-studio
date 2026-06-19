import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { StoryBibleNarrativeSection } from './StoryBibleNarrativeSection'

describe('StoryBibleNarrativeSection', () => {
  it('maps timeline mode changes to narrative or story', () => {
    const onDraftChange = vi.fn()

    render(
      <StoryBibleNarrativeSection
        variant="timeline"
        copy={{
          titleLabel: 'Title',
          titlePlaceholder: 'Enter title',
          summaryLabel: 'Summary',
          summaryPlaceholder: 'Enter summary',
          addLabel: 'Add',
          saveLabel: 'Save',
          activateLabel: 'Activate',
          activeLabel: 'Active',
          emptyLabel: 'Nothing here',
          modeLabel: 'Mode',
          modeStory: 'Story',
          modeNarrative: 'Narrative',
        }}
        draft={{
          recordId: null,
          title: 'Arc',
          summary: 'Summary',
          mode: 'story',
        }}
        saving={false}
        activeRecordId={null}
        items={[]}
        onSave={vi.fn()}
        onSelect={vi.fn()}
        onActivate={vi.fn()}
        onDraftChange={onDraftChange}
      />,
    )

    fireEvent.change(screen.getByRole('combobox'), {
      target: { value: 'narrative' },
    })
    expect(onDraftChange).toHaveBeenLastCalledWith({ mode: 'narrative' })

    fireEvent.change(screen.getByRole('combobox'), {
      target: { value: 'unexpected' },
    })
    expect(onDraftChange).toHaveBeenLastCalledWith({ mode: 'story' })
  })
})
