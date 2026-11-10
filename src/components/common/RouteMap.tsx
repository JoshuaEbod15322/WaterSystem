import { Fragment, useEffect, useMemo, useRef } from 'react'
import L from 'leaflet'
import {
  MapContainer,
  Marker,
  Polyline,
  Popup,
  TileLayer,
  useMap,
} from 'react-leaflet'
import type { LatLng } from '../../types'
import {
  driverIcon,
  orderIcon,
  stationIcon,
} from '../../utils/mapIcons'
import { DEFAULT_CENTER } from '../../utils/constants'

const TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
const TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'

export interface RouteMapDestination extends LatLng {
  id: string
  label: string
  status: string
}

export interface RouteMapLine {
  id: string
  coordinates: Array<[number, number]>
  color?: string
}

function FitDestinations({
  station,
  destinations,
}: {
  station: LatLng | null
  destinations: RouteMapDestination[]
}) {
  const map = useMap()
  // Only the geographic stop set matters. Driver GPS updates, status changes
  // and other re-renders must not reset the user's pan/zoom.
  const boundsKey = useMemo(
    () =>
      [
        station ? `${station.lat},${station.lng}` : '',
        ...destinations.map((item) => `${item.lat},${item.lng}`),
      ].join('|'),
    [station, destinations],
  )

  const pointsRef = useRef<Array<[number, number]>>([])
  const points: Array<[number, number]> = []
  if (station) points.push([station.lat, station.lng])
  destinations.forEach((item) => points.push([item.lat, item.lng]))
  pointsRef.current = points

  useEffect(() => {
    const nextPoints = pointsRef.current
    if (nextPoints.length === 0) return

    if (nextPoints.length === 1) {
      map.setView(nextPoints[0], 14)
      return
    }

    map.fitBounds(L.latLngBounds(nextPoints), {
      padding: [36, 36],
      maxZoom: 15,
    })
  }, [map, boundsKey])

  return null
}

function ResizeFix() {
  const map = useMap()
  useEffect(() => {
    const timeout = window.setTimeout(() => map.invalidateSize(), 200)
    return () => window.clearTimeout(timeout)
  }, [map])
  return null
}

export function RouteMap({
  station,
  driver,
  destinations,
  routes,
  heightClass = 'h-72',
  selectedDestinationId,
}: {
  station: LatLng | null
  driver: LatLng | null
  destinations: RouteMapDestination[]
  routes: RouteMapLine[]
  heightClass?: string
  selectedDestinationId?: string
}) {
  const center = station ?? destinations[0] ?? DEFAULT_CENTER

  return (
    <div className={`relative overflow-hidden rounded-xl border border-slate-200 ${heightClass}`}>
      <MapContainer
        center={[center.lat, center.lng]}
        zoom={13}
        scrollWheelZoom
        className="h-full w-full"
      >
        <TileLayer url={TILE_URL} attribution={TILE_ATTRIBUTION} />
        <ResizeFix />
        <FitDestinations station={station} destinations={destinations} />

        {routes.map((route) => {
          const color = route.color ?? '#0284c7'
          const highlighted =
            routes.length === 1 || selectedDestinationId === route.id

          return (
            <Fragment key={route.id}>
              <Polyline
                positions={route.coordinates}
                pathOptions={{
                  color: '#ffffff',
                  weight: 10,
                  opacity: 0.8,
                  lineCap: 'round',
                  lineJoin: 'round',
                }}
              />
              <Polyline
                positions={route.coordinates}
                pathOptions={{
                  color,
                  weight: 5,
                  opacity: 0.95,
                  lineCap: 'round',
                  lineJoin: 'round',
                }}
              />
              {highlighted ? (
                <Polyline
                  positions={route.coordinates}
                  pathOptions={{
                    color: '#ffffff',
                    weight: 2.5,
                    opacity: 0.95,
                    dashArray: '2 10',
                    lineCap: 'round',
                    className: 'route-flow',
                  }}
                />
              ) : null}
            </Fragment>
          )
        })}

        {station ? (
          <Marker position={[station.lat, station.lng]} icon={stationIcon}>
            <Popup>Water refilling station</Popup>
          </Marker>
        ) : null}

        {driver ? (
          <Marker position={[driver.lat, driver.lng]} icon={driverIcon}>
            <Popup>Your current location</Popup>
          </Marker>
        ) : null}

        {destinations.map((destination) => (
          <Marker
            key={destination.id}
            position={[destination.lat, destination.lng]}
            icon={orderIcon(destination.status)}
            opacity={
              selectedDestinationId && selectedDestinationId !== destination.id
                ? 0.65
                : 1
            }
          >
            <Popup>{destination.label}</Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  )
}
