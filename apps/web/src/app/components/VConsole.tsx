"use client"

import { useEffect } from 'react'

export function VConsole() {
  useEffect(() => {
    const enabled =
      process.env.NODE_ENV !== 'production' ||
      process.env.NEXT_PUBLIC_ENABLE_VCONSOLE === 'true'

    if (!enabled || typeof window === 'undefined') return

    let vConsole: any

    ;(async () => {
      const VConsoleLib = (await import('vconsole')).default
      vConsole = new VConsoleLib()
      
      // 手动实现 PC 端鼠标拖拽（VConsole 默认只支持触摸）
      setTimeout(() => {
        const vcBtn = document.querySelector('.vc-switch') as HTMLElement
        if (!vcBtn) return
        
        vcBtn.style.zIndex = '9999'
        vcBtn.style.cursor = 'move'
        vcBtn.style.userSelect = 'none'
        
        let isDragging = false
        let hasMoved = false
        let startX = 0
        let startY = 0
        let initialLeft = 0
        let initialBottom = 0
        
        const onMouseDown = (e: MouseEvent) => {
          isDragging = true
          hasMoved = false
          startX = e.clientX
          startY = e.clientY
          
          const rect = vcBtn.getBoundingClientRect()
          initialLeft = rect.left
          initialBottom = window.innerHeight - rect.bottom
          
          vcBtn.style.transition = 'none'
          e.preventDefault()
        }
        
        const onMouseMove = (e: MouseEvent) => {
          if (!isDragging) return
          
          const deltaX = e.clientX - startX
          const deltaY = e.clientY - startY
          
          // 如果移动超过 5px，标记为拖拽
          if (Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5) {
            hasMoved = true
          }
          
          const newLeft = initialLeft + deltaX
          const newBottom = initialBottom - deltaY
          
          // 限制在视口内
          const maxLeft = window.innerWidth - vcBtn.offsetWidth
          const maxBottom = window.innerHeight - vcBtn.offsetHeight
          
          vcBtn.style.left = `${Math.max(0, Math.min(newLeft, maxLeft))}px`
          vcBtn.style.bottom = `${Math.max(0, Math.min(newBottom, maxBottom))}px`
          vcBtn.style.right = 'auto'
        }
        
        const onMouseUp = () => {
          if (isDragging) {
            isDragging = false
            vcBtn.style.transition = ''
          }
        }
        
        // 阻止拖拽后的点击事件
        const onClick = (e: MouseEvent) => {
          if (hasMoved) {
            e.preventDefault()
            e.stopPropagation()
            e.stopImmediatePropagation()
            hasMoved = false
          }
        }
        
        vcBtn.addEventListener('mousedown', onMouseDown)
        vcBtn.addEventListener('click', onClick, true)
        document.addEventListener('mousemove', onMouseMove)
        document.addEventListener('mouseup', onMouseUp)
        
        // 清理函数
        return () => {
          vcBtn.removeEventListener('mousedown', onMouseDown)
          vcBtn.removeEventListener('click', onClick, true)
          document.removeEventListener('mousemove', onMouseMove)
          document.removeEventListener('mouseup', onMouseUp)
        }
      }, 100)
    })()

    return () => {
      if (vConsole && typeof vConsole.destroy === 'function') {
        vConsole.destroy()
      }
    }
  }, [])

  return null
}
