import { toast } from 'sonner';

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface ApiClientOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  body?: any;
  headers?: Record<string, string>;
  requiresAuth?: boolean;
  skipErrorToast?: boolean;
  cache?: boolean;
  cacheTTL?: number; // Time to live in milliseconds
  retries?: number;
  retryDelay?: number;
}

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

interface LogEntry {
  timestamp: number;
  method: string;
  url: string;
  status?: number;
  duration: number;
  error?: string;
  requestId: string;
}

class ApiClient {
  private baseUrl: string = '';
  private cache = new Map<string, CacheEntry<any>>();
  private logs: LogEntry[] = [];
  private maxLogs = 1000;

  constructor() {
    // In browser environment, use relative URLs
    if (typeof window !== 'undefined') {
      this.baseUrl = '';
    }
  }

  private getAuthToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('auth_token');
  }

  private generateRequestId(): string {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  }

  private getCacheKey(url: string, method: string, body?: any): string {
    return `${method}:${url}:${body ? JSON.stringify(body) : ''}`;
  }

  private isValidCacheEntry<T>(entry: CacheEntry<T>): boolean {
    return Date.now() - entry.timestamp < entry.ttl;
  }

  private setCache<T>(key: string, data: T, ttl: number): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    });
  }

  private getCache<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (entry && this.isValidCacheEntry(entry)) {
      return entry.data;
    }
    if (entry) {
      this.cache.delete(key);
    }
    return null;
  }

  private addLog(log: LogEntry): void {
    this.logs.push(log);
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }
  }

  private getDefaultHeaders(requiresAuth: boolean = true): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (requiresAuth) {
      const token = this.getAuthToken();
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
    }

    return headers;
  }

  private async handleResponse<T>(response: Response): Promise<ApiResponse<T>> {
    try {
      const data = await response.json();

      if (!response.ok) {
        // Handle specific error cases
        if (response.status === 401) {
          // Unauthorized - clear token and redirect to login
          if (typeof window !== 'undefined') {
            localStorage.removeItem('auth_token');
            window.location.href = '/login';
          }
          return { success: false, error: 'Sessão expirada. Faça login novamente.' };
        }

        return { 
          success: false, 
          error: data.error || data.message || `Erro ${response.status}` 
        };
      }

      return { 
        success: true, 
        data: data.data || data,
        message: data.message 
      };
    } catch (error) {
      return { 
        success: false, 
        error: 'Erro ao processar resposta do servidor' 
      };
    }
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async request<T>(
    endpoint: string, 
    options: ApiClientOptions = {}
  ): Promise<ApiResponse<T>> {
    const {
      method = 'GET',
      body,
      headers: customHeaders = {},
      requiresAuth = true,
      skipErrorToast = false,
      cache = method === 'GET',
      cacheTTL = 5 * 60 * 1000, // 5 minutes default
      retries = 3,
      retryDelay = 1000
    } = options;

    const requestId = this.generateRequestId();
    const url = `${this.baseUrl}${endpoint}`;
    const cacheKey = this.getCacheKey(url, method, body);
    const startTime = Date.now();

    // Check cache for GET requests
    if (cache && method === 'GET') {
      const cachedData = this.getCache<ApiResponse<T>>(cacheKey);
      if (cachedData) {
        this.addLog({
          requestId,
          timestamp: Date.now(),
          method,
          url,
          status: 200,
          duration: Date.now() - startTime,
        });
        return cachedData;
      }
    }

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const defaultHeaders = this.getDefaultHeaders(requiresAuth);
        
        const response = await fetch(url, {
          method,
          headers: { ...defaultHeaders, ...customHeaders },
          body: body ? JSON.stringify(body) : undefined,
        });

        const result = await this.handleResponse<T>(response);
        const duration = Date.now() - startTime;

        // Log successful request
        this.addLog({
          requestId,
          timestamp: Date.now(),
          method,
          url,
          status: response.status,
          duration,
        });

        // Cache successful GET requests
        if (cache && method === 'GET' && result.success) {
          this.setCache(cacheKey, result, cacheTTL);
        }

        // Show error toast if not skipped and there's an error
        if (!result.success && !skipErrorToast && result.error) {
          toast.error(result.error);
        }

        return result;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        
        // Log failed attempt
        this.addLog({
          requestId,
          timestamp: Date.now(),
          method,
          url,
          duration: Date.now() - startTime,
          error: lastError.message,
        });

        // Don't retry on last attempt
        if (attempt === retries) {
          break;
        }

        // Wait before retrying
        await this.sleep(retryDelay * Math.pow(2, attempt)); // Exponential backoff
      }
    }

    const errorMessage = lastError?.message || 'Erro de conexão';
    
    if (!skipErrorToast) {
      toast.error(errorMessage);
    }

    return { success: false, error: errorMessage };
  }

  // Convenience methods
  async get<T>(endpoint: string, options: Omit<ApiClientOptions, 'method'> = {}): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { ...options, method: 'GET' });
  }

  async post<T>(endpoint: string, body?: any, options: Omit<ApiClientOptions, 'method' | 'body'> = {}): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { ...options, method: 'POST', body });
  }

  async put<T>(endpoint: string, body?: any, options: Omit<ApiClientOptions, 'method' | 'body'> = {}): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { ...options, method: 'PUT', body });
  }

  async delete<T>(endpoint: string, options: Omit<ApiClientOptions, 'method'> = {}): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { ...options, method: 'DELETE' });
  }

  async patch<T>(endpoint: string, body?: any, options: Omit<ApiClientOptions, 'method' | 'body'> = {}): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { ...options, method: 'PATCH', body });
  }

  // Cache management
  clearCache(): void {
    this.cache.clear();
  }

  clearCacheKey(endpoint: string, method: string = 'GET', body?: any): void {
    const url = `${this.baseUrl}${endpoint}`;
    const cacheKey = this.getCacheKey(url, method, body);
    this.cache.delete(cacheKey);
  }

  getCacheSize(): number {
    return this.cache.size;
  }

  // Logging management
  getLogs(): LogEntry[] {
    return [...this.logs];
  }

  getLogsStats(): { total: number; errors: number; averageTime: number } {
    const total = this.logs.length;
    const errors = this.logs.filter(log => log.error).length;
    const totalTime = this.logs.reduce((sum, log) => sum + log.duration, 0);
    const averageTime = total > 0 ? totalTime / total : 0;

    return { total, errors, averageTime };
  }

  clearLogs(): void {
    this.logs = [];
  }

  // Debug method for development
  debug(): void {
    console.group('🔧 API Client Debug Info');
    console.log('📊 Cache:', {
      size: this.getCacheSize(),
      entries: Array.from(this.cache.keys())
    });
    console.log('📝 Logs Stats:', this.getLogsStats());
    console.log('📋 Recent Logs:', this.logs.slice(-10));
    console.groupEnd();
  }
}

// Export singleton instance
export const apiClient = new ApiClient();

// Export specific API services
export * from './services/auth.service';
export * from './services/courses.service';
export * from './services/classes.service';
export * from './services/students.service';
export * from './services/templates.service';
export * from './services/whatsapp.service';
export * from './services/reports.service';
export * from './services/security.service';
export * from './services/attendance.service';
export * from './services/enrollments.service';