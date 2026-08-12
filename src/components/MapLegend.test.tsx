import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { MapLegend } from './MapLegend'

describe('MapLegend', () => {
  it('uses singular copy for one visible facility', () => {
    render(<MapLegend visibleCount={1} />)
    expect(screen.getByText(/1 facility in view/)).toBeInTheDocument()
  })

  it('uses plural copy for multiple visible facilities', () => {
    render(<MapLegend visibleCount={3} />)
    expect(screen.getByText(/3 facilities in view/)).toBeInTheDocument()
  })
})
