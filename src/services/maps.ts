import type { LatLng } from '../types'

const OSRM_BASE_URL = 'https://router.project-osrm.org'
const NOMINATIM_BASE_URL = 'https://nominatim.openstreetmap.org'

export interface RoadRoute {
  distanceKm: number
  durationMinutes: number
  /** Leaflet-ready [lat, lng] pairs. */
  coordinates: Array<[number, number]>
}

export interface RouteError extends Error {
  retryable: boolean
}

function routeError(message: string, retryable = true): RouteError {
  const error = new Error(message) as RouteError
  error.retryable = retryable
  return error
}

/**
 * Road-routing distance using the public OSRM demo server.
 * Throws a retryable error when the service cannot be reached.
 */
export async function getRoadRoute(
  from: LatLng,
  to: LatLng,
  signal?: AbortSignal,
): Promise<RoadRoute> {
  const url =
    `${OSRM_BASE_URL}/route/v1/driving/` +
    `${from.lng},${from.lat};${to.lng},${to.lat}` +
    '?overview=full&geometries=geojson&steps=false'

  let response: Response
  try {
    response = await fetch(url, { signal })
  } catch (error) {
    if ((error as Error).name === 'AbortError') throw error
    throw routeError(
      'The routing service could not be reached. Check your connection and try again.',
    )
  }

  if (!response.ok) {
    throw routeError(
      'The routing service is temporarily unavailable. Please try again.',
    )
  }

  let payload: {
    code?: string
    routes?: Array<{
      distance: number
      duration: number
      geometry: { coordinates: Array<[number, number]> }
    }>
  }

  try {
    payload = await response.json()
  } catch {
    throw routeError('The routing service returned an invalid response.')
  }

  const route = payload.routes?.[0]
  if (payload.code !== 'Ok' || !route) {
    throw routeError(
      'No drivable route was found to this location. Please adjust the pin.',
      false,
    )
  }

  return {
    distanceKm: Math.round((route.distance / 1000) * 100) / 100,
    durationMinutes: Math.round(route.duration / 60),
    coordinates: route.geometry.coordinates.map(
      ([lng, lat]) => [lat, lng] as [number, number],
    ),
  }
}

export interface OptimizedRouteStop {
  id: string
  /** 1-based recommended visit order. */
  sequence: number
  distanceKm: number
  durationMinutes: number
}

export interface OptimizedRoute {
  distanceKm: number
  durationMinutes: number
  /** Leaflet-ready [lat, lng] pairs for the whole trip. */
  coordinates: Array<[number, number]>
  /** Stops in the recommended visit order. */
  stops: OptimizedRouteStop[]
}

interface OsrmLeg {
  distance: number
  duration: number
}

interface OsrmTripPayload {
  code?: string
  trips?: Array<{
    distance: number
    duration: number
    geometry: { coordinates: Array<[number, number]> }
    legs?: OsrmLeg[]
  }>
  waypoints?: Array<{ waypoint_index?: number }>
}

interface OsrmRoutePayload {
  code?: string
  routes?: Array<{
    distance: number
    duration: number
    geometry: { coordinates: Array<[number, number]> }
    legs?: OsrmLeg[]
  }>
}

function haversineKm(a: LatLng, b: LatLng): number {
  const toRad = (value: number) => (value * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return 6371.0088 * 2 * Math.asin(Math.sqrt(h))
}

function nearestNeighbourOrder(
  from: LatLng,
  stops: Array<{ id: string; point: LatLng }>,
) {
  const remaining = stops.map((stop) => stop)
  const ordered: Array<{ id: string; point: LatLng }> = []
  let current = from

  while (remaining.length > 0) {
    let bestIndex = 0
    let bestDistance = Number.POSITIVE_INFINITY
    remaining.forEach((stop, index) => {
      const distance = haversineKm(current, stop.point)
      if (distance < bestDistance) {
        bestDistance = distance
        bestIndex = index
      }
    })
    const [next] = remaining.splice(bestIndex, 1)
    ordered.push(next)
    current = next.point
  }

  return ordered
}

async function routeThrough(
  from: LatLng,
  ordered: Array<{ id: string; point: LatLng }>,
  signal?: AbortSignal,
): Promise<OptimizedRoute> {
  const points = [from, ...ordered.map((stop) => stop.point)]
  const coordinates = points.map((point) => `${point.lng},${point.lat}`).join(';')
  const url =
    `${OSRM_BASE_URL}/route/v1/driving/${coordinates}` +
    '?overview=full&geometries=geojson&steps=false'

  let response: Response
  try {
    response = await fetch(url, { signal })
  } catch (error) {
    if ((error as Error).name === 'AbortError') throw error
    throw routeError(
      'The routing service could not be reached. Check your connection and try again.',
    )
  }

  if (!response.ok) {
    throw routeError(
      'The routing service is temporarily unavailable. Please try again.',
    )
  }

  const payload = (await response.json()) as OsrmRoutePayload
  const route = payload.routes?.[0]
  if (payload.code !== 'Ok' || !route) {
    throw routeError('No drivable route was found for this trip.', false)
  }

  return {
    distanceKm: Math.round((route.distance / 1000) * 100) / 100,
    durationMinutes: Math.round(route.duration / 60),
    coordinates: route.geometry.coordinates.map(
      ([lng, lat]) => [lat, lng] as [number, number],
    ),
    stops: ordered.map((stop, index) => {
      const leg = route.legs?.[index]
      return {
        id: stop.id,
        sequence: index + 1,
        distanceKm: Math.round(((leg?.distance ?? 0) / 1000) * 100) / 100,
        durationMinutes: Math.round((leg?.duration ?? 0) / 60),
      }
    }),
  }
}

/**
 * Optimizes the visit order for a multi-stop delivery run using OSRM's trip
 * service. If the public trip service is unavailable, a nearest-neighbour
 * ordering is routed through the normal route service instead.
 *
 * The first stop is never reordered from the origin, and the trip is not a
 * round trip (the driver ends at the final delivery).
 */
export async function getOptimizedRoute(
  from: LatLng,
  stops: Array<{ id: string; point: LatLng }>,
  signal?: AbortSignal,
): Promise<OptimizedRoute> {
  if (stops.length === 0) {
    throw routeError('There are no stops to route.', false)
  }

  if (stops.length === 1) {
    const route = await getRoadRoute(from, stops[0].point, signal)
    return {
      distanceKm: route.distanceKm,
      durationMinutes: route.durationMinutes,
      coordinates: route.coordinates,
      stops: [
        {
          id: stops[0].id,
          sequence: 1,
          distanceKm: route.distanceKm,
          durationMinutes: route.durationMinutes,
        },
      ],
    }
  }

  const points = [from, ...stops.map((stop) => stop.point)]
  const coordinates = points.map((point) => `${point.lng},${point.lat}`).join(';')
  const url =
    `${OSRM_BASE_URL}/trip/v1/driving/${coordinates}` +
    '?roundtrip=false&source=first&destination=any' +
    '&overview=full&geometries=geojson&steps=false'

  try {
    const response = await fetch(url, { signal })
    if (response.ok) {
      const payload = (await response.json()) as OsrmTripPayload
      const trip = payload.trips?.[0]
      const waypoints = payload.waypoints

      if (payload.code === 'Ok' && trip && waypoints?.length) {
        const ordered = waypoints
          .map((waypoint, index) => ({
            index,
            position: waypoint.waypoint_index ?? index,
          }))
          .sort((a, b) => a.position - b.position)

        const orderedStops: OptimizedRouteStop[] = []
        ordered.forEach(({ index, position }) => {
          if (index === 0) return
          const stop = stops[index - 1]
          if (!stop) return
          const leg = trip.legs?.[position - 1]
          orderedStops.push({
            id: stop.id,
            sequence: orderedStops.length + 1,
            distanceKm: Math.round(((leg?.distance ?? 0) / 1000) * 100) / 100,
            durationMinutes: Math.round((leg?.duration ?? 0) / 60),
          })
        })

        if (orderedStops.length === stops.length) {
          return {
            distanceKm: Math.round((trip.distance / 1000) * 100) / 100,
            durationMinutes: Math.round(trip.duration / 60),
            coordinates: trip.geometry.coordinates.map(
              ([lng, lat]) => [lat, lng] as [number, number],
            ),
            stops: orderedStops,
          }
        }
      }
    }
  } catch (error) {
    if ((error as Error).name === 'AbortError') throw error
    // Fall through to the nearest-neighbour fallback below.
  }

  return routeThrough(from, nearestNeighbourOrder(from, stops), signal)
}

/**
 * Reverse geocoding so the address field fills in when a customer drops a pin.
 * If it fails the customer can still type the address manually.
 */
export async function reverseGeocode(
  point: LatLng,
  signal?: AbortSignal,
): Promise<string | null> {
  const url =
    `${NOMINATIM_BASE_URL}/reverse?format=jsonv2&zoom=18&addressdetails=1` +
    `&lat=${point.lat}&lon=${point.lng}`

  try {
    const response = await fetch(url, {
      signal,
      headers: { Accept: 'application/json' },
    })
    if (!response.ok) return null
    const payload = (await response.json()) as { display_name?: string }
    return payload.display_name ?? null
  } catch (error) {
    if ((error as Error).name === 'AbortError') throw error
    return null
  }
}

export interface BrowserLocationError {
  code: 'denied' | 'unavailable' | 'timeout' | 'unsupported'
  message: string
}

export function getBrowserLocation(): Promise<LatLng> {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject({
        code: 'unsupported',
        message: 'Your browser does not support location services.',
      } satisfies BrowserLocationError)
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) =>
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        }),
      (error) => {
        const messages: Record<number, BrowserLocationError> = {
          1: {
            code: 'denied',
            message:
              'Location permission was denied. Enable it in your browser settings to use GPS.',
          },
          2: {
            code: 'unavailable',
            message: 'Your current location could not be determined.',
          },
          3: {
            code: 'timeout',
            message: 'Getting your location took too long. Please try again.',
          },
        }
        reject(
          messages[error.code] ?? {
            code: 'unavailable',
            message: 'Unable to get your current location.',
          },
        )
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 15000 },
    )
  })
}

export function watchBrowserLocation(
  onUpdate: (point: LatLng) => void,
  onError: (error: BrowserLocationError) => void,
): () => void {
  if (!('geolocation' in navigator)) {
    onError({
      code: 'unsupported',
      message: 'Your browser does not support location services.',
    })
    return () => undefined
  }

  const watchId = navigator.geolocation.watchPosition(
    (position) =>
      onUpdate({
        lat: position.coords.latitude,
        lng: position.coords.longitude,
      }),
    (error) => {
      onError({
        code: error.code === 1 ? 'denied' : 'unavailable',
        message:
          error.code === 1
            ? 'Location permission was denied. Enable GPS to show your position on the map.'
            : 'Your current location could not be determined.',
      })
    },
    { enableHighAccuracy: true, maximumAge: 20000, timeout: 15000 },
  )

  return () => navigator.geolocation.clearWatch(watchId)
}
