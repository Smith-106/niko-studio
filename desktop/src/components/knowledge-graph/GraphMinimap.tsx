import { useRef, useEffect } from 'react'
import type { Core } from 'cytoscape'

interface GraphMinimapProps {
  cyRef: React.RefObject<Core | null>
  width?: number
  height?: number
}

export function GraphMinimap({ cyRef, width = 140, height = 100 }: GraphMinimapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const cy = cyRef.current
    const canvas = canvasRef.current
    if (!cy || !canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const draw = () => {
      ctx.clearRect(0, 0, width, height)
      ctx.fillStyle = 'rgba(26, 32, 44, 0.8)'
      ctx.fillRect(0, 0, width, height)

      const extent = cy.extent()
      const graphW = extent.x2 - extent.x1
      const graphH = extent.y2 - extent.y1

      if (graphW === 0 || graphH === 0) return

      const scaleX = width / graphW
      const scaleY = height / graphH
      const scale = Math.min(scaleX, scaleY) * 0.9

      const offsetX = (width - graphW * scale) / 2
      const offsetY = (height - graphH * scale) / 2

      // Draw nodes
      ctx.fillStyle = '#4a5568'
      cy.nodes().forEach((node) => {
        const pos = node.position()
        const x = (pos.x - extent.x1) * scale + offsetX
        const y = (pos.y - extent.y1) * scale + offsetY
        ctx.beginPath()
        ctx.arc(x, y, 1.5, 0, Math.PI * 2)
        ctx.fill()
      })

      // Draw viewport rectangle
      const zoom = cy.zoom()
      const pan = cy.pan()
      const container = cy.container()
      if (!container) return

      const vpW = container.clientWidth / zoom
      const vpH = container.clientHeight / zoom
      const vpX = -pan.x / zoom - extent.x1
      const vpY = -pan.y / zoom - extent.y1

      ctx.strokeStyle = '#63b3ed'
      ctx.lineWidth = 1
      ctx.strokeRect(
        vpX * scale + offsetX,
        vpY * scale + offsetY,
        vpW * scale,
        vpH * scale,
      )
    }

    draw()

    const onViewportChange = () => draw()
    cy.on('viewport', onViewportChange)
    cy.on('add remove', onViewportChange)

    return () => {
      cy.off('viewport', onViewportChange)
      cy.off('add remove', onViewportChange)
    }
  }, [cyRef, width, height])

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className="absolute bottom-3 right-3 rounded border border-gray-700 opacity-70 hover:opacity-100 transition-opacity"
      style={{ width, height }}
    />
  )
}
