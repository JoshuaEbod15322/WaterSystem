import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import L from 'leaflet'
import { MapPin } from 'lucide-react'

/**
 * Every Leaflet marker uses the real Lucide `MapPin` icon. Leaflet's
 * `divIcon` needs an HTML string, so the React icon is rendered once to static
 * markup and reused inside the pin shell.
 */
function lucideMapPin(size: number, fill: string, stroke = '#ffffff') {
  return renderToStaticMarkup(
    createElement(MapPin, {
      size,
      strokeWidth: 2.5,
      color: stroke,
      fill,
      fillOpacity: 1,
    }),
  )
}

function makePin(
  fill: string,
  ring: string,
  pulse = false,
  label?: number,
) {
  const marker = lucideMapPin(34, fill)
  const overlay =
    label === undefined
      ? `<span style="position:absolute;left:50%;top:14px;transform:translateX(-50%);width:8px;height:8px;border-radius:9999px;background:${ring};"></span>`
      : `<span style="position:absolute;left:0;top:7px;width:34px;text-align:center;font:700 11px/14px ui-sans-serif,system-ui,sans-serif;color:#fff;letter-spacing:-0.02em;">${label}</span>`
  const pulseRing = pulse
    ? `<span style="position:absolute;left:50%;top:14px;transform:translateX(-50%);width:8px;height:8px;border-radius:9999px;background:${ring};box-shadow:0 0 0 6px ${ring}33;"></span>`
    : ''

  return L.divIcon({
    className: '',
    iconSize: [34, 36],
    iconAnchor: [17, 33],
    popupAnchor: [0, -30],
    html: `<div style="position:relative;width:34px;height:36px;filter:drop-shadow(0 3px 4px rgba(15,23,42,.35));">
      <div style="position:absolute;inset:0;">${marker}</div>
      ${overlay}
      ${pulseRing}
    </div>`,
  })
}

function roundMarker(fill: string, size = 36, pulse = false) {
  return L.divIcon({
    className: '',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
    html: `<div class="${pulse ? 'driver-pulse' : ''}" style="width:${size}px;height:${size}px;border-radius:9999px;background:${fill};border:3px solid white;display:flex;align-items:center;justify-content:center;box-shadow:0 3px 8px rgba(15,23,42,.35);">
      ${lucideMapPin(Math.round(size * 0.5), 'none')}
    </div>`,
  })
}

export const stationIcon = roundMarker('#0f766e', 36)
export const customerIcon = makePin('#0284c7', '#38bdf8')
export const deliveryDoneIcon = makePin('#059669', '#34d399')
export const deliveryActiveIcon = makePin('#d97706', '#fbbf24', true)
export const driverIcon = roundMarker('#059669', 38, true)

export function orderIcon(status: string) {
  if (status === 'delivered') return deliveryDoneIcon
  if (status === 'out_for_delivery') {
    return deliveryActiveIcon
  }
  return customerIcon
}

const numberedPinCache = new Map<string, L.DivIcon>()

/**
 * Numbered pin used by the optimized multi-stop route. The number is the
 * recommended visit order and is drawn inside the Lucide MapPin.
 */
export function numberedPinIcon(sequence: number, status = 'pending') {
  const key = `${sequence}:${status}`
  const cached = numberedPinCache.get(key)
  if (cached) return cached

  const isActive = status === 'out_for_delivery'
  const fill = status === 'delivered' ? '#059669' : isActive ? '#d97706' : '#0284c7'
  const ring = status === 'delivered' ? '#34d399' : isActive ? '#fbbf24' : '#38bdf8'
  const icon = makePin(fill, ring, isActive, sequence)
  numberedPinCache.set(key, icon)
  return icon
}
