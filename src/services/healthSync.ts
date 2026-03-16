import {
  WorkoutActivityType,
  WorkoutTypeIdentifier,
  isHealthDataAvailableAsync,
  queryWorkoutSamples,
  requestAuthorization,
  type QueryStatisticsResponse,
} from '@kingstinct/react-native-healthkit';
import type {
  HealthSyncErrorCode,
  HealthSyncRequestPayload,
  HealthSyncResultErrorPayload,
  HealthSyncResultSuccessPayload,
} from '../types/messaging';

const REQUEST_TIMEOUT_MS = 10_000;
const HEART_RATE_UNIT = 'count/min';
const ENERGY_UNIT = 'kcal';

class HealthSyncError extends Error {
  readonly code: HealthSyncErrorCode;

  constructor(code: HealthSyncErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}

function withTimeout<T>(promise: Promise<T>, timeoutMs = REQUEST_TIMEOUT_MS): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new HealthSyncError('TIMEOUT', 'HealthKit query timed out.')), timeoutMs);
    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error: unknown) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

function toKstDayRange(dateString: string): { startDate: Date; endDate: Date } {
  const [year, month, day] = dateString.split('-').map((v) => Number(v));
  if (!year || !month || !day) {
    throw new HealthSyncError('QUERY_FAILED', 'Invalid date format.');
  }
  const startDate = new Date(Date.UTC(year, month - 1, day, -9, 0, 0, 0));
  const endDate = new Date(Date.UTC(year, month - 1, day + 1, -9, 0, 0, 0));
  return { startDate, endDate };
}

function normalizeEnergyToKcal(quantity: number | undefined, unit: string | undefined): number | null {
  if (typeof quantity !== 'number' || !Number.isFinite(quantity)) return null;
  const normalized = (unit ?? '').trim().toLowerCase();
  if (!normalized || normalized === 'kcal' || normalized === 'cal') return quantity;
  if (normalized === 'kj') return quantity * 0.239005736;
  return quantity;
}

function toRounded(value: number | null): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  return Math.round(value * 10) / 10;
}

type QueriedWorkout = Awaited<ReturnType<typeof queryWorkoutSamples>>[number];

async function queryWorkoutEnergyKcal(workout: QueriedWorkout): Promise<number | null> {
  const statistics: QueryStatisticsResponse | undefined = await withTimeout(
    workout.getStatistic('HKQuantityTypeIdentifierActiveEnergyBurned', ENERGY_UNIT),
  );
  const sumQuantity = statistics?.sumQuantity?.quantity;
  const fromStats = typeof sumQuantity === 'number' ? sumQuantity : null;
  if (fromStats != null) return toRounded(fromStats);
  return toRounded(normalizeEnergyToKcal(workout.totalEnergyBurned?.quantity, workout.totalEnergyBurned?.unit));
}

async function queryWorkoutHeartRate(workout: QueriedWorkout): Promise<{ avgBpm: number | null; maxBpm: number | null }> {
  const statistics: QueryStatisticsResponse | undefined = await withTimeout(
    workout.getStatistic('HKQuantityTypeIdentifierHeartRate', HEART_RATE_UNIT),
  );
  const avgBpm = toRounded(statistics?.averageQuantity?.quantity ?? null);
  const maxBpm = toRounded(statistics?.maximumQuantity?.quantity ?? null);
  return { avgBpm, maxBpm };
}

export async function requestHealthSync(
  request: HealthSyncRequestPayload,
): Promise<HealthSyncResultSuccessPayload | HealthSyncResultErrorPayload> {
  try {
    const available = await withTimeout(isHealthDataAvailableAsync());
    if (!available) {
      throw new HealthSyncError('NO_PERMISSION', 'Health data is not available.');
    }

    const authorized = await withTimeout(
      requestAuthorization({
        toRead: [WorkoutTypeIdentifier, 'HKQuantityTypeIdentifierHeartRate', 'HKQuantityTypeIdentifierActiveEnergyBurned'],
      }),
    );
    if (!authorized) {
      throw new HealthSyncError('NO_PERMISSION', 'HealthKit permission is required.');
    }

    const { startDate, endDate } = toKstDayRange(request.date);
    const workouts = await withTimeout(
      queryWorkoutSamples({
        filter: {
          workoutActivityType: WorkoutActivityType.barre,
          date: {
            startDate,
            endDate,
            strictStartDate: true,
            strictEndDate: true,
          },
        },
        limit: 1,
        ascending: false,
      }),
    );

    const workout = workouts[0];
    if (!workout) {
      throw new HealthSyncError('NO_DATA', 'No barre workout found for this date.');
    }

    const totalEnergyKcal = await queryWorkoutEnergyKcal(workout);
    const { avgBpm, maxBpm } = await queryWorkoutHeartRate(workout);
    const sourceName = workout.sourceRevision?.source?.name ?? null;
    const deviceName = workout.device?.name ?? workout.metadataDeviceName ?? null;

    return {
      type: 'health_sync_result',
      version: 1,
      request_id: request.request_id,
      status: 'success',
      workout: {
        activity: 'barre',
        activity_label: 'Barre',
        source_name: sourceName,
        device_name: deviceName,
        total_energy_kcal: totalEnergyKcal,
        avg_bpm: avgBpm,
        max_bpm: maxBpm,
        active_energy_kcal: totalEnergyKcal,
      },
    };
  } catch (error: unknown) {
    if (error instanceof HealthSyncError) {
      return {
        type: 'health_sync_result',
        version: 1,
        request_id: request.request_id,
        status: 'error',
        code: error.code,
        message: error.message,
      };
    }
    return {
      type: 'health_sync_result',
      version: 1,
      request_id: request.request_id,
      status: 'error',
      code: 'QUERY_FAILED',
      message: error instanceof Error ? error.message : 'Unknown health sync error.',
    };
  }
}
