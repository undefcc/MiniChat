"use client"

import React, { useCallback, useEffect, useState } from 'react'
import { ShieldCheck, LogIn, LogOut } from 'lucide-react'
import { Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, Form, FormControl, FormField, FormItem, FormLabel, FormMessage, Input, } from '@/components/ui'
import { useUiStore } from '@/app/store/uiStore'
import { useUserStore } from '@/app/store/userStore'
import { useShallow } from 'zustand/shallow'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { resolveGatewayUrl } from '@/app/utils/endpoints'

type AuthMode = 'login' | 'register'

const loginSchema = z.object({
  email: z.string().email('请输入有效邮箱'),
  password: z.string().min(1, '请输入密码'),
})
const registerSchema = z.object({
  email: z.string().email('请输入有效邮箱'),
  nickname: z.string().max(32, '昵称最长 32 位').optional(),
  password: z.string().min(6, '密码长度至少 6 位'),
  confirmPassword: z.string().min(6, '密码长度至少 6 位'),
}).refine((data) => data.password === data.confirmPassword, {
  path: ['confirmPassword'],
  message: '两次输入的密码不一致',
})

export function AuthLoginLauncher() {
  const [mode, setMode] = useState<AuthMode>('login')
  const [gatewayUrl, setGatewayUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loginForm = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  })
  const registerForm = useForm<z.infer<typeof registerSchema>>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      email: '',
      password: '',
      confirmPassword: '',
      nickname: '',
    },
  })

  const [loginOpen, refreshAfterLogin] = useUiStore(useShallow(s => [s.loginOpen, s.refreshAfterLogin]))

  const resetForms = useCallback(
    (clearError = true) => {
      loginForm.reset()
      registerForm.reset()
      if (clearError) {
        setError(null)
      }
    },
    [loginForm, registerForm]
  )
  const [token, user] = useUserStore(useShallow(s => [s.token, s.user]))
  const { clearAuth, login, guestLogin, register } = useUserStore.getState()
  const { setLoginOpen, clearRefreshAfterLogin, showToast } = useUiStore.getState()

  useEffect(() => {
    setGatewayUrl(resolveGatewayUrl())
  }, [])

  useEffect(() => {
    if (!loginOpen) {
      resetForms()
      setMode('login')
    }
  }, [loginOpen, resetForms])

  const handleLogin = async (values: z.infer<typeof loginSchema>) => {
    setError(null)
    setLoading(true)

    try {
      await login(values.email, values.password)
      setLoginOpen(false)
      if (refreshAfterLogin && typeof window !== 'undefined') {
        clearRefreshAfterLogin()
        window.location.reload()
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : '登录失败'
      setError(message)
      showToast(message, 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleRegister = async (values: z.infer<typeof registerSchema>) => {
    setError(null)
    setLoading(true)

    try {
      const data = await register({
        email: values.email,
        password: values.password,
        nickname: values.nickname || values.email.split('@')[0],
      })

      // 注册成功，自动登录
      if (data.accessToken) {
        setLoginOpen(false)
        if (refreshAfterLogin && typeof window !== 'undefined') {
          clearRefreshAfterLogin()
          window.location.reload()
        }
      } else {
        setError('注册成功，请重新登录')
        setMode('login')
        resetForms(false)
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : '注册失败'
      setError(message)
      showToast(message, 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleGuestLogin = async () => {
    setError(null)
    setLoading(true)

    try {
      await guestLogin()
      setLoginOpen(false)
      if (refreshAfterLogin && typeof window !== 'undefined') {
        clearRefreshAfterLogin()
        window.location.reload()
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : '游客登录失败'
      setError(message)
      showToast(message, 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = () => {
    clearAuth()
  }

  return (
    <div className="fixed bottom-4 right-4 z-[70]">
      <Dialog open={loginOpen} onOpenChange={setLoginOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" className="gap-2 shadow-sm">
            <ShieldCheck className="h-4 w-4" />
            {token ? '已登录' : '登录'}
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {mode === 'login' ? '登录' : '注册新账号'}
            </DialogTitle>
            <DialogDescription>
              {mode === 'login' 
                ? '用于获取 JWT 并验证信令鉴权流程。' 
                : '创建新账号以访问视频聊天。'}
            </DialogDescription>
          </DialogHeader>

          {token ? (
            <div className="space-y-3 text-sm">
              <div className="rounded-md border bg-muted/40 px-3 py-2">
                <div className="text-xs text-muted-foreground">已登录用户</div>
                <div className="font-medium">
                  {user?.nickname || user?.email || user?.id || '未知用户'}
                </div>
                {user?.type && (
                  <div className="text-xs text-muted-foreground">{user.type}</div>
                )}
              </div>
              <div className="text-xs text-muted-foreground">
                连接信令时会自动携带本地 token。已建立的连接需要重新连接后生效。
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={handleLogout} className="gap-2">
                  <LogOut className="h-4 w-4" />
                  退出登录
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <>
              {/* 模式切换标签 */}
              <div className="flex gap-2 border-b mb-4">
                <button
                  type="button"
                  onClick={() => {
                    setMode('login')
                    resetForms()
                  }}
                  className={`pb-2 px-2 font-medium transition-colors ${
                    mode === 'login'
                      ? 'border-b-2 border-primary text-primary'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  登录
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode('register')
                    resetForms()
                  }}
                  className={`pb-2 px-2 font-medium transition-colors ${
                    mode === 'register'
                      ? 'border-b-2 border-primary text-primary'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  注册
                </button>
              </div>

              {/* 登录表单 */}
              {mode === 'login' && (
                <Form {...loginForm}>
                  <form onSubmit={loginForm.handleSubmit(handleLogin)} className="space-y-4">
                    <FormField
                      control={loginForm.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>邮箱</FormLabel>
                          <FormControl>
                            <Input type="email" placeholder="user@example.com" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={loginForm.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>密码</FormLabel>
                          <FormControl>
                            <Input type="password" placeholder="请输入密码" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    {gatewayUrl && (
                      <div className="text-xs text-muted-foreground">
                        Gateway: {gatewayUrl}
                      </div>
                    )}
                    {error && (
                      <div className="text-xs text-rose-600">{error}</div>
                    )}
                    <DialogFooter>
                      <div className="grid w-full gap-2">
                        <Button type="submit" className="gap-2 w-full" disabled={loading}>
                          <LogIn className="h-4 w-4" />
                          {loading ? '登录中...' : '登录'}
                        </Button>
                        <Button type="button" variant="outline" className="w-full" onClick={handleGuestLogin} disabled={loading}>
                          游客登录
                        </Button>
                      </div>
                    </DialogFooter>
                  </form>
                </Form>
              )}

              {/* 注册表单 */}
              {mode === 'register' && (
                <Form {...registerForm}>
                  <form onSubmit={registerForm.handleSubmit(handleRegister)} className="space-y-4">
                    <FormField
                      control={registerForm.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>邮箱</FormLabel>
                          <FormControl>
                            <Input type="email" placeholder="user@example.com" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={registerForm.control}
                      name="nickname"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>昵称（可选）</FormLabel>
                          <FormControl>
                            <Input
                              type="text"
                              placeholder="输入昵称，默认为邮箱前缀"
                              {...field}
                              value={field.value ?? ''}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={registerForm.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>密码</FormLabel>
                          <FormControl>
                            <Input type="password" placeholder="至少 6 位" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={registerForm.control}
                      name="confirmPassword"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>确认密码</FormLabel>
                          <FormControl>
                            <Input type="password" placeholder="再次输入密码" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    {gatewayUrl && (
                      <div className="text-xs text-muted-foreground">
                        Gateway: {gatewayUrl}
                      </div>
                    )}
                    {error && (
                      <div className="text-xs text-rose-600">{error}</div>
                    )}
                    <DialogFooter>
                      <Button type="submit" className="gap-2 w-full" disabled={loading}>
                        {loading ? '注册中...' : '创建账号'}
                      </Button>
                    </DialogFooter>
                  </form>
                </Form>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
