interface LocalStorageData {
  sessions?: any[];
  personalRecords?: any[];
  trainingPlans?: any[];
  awards?: any[];
}

export interface MigrationResult {
  success: boolean;
  migratedSessions: number;
  migratedPRs: number;
  migratedPlans: number;
  migratedAwards: number;
  errors: string[];
}

export async function migrateLocalStorageToDatabase(): Promise<MigrationResult> {
  const result: MigrationResult = {
    success: false,
    migratedSessions: 0,
    migratedPRs: 0,
    migratedPlans: 0,
    migratedAwards: 0,
    errors: [],
  };

  try {
    const data = getLocalStorageData();
    
    if (!data.sessions?.length && !data.personalRecords?.length && !data.trainingPlans?.length && !data.awards?.length) {
      result.success = true;
      return result;
    }

    if (data.sessions?.length) {
      const sessionsResult = await migrateSessions(data.sessions);
      result.migratedSessions = sessionsResult.count;
      if (sessionsResult.error) result.errors.push(sessionsResult.error);
    }

    if (data.personalRecords?.length) {
      const prsResult = await migratePersonalRecords(data.personalRecords);
      result.migratedPRs = prsResult.count;
      if (prsResult.error) result.errors.push(prsResult.error);
    }

    if (data.trainingPlans?.length) {
      const plansResult = await migrateTrainingPlans(data.trainingPlans);
      result.migratedPlans = plansResult.count;
      if (plansResult.error) result.errors.push(plansResult.error);
    }

    if (data.awards?.length) {
      const awardsResult = await migrateAwards(data.awards);
      result.migratedAwards = awardsResult.count;
      if (awardsResult.error) result.errors.push(awardsResult.error);
    }

    result.success = result.errors.length === 0;

    if (result.success) {
      markMigrationComplete();
    }

    return result;
  } catch (error) {
    console.error('Migration error:', error);
    result.errors.push(error instanceof Error ? error.message : 'Unknown error');
    return result;
  }
}

function getLocalStorageData(): LocalStorageData {
  const data: LocalStorageData = {};

  try {
    const sessionsStr = localStorage.getItem('rowingSessions');
    if (sessionsStr) {
      data.sessions = JSON.parse(sessionsStr);
    }
  } catch (e) {
    console.error('Error parsing sessions:', e);
  }

  try {
    const prsStr = localStorage.getItem('personalRecords');
    if (prsStr) {
      data.personalRecords = JSON.parse(prsStr);
    }
  } catch (e) {
    console.error('Error parsing PRs:', e);
  }

  try {
    const plansStr = localStorage.getItem('trainingPlans');
    if (plansStr) {
      data.trainingPlans = JSON.parse(plansStr);
    }
  } catch (e) {
    console.error('Error parsing plans:', e);
  }

  try {
    const awardsStr = localStorage.getItem('earnedAwards');
    if (awardsStr) {
      data.awards = JSON.parse(awardsStr);
    }
  } catch (e) {
    console.error('Error parsing awards:', e);
  }

  return data;
}

async function migrateSessions(sessions: any[]): Promise<{ count: number; error?: string }> {
  try {
    const response = await fetch('/api/migrate/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessions }),
    });

    if (!response.ok) {
      const error = await response.json();
      return { count: 0, error: error.error || 'Failed to migrate sessions' };
    }

    const data = await response.json();
    return { count: data.count || 0 };
  } catch (error) {
    return { count: 0, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

async function migratePersonalRecords(prs: any[]): Promise<{ count: number; error?: string }> {
  try {
    const response = await fetch('/api/migrate/prs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prs }),
    });

    if (!response.ok) {
      const error = await response.json();
      return { count: 0, error: error.error || 'Failed to migrate PRs' };
    }

    const data = await response.json();
    return { count: data.count || 0 };
  } catch (error) {
    return { count: 0, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

async function migrateTrainingPlans(plans: any[]): Promise<{ count: number; error?: string }> {
  try {
    const response = await fetch('/api/migrate/plans', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plans }),
    });

    if (!response.ok) {
      const error = await response.json();
      return { count: 0, error: error.error || 'Failed to migrate plans' };
    }

    const data = await response.json();
    return { count: data.count || 0 };
  } catch (error) {
    return { count: 0, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

async function migrateAwards(awards: any[]): Promise<{ count: number; error?: string }> {
  try {
    const response = await fetch('/api/migrate/awards', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ awards }),
    });

    if (!response.ok) {
      const error = await response.json();
      return { count: 0, error: error.error || 'Failed to migrate awards' };
    }

    const data = await response.json();
    return { count: data.count || 0 };
  } catch (error) {
    return { count: 0, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export function hasPendingMigration(): boolean {
  if (typeof window === 'undefined') return false;
  
  const migrated = localStorage.getItem('migrationComplete');
  if (migrated === 'true') return false;

  const data = getLocalStorageData();
  return !!(data.sessions?.length || data.personalRecords?.length || data.trainingPlans?.length || data.awards?.length);
}

function markMigrationComplete(): void {
  localStorage.setItem('migrationComplete', 'true');
}

export function clearLocalStorageData(): void {
  localStorage.removeItem('rowingSessions');
  localStorage.removeItem('personalRecords');
  localStorage.removeItem('trainingPlans');
  localStorage.removeItem('earnedAwards');
}
