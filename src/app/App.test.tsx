import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { App } from './App'

describe('App', () => {
  it('renders the offline venue map with floors and search', () => {
    render(<App />)
    expect(screen.getByRole('application', { name: /Ground Level floor plan/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '3 Level 3' })).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText(/Search GrahmOS/), { target: { value: 'clinic' } })
    const results = screen.getByRole('listbox', { name: 'Search results' })
    expect(within(results).getByText('Clinic')).toBeInTheDocument()
  })

  it('routes to the nearest exit once the user sets their location', () => {
    render(<App />)
    fireEvent.change(screen.getByLabelText(/Search GrahmOS/), { target: { value: 'library' } })
    fireEvent.click(within(screen.getByRole('listbox')).getByText('Library'))
    fireEvent.click(screen.getByRole('button', { name: /I'm here/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Route to nearest exit' }))
    expect(screen.getByRole('region', { name: 'Directions' })).toBeInTheDocument()
    expect(screen.getByText(/Take the (stairs|elevator) down to Ground Level/)).toBeInTheDocument()
    expect(screen.getByText('Arrive at your destination')).toBeInTheDocument()
  })
})
