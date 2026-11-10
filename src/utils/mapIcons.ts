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

function makePin(fill: string) {
  const marker = lucideMapPin(34, fill)

  return L.divIcon({
    className: '',
    iconSize: [34, 36],
    iconAnchor: [17, 33],
    popupAnchor: [0, -30],
    html: `<div style="position:relative;width:34px;height:36px;filter:drop-shadow(0 3px 4px rgba(15,23,42,.35));">${marker}</div>`,
  })
}

export const stationIcon = makePin('#0f766e')
export const customerIcon = makePin('#0284c7')
export const deliveryDoneIcon = makePin('#059669')
export const deliveryActiveIcon = makePin('#d97706')
export const driverIcon = makePin('#059669')

export function orderIcon(status: string) {
  if (status === 'delivered') return deliveryDoneIcon
  if (status === 'out_for_delivery') {
    return deliveryActiveIcon
  }
  return customerIcon
}
