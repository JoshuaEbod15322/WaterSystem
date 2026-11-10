import { useEffect } from 'react'
import L from 'leaflet'
import {
  MapContainer,
  Marker,
  Popup,
  TileLayer,
  useMap,
  useMapEvents,
} from 'react-leaflet'
import type { LatLng } from '../../types'
import { customerIcon, stationIcon } from '../../utils/mapIcons'
import { DEFAULT_CENTER } from '../../utils/constants'

const TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
const TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'

function ClickHandler({ onPick }: { onPick: (point: LatLng) => void }) {
  useMapEvents({
    click(event) {
      onPick({ lat: event.latlng.lat, lng: event.latlng.lng })
    },
  })
  return null
}

function FlyTo({ lat, lng }: { lat: number | null; lng: number | null }) {
  const map = useMap()

  useEffect(() => {
    if (lat === null || lng === null) return
    map.flyTo([lat, lng], Math.max(map.getZoom(), 15), {
      duration: 0.6,
    })
  }, [map, lat, lng])

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

export function MapPicker({
  value,
  onChange,
  station,
  heightClass = 'h-64',
  interactive = true,
  zoom = 14,
}: {
  value: LatLng | null
  onChange: (point: LatLng) => void
  station?: LatLng
  heightClass?: string
  interactive?: boolean
  zoom?: number
}) {
  const center = value ?? station ?? DEFAULT_CENTER

  return (
    <div className={`relative overflow-hidden rounded-xl border border-slate-200 ${heightClass}`}>
      <MapContainer
        center={[center.lat, center.lng]}
        zoom={zoom}
        scrollWheelZoom={interactive}
        dragging={interactive}
        doubleClickZoom={interactive}
        className="h-full w-full"
      >
        <TileLayer url={TILE_URL} attribution={TILE_ATTRIBUTION} />
        {interactive ? <ClickHandler onPick={onChange} /> : null}
        <FlyTo lat={value?.lat ?? null} lng={value?.lng ?? null} />
        <ResizeFix />

        {station ? (
          <Marker position={[station.lat, station.lng]} icon={stationIcon}>
            <Popup>Water station</Popup>
          </Marker>
        ) : null}

        {value ? (
          <Marker
            position={[value.lat, value.lng]}
            icon={customerIcon}
            draggable={interactive}
            eventHandlers={{
              dragend: (event) => {
                const point = (event.target as L.Marker).getLatLng()
                onChange({ lat: point.lat, lng: point.lng })
              },
            }}
          >
            <Popup>Your delivery location</Popup>
          </Marker>
        ) : null}
      </MapContainer>

      {!value && interactive ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-3 z-[400] flex justify-center">
          <span className="rounded-full bg-slate-900/80 px-3 py-1.5 text-xs font-medium text-white shadow">
            Tap the map to pin your delivery location
          </span>
        </div>
      ) : null}
    </div>
  )
}
