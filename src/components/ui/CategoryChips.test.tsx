import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { FacilityCategory } from '../../types/facilities'
import { CategoryChips } from './CategoryChips'

describe('CategoryChips', () => {
  it('announces active categories and handles toggles', () => {
    const onToggle = vi.fn()
    render(
      <CategoryChips
        active={new Set<FacilityCategory>(['hospital'])}
        onToggle={onToggle}
      />,
    )

    expect(screen.getByRole('button', { name: 'Hospitals' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )

    fireEvent.click(screen.getByRole('button', { name: 'Water' }))
    expect(onToggle).toHaveBeenCalledWith('water')
  })
})
