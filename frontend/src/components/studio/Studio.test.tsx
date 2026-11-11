import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { Studio } from './Studio'

describe('Studio', () => {
  afterEach(cleanup)

  it('starts with an armed lead vocal and the genre preset, without starting audio', () => {
    render(<Studio />)
    expect(screen.getByRole('button', { name: 'Arm Lead vocal' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('combobox', { name: 'Vocal preset' })).toHaveValue('post-punk-baritone')
    expect(screen.getByRole('button', { name: 'Record' })).toBeEnabled()
  })

  it('switches genre presets and adds tracks', () => {
    render(<Studio />)
    fireEvent.change(screen.getByRole('combobox', { name: 'Session genre' }), { target: { value: 'metal' } })
    expect(screen.getByRole('combobox', { name: 'Vocal preset' })).toHaveValue('metal-clean')
    fireEvent.change(screen.getByRole('combobox', { name: 'New track type' }), { target: { value: 'scream' } })
    fireEvent.click(screen.getByRole('button', { name: '+ Add vocal track' }))
    expect(screen.getAllByRole('textbox', { name: 'Track name' }).map((input) => (input as HTMLInputElement).value)).toContain('Screams')
    expect(screen.getByRole('combobox', { name: 'Vocal preset' })).toHaveValue('metal-scream')
  })

  it('marks edited chains as custom', () => {
    render(<Studio />)
    fireEvent.change(screen.getByRole('slider', { name: 'Reverb mix' }), { target: { value: '0.8' } })
    expect(screen.getByRole('combobox', { name: 'Vocal preset' })).toHaveValue('custom')
  })
})
