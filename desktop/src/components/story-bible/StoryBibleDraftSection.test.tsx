import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import {
  StoryBibleDraftSection,
  type StoryBibleStyleOption,
} from './StoryBibleDraftSection'

describe('StoryBibleDraftSection', () => {
  it('handles genre preset toggles, custom input, enter submit, and chip removal', () => {
    const onGenreInputChange = vi.fn()
    const onToggleGenre = vi.fn()
    const onAddCustomGenre = vi.fn()

    render(
      <StoryBibleDraftSection
        variant="genre"
        genrePresets={['Fantasy', 'Mystery']}
        genres={['Fantasy', 'Custom Genre']}
        genreInput="Noir"
        genrePlaceholder="Add genre"
        onGenreInputChange={onGenreInputChange}
        onToggleGenre={onToggleGenre}
        onAddCustomGenre={onAddCustomGenre}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Fantasy' }))
    expect(onToggleGenre).toHaveBeenCalledWith('Fantasy')

    fireEvent.change(screen.getByLabelText('Add genre'), {
      target: { value: 'Sci-Fi' },
    })
    expect(onGenreInputChange).toHaveBeenCalledWith('Sci-Fi')

    fireEvent.keyDown(screen.getByLabelText('Add genre'), { key: 'Enter' })
    expect(onAddCustomGenre).toHaveBeenCalledTimes(1)

    const chip = screen.getByText('Custom Genre').closest('span') as HTMLElement
    fireEvent.click(within(chip).getByRole('button'))
    expect(onToggleGenre).toHaveBeenCalledWith('Custom Genre')
  })

  it('handles braindump and synopsis input flows', () => {
    const onBraindumpChange = vi.fn()
    const onSynopsisChange = vi.fn()
    const onPromote = vi.fn()

    const { rerender } = render(
      <StoryBibleDraftSection
        variant="braindump"
        hint="Drop raw notes here"
        value="Initial notes"
        label="Braindump"
        onChange={onBraindumpChange}
      />,
    )

    fireEvent.change(screen.getByLabelText('Braindump'), {
      target: { value: 'Updated raw notes' },
    })
    expect(onBraindumpChange).toHaveBeenCalledWith('Updated raw notes')

    rerender(
      <StoryBibleDraftSection
        variant="synopsis"
        value="Initial synopsis"
        placeholder="Synopsis"
        promotionHint="Promote once it is ready"
        promoteLabel="Promote"
        promoteLoadingLabel="Promoting"
        canPromote
        promoting={false}
        actionIcon={<span>!</span>}
        onChange={onSynopsisChange}
        onPromote={onPromote}
      />,
    )

    fireEvent.change(screen.getByLabelText('Synopsis'), {
      target: { value: 'Updated synopsis' },
    })
    expect(onSynopsisChange).toHaveBeenCalledWith('Updated synopsis')

    fireEvent.click(screen.getByRole('button', { name: /Promote/i }))
    expect(onPromote).toHaveBeenCalledTimes(1)

    rerender(
      <StoryBibleDraftSection
        variant="synopsis"
        value="Updated synopsis"
        placeholder="Synopsis"
        promotionHint="Promote once it is ready"
        promoteLabel="Promote"
        promoteLoadingLabel="Promoting"
        canPromote
        promoting
        actionIcon={<span>!</span>}
        onChange={onSynopsisChange}
        onPromote={onPromote}
      />,
    )

    expect(screen.getByRole('button', { name: /Promoting/i })).toBeDisabled()
  })

  it('handles style selection and outline updates', () => {
    const onSelectStyle = vi.fn()
    const onOutlineChange = vi.fn()
    const styles: readonly StoryBibleStyleOption[] = [
      { id: 'tried', icon: <span>1</span>, label: 'Tried', desc: 'Keep current voice' },
      { id: 'soundsLike', icon: <span>2</span>, label: 'Sounds like', desc: 'Match another style' },
    ]

    const { rerender } = render(
      <StoryBibleDraftSection
        variant="style"
        styles={styles}
        selectedStyle="tried"
        onSelectStyle={onSelectStyle}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /Sounds like/i }))
    expect(onSelectStyle).toHaveBeenCalledWith('soundsLike')

    rerender(
      <StoryBibleDraftSection
        variant="outline"
        value="Act 1"
        placeholder="Outline"
        onChange={onOutlineChange}
      />,
    )

    fireEvent.change(screen.getByLabelText('Outline'), {
      target: { value: 'Act 1\nAct 2' },
    })
    expect(onOutlineChange).toHaveBeenCalledWith('Act 1\nAct 2')
  })
})
