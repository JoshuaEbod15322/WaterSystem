import { Link } from 'react-router-dom'
import { Droplets } from 'lucide-react'
import { Button } from '../components/common/Button'

export function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-100 text-brand-700">
        <Droplets className="h-8 w-8" />
      </div>
      <p className="mt-6 text-sm font-semibold uppercase tracking-widest text-brand-600">
        404 — Page not found
      </p>
      <h1 className="mt-2 text-3xl font-bold text-slate-900">
        This page has evaporated
      </h1>
      <p className="mt-2 max-w-sm text-sm text-slate-500">
        The page you are looking for does not exist or may have been moved.
      </p>
      <Link to="/" className="mt-6">
        <Button size="lg">Back to home</Button>
      </Link>
    </div>
  )
}
