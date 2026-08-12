import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { MapLegend } from './MapLegend'

describe('MapLegend', () => {
  it('uses singular copy for one visible facility', () => {
    const { container } = render(<MapLegend visibleCount={1} />)
    expect(container).toHaveTextContent('1 facility in view')
  })

  it('uses plural copy for multiple visible facilities', () => {
    const { container } = render(<MapLegend visibleCount={3} />)
    expect(container).toHaveTextContent('3 facilities in view')
  })
})
