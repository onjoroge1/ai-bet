import '@testing-library/jest-dom'

// Mock Next.js Request for integration tests
global.Request = class MockRequest {
  private _url: string
  private _method: string
  private _body: any
  private _headers: Map<string, string>
  private _nextUrl: any

  constructor(url: string, options?: any) {
    this._url = url
    this._method = options?.method || 'GET'
    this._body = options?.body || null
    this._headers = new Map(Object.entries(options?.headers || {}))
    
    // Create nextUrl object
    this._nextUrl = {
      pathname: new URL(url).pathname,
      searchParams: new URLSearchParams(new URL(url).search),
      href: url,
    }
  }
  
  get url() {
    return this._url
  }
  
  get method() {
    return this._method
  }
  
  get body() {
    return this._body
  }
  
  get headers() {
    return this._headers
  }
  
  get nextUrl() {
    return this._nextUrl
  }
  
  get ip() {
    return '127.0.0.1'
  }
  
  cookies = {
    get: (name: string) => {
      const cookieHeader = this._headers.get('cookie')
      if (!cookieHeader) return null
      
      const cookies = cookieHeader.split(';').reduce((acc: any, cookie: string) => {
        const [name, value] = cookie.trim().split('=')
        acc[name] = value
        return acc
      }, {})
      
      return cookies[name] ? { value: cookies[name] } : null
    }
  }
  
  json() {
    return Promise.resolve(JSON.parse(this._body))
  }
} as any

// Mock Next.js Response for integration tests
global.Response = class MockResponse {
  private _body: any
  private _status: number
  private _headers: Map<string, string>

  constructor(body?: any, options?: any) {
    this._body = body
    this._status = options?.status || 200
    this._headers = new Map(Object.entries(options?.headers || {}))
  }
  
  get body() {
    return this._body
  }
  
  get status() {
    return this._status
  }
  
  get headers() {
    return this._headers
  }
  
  json() {
    // If body is already a string, parse it; otherwise return as is
    if (typeof this._body === 'string') {
      try {
        return Promise.resolve(JSON.parse(this._body))
      } catch {
        return Promise.resolve(this._body)
      }
    }
    return Promise.resolve(this._body)
  }
  
  get(key: string) {
    return this._headers.get(key)
  }
  
  static redirect(url: string | URL) {
    return new global.Response(null, {
      status: 302,
      headers: { location: url.toString() }
    })
  }
} as any

// Mock NextResponse
jest.mock('next/server', () => ({
  NextRequest: global.Request,
  NextResponse: {
    json: (data: any, options?: any) => {
      return new global.Response(JSON.stringify(data), {
        status: options?.status || 200,
        headers: {
          'Content-Type': 'application/json',
          ...options?.headers,
        },
      })
    },
    redirect: (url: string | URL) => {
      return global.Response.redirect(url)
    },
  },
}))

// Extend expect matchers
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeInTheDocument(): R
      toHaveAttribute(attr: string, value?: string): R
    }
  }
} 