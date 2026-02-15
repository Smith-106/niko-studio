import React from 'react'
import ReactMarkdown from 'react-markdown'
import type { Components } from 'react-markdown'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  skills?: string[]
}

interface MessageBubbleProps {
  message: Message
  onAssistantSelection?: (payload: { messageId: string; selectedText: string }) => void
}

// Custom comparison function for React.memo
function arePropsEqual(prevProps: MessageBubbleProps, nextProps: MessageBubbleProps): boolean {
  const prevMsg = prevProps.message
  const nextMsg = nextProps.message

  // Compare essential properties that affect rendering
  if (prevMsg.id !== nextMsg.id) return false
  if (prevMsg.content !== nextMsg.content) return false

  // Compare skills arrays
  const prevSkills = prevMsg.skills || []
  const nextSkills = nextMsg.skills || []
  if (prevSkills.length !== nextSkills.length) return false
  for (let i = 0; i < prevSkills.length; i++) {
    if (prevSkills[i] !== nextSkills[i]) return false
  }

  return true
}

function MessageBubbleComponent({ message, onAssistantSelection }: MessageBubbleProps) {
  const isUser = message.role === 'user'

  const handleMouseUp = () => {
    if (isUser || !onAssistantSelection) return
    const selection = window.getSelection()
    const text = selection?.toString().trim() || ''
    if (!text) return
    onAssistantSelection({ messageId: message.id, selectedText: text })
  }

  const markdownComponents: Components = {
    code({ className, children }) {
      const codeText = String(children).replace(/\n$/, '')
      return (
        <pre className="rounded-md overflow-x-auto bg-[#1f2937] text-[#f9fafb] p-3 text-sm">
          <code className={className}>{codeText}</code>
        </pre>
      )
    },
  }

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-3 ${
          isUser
            ? 'bg-blue-600 text-white'
            : 'bg-gray-100 text-gray-800'
        }`}
      >
        {/* Skills Badge */}
        {message.skills && message.skills.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2">
            {message.skills.map((skill) => (
              <span
                key={skill}
                className="px-2 py-0.5 bg-blue-500/20 text-blue-600 text-xs rounded-full"
              >
                📦 {skill}
              </span>
            ))}
          </div>
        )}

        {/* Content */}
        <div className="markdown-body" onMouseUp={handleMouseUp}>
          <ReactMarkdown
            components={markdownComponents}
          >
            {message.content}
          </ReactMarkdown>
        </div>

        {/* Timestamp */}
        <div
          className={`text-xs mt-2 ${
            isUser ? 'text-blue-200' : 'text-gray-400'
          }`}
        >
          {new Date(message.timestamp).toLocaleTimeString()}
        </div>
      </div>
    </div>
  )
}

// Export memoized component to prevent unnecessary re-renders
export const MessageBubble = React.memo(MessageBubbleComponent, arePropsEqual)
