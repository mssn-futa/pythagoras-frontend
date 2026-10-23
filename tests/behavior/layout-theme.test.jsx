import { StrictMode } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, expect, it, vi } from 'vitest'
import Layout from '../../src/components/layout/Layout.jsx'

vi.mock('../../src/components/layout/SideBar.jsx', () => ({ default: () => null }))

afterEach(() => document.documentElement.classList.remove('dark'))

function renderLayout() {
  return render(<StrictMode><MemoryRouter><Layout /></MemoryRouter></StrictMode>)
}

it('restores the saved theme and persists each toggle under Strict Mode', async () => {
  sessionStorage.setItem('theme', 'dark')
  const user = userEvent.setup()
  const first = renderLayout()
  const toggle = screen.getByRole('button', { name: 'Dark mode' })

  expect(toggle).toHaveAttribute('aria-pressed', 'true')
  expect(document.documentElement).toHaveClass('dark')

  await user.click(toggle)
  expect(toggle).toHaveAttribute('aria-pressed', 'false')
  expect(document.documentElement).not.toHaveClass('dark')
  expect(sessionStorage.getItem('theme')).toBe('light')

  first.unmount()
  renderLayout()
  expect(screen.getByRole('button', { name: 'Dark mode' })).toHaveAttribute('aria-pressed', 'false')

  await user.click(screen.getByRole('button', { name: 'Dark mode' }))
  expect(document.documentElement).toHaveClass('dark')
  expect(sessionStorage.getItem('theme')).toBe('dark')
})

it('starts light without a saved preference, even if a stale dark class remains', () => {
  document.documentElement.classList.add('dark')
  renderLayout()

  expect(screen.getByRole('button', { name: 'Dark mode' })).toHaveAttribute('aria-pressed', 'false')
  expect(document.documentElement).not.toHaveClass('dark')
  expect(sessionStorage.getItem('theme')).toBe('light')
})
