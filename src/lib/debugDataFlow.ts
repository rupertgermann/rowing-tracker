/**
 * Debug utilities to trace data flow from upload to display
 */

export function logDataFlow(step: string, data: any) {
  console.log(`[DATA FLOW] ${step}:`, {
    timestamp: new Date().toISOString(),
    data: JSON.stringify(data, null, 2).substring(0, 500)
  });
}

export function logStoreState(storeName: string, state: any) {
  console.log(`[STORE STATE] ${storeName}:`, {
    sessionCount: state.sessions?.length || 0,
    prCount: state.personalRecords?.length || 0,
    awardCount: state.earnedAwards?.length || 0,
    firstSession: state.sessions?.[0] || null
  });
}

export function logAPICall(endpoint: string, method: string, payload?: any) {
  console.log(`[API CALL] ${method} ${endpoint}:`, {
    timestamp: new Date().toISOString(),
    payloadSize: payload ? JSON.stringify(payload).length : 0,
    sampleData: payload ? JSON.stringify(payload).substring(0, 200) : null
  });
}

export function logAPIResponse(endpoint: string, response: any) {
  console.log(`[API RESPONSE] ${endpoint}:`, {
    timestamp: new Date().toISOString(),
    status: response.ok ? 'OK' : 'ERROR',
    dataSize: response.data ? JSON.stringify(response.data).length : 0
  });
}
