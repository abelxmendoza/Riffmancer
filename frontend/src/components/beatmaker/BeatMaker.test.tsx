import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { BeatMaker } from './BeatMaker'

describe('BeatMaker', () => {
  beforeEach(() => window.localStorage.clear())
  afterEach(cleanup)

  it('shows the genres and switches presets without starting audio', () => {
    render(<BeatMaker />)
    expect(screen.getByRole('button', { name: /Post Punk/ })).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(screen.getByRole('button', { name: /Reggaeton/ }))
    expect(screen.getByRole('button', { name: /Reggaeton/ })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('slider', { name: 'Tempo' })).toHaveValue('95')
  })

  it('tells the player when the browser has no Web MIDI', async () => {
    render(<BeatMaker />)
    expect(await screen.findByText(/no Web MIDI/)).toBeInTheDocument()
  })

  it('edits the drum grid', () => {
    render(<BeatMaker />)
    const cell = screen.getByRole('button', { name: 'Clap step 1' })
    fireEvent.click(cell)
    expect(screen.getByRole('button', { name: 'Clap step 1 on' })).toBeInTheDocument()
  })
})
