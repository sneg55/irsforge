import { fetchWithTimeout } from '../../scheduler/retry.js'
import { NYFED_ALL_RATES } from './constants.js'
import type { NYFedAllRatesResponse } from './types.js'

export async function fetchSofrData(
  date: string,
  timeoutMs: number,
): Promise<NYFedAllRatesResponse> {
  const url = `${NYFED_ALL_RATES}?startDate=${date}&endDate=${date}`
  const response = await fetchWithTimeout(url, { timeoutMs })
  if (!response.ok) {
    throw new Error(`NY Fed API error (${response.status}): ${await response.text()}`)
  }
  return await (response.json() as Promise<NYFedAllRatesResponse>)
}
