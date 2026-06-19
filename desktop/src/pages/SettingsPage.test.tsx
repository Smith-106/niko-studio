import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const invokeMock = vi.hoisted(() => vi.fn())

vi.mock('@tauri-apps/api/core', () => ({
  invoke: invokeMock,
}))

import SettingsPage from './SettingsPage'

function clickProviderToggle(name: string) {
  const toggle = screen.getByText(name).parentElement?.querySelector('button')
  expect(toggle).toBeInstanceOf(HTMLButtonElement)
  fireEvent.click(toggle as HTMLButtonElement)
}

describe('SettingsPage', () => {
  beforeEach(() => {
    invokeMock.mockReset()
    invokeMock.mockResolvedValue({ online: true })
  })

  it('enables providers, updates keys, and checks nowledge connectivity', () => {
    render(<SettingsPage />)

    expect(screen.getByRole('heading', { name: 'AI 模型提供商' })).toBeInTheDocument()

    clickProviderToggle('OpenAI')
    expect(screen.getByText('已启用')).toBeInTheDocument()
    expect(screen.getByDisplayValue('https://api.openai.com/v1')).toBeInTheDocument()

    const apiKey = screen.getByPlaceholderText('sk-...') as HTMLInputElement
    fireEvent.change(apiKey, { target: { value: 'sk-live-test' } })
    expect(screen.getByDisplayValue('sk-live-test')).toBeInTheDocument()

    clickProviderToggle('Ollama (本地)')
    expect(screen.getByText('qwen2.5:14b')).toBeInTheDocument()
    expect(screen.queryAllByPlaceholderText('sk-...')).toHaveLength(1)

    fireEvent.click(screen.getByRole('button', { name: 'Nowledge Mem' }))
    expect(screen.getByText('Nowledge Mem 知识层')).toBeInTheDocument()

    fireEvent.change(screen.getByDisplayValue('127.0.0.1'), {
      target: { value: '192.168.1.10' },
    })
    fireEvent.change(screen.getByDisplayValue('19828'), {
      target: { value: '18888' },
    })
    fireEvent.click(screen.getByRole('button', { name: '测试连接' }))

    expect(invokeMock).toHaveBeenCalledWith('get_nowledge_status')

    fireEvent.click(screen.getByRole('button', { name: '通用设置' }))
    expect(screen.getByRole('heading', { name: '通用设置' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'English' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: '严格（发布前）' })).toBeInTheDocument()
  })
})
