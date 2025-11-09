/**
 * @description 全局使用post请求，请求头尾application/json方式传参
 */
import axios, { type InternalAxiosRequestConfig, type AxiosResponse } from 'axios'

const baseURL = import.meta.env.VITE_BASE_URL
export const instance = axios.create({
  baseURL
})

// 请求拦截器
instance.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    const token = sessionStorage.getItem('token')
    config.headers['X-Csrf-Token'] = token
    // 记录取消标识
    const source = axios.CancelToken.source()
    config.cancelToken = source.token

    return config
  },
  (err) => {
    if (import.meta.env.MODE !== 'development') {
      post("/index/write_logs", { logs: JSON.stringify(err) }).then(res => console.log("发送成功"))
    }
    return Promise.reject(err)
  }
)

// 响应拦截器
instance.interceptors.response.use(
  async (res: AxiosResponse) => {
    return res.data
  },
  (err) => {
    if (import.meta.env.MODE !== 'development') {
      post("/index/write_logs", { logs: JSON.stringify(err) }).then(res => console.log("发送成功"))
    }
    return Promise.reject(err)
  }
)

// POST请求封装
export async function post<T>(
  url: string,
  params?: T
): Promise<{ message: any; status: number; code: number; msg?: string; error_msg?: string }> {
  return instance.post(url, params)
}

export async function get<T>(
  url: string,
  params?: T
): Promise<{ message: any; status: boolean; code: number; msg?: string }> {
  return instance.get(url, { params })
}

