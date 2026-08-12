import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { CategoryChips } from './CategoryChips'

describe('CategoryChips', () => {
  it('shows resilience categories and reports selection', () => {
    const onToggle = vi.fn()
    render(
      <CategoryChips
        selected={new Set(['hospital'])}
        onToggle={onToggle}
      />,
    )

    expect(
      screen.getByRole('button', { name: 'Hospitals' }),
    ).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('Shelters')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Water' }))
    expect(onToggle).toHaveBeenCalledWith('water')
  })
})
